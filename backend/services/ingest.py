from typing import Dict, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import RawReport, RawBulletin, HazardEvent
from services.nlp import nlp_processor
from services.credibility import credibility_scorer
from services.dedupe import dedupe_engine
from services.fusion import fusion_engine, FusionResult

class ProcessingPipeline:
    def __init__(self, db_path: str = 'sqlite:///hazard.db'):
        self.engine = create_engine(db_path, connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def get_db_session(self):
        """Get database session"""
        return self.SessionLocal()

    def process_single_report(self, report_id: int, db: Session = None, is_emergency: bool = False) -> bool:
        """Process a single raw report through the ML pipeline"""
        if db is None:
            db = self.get_db_session()
            close_db = True
        else:
            close_db = False
        
        try:
            # Fetch the raw report
            report = db.query(RawReport).filter(RawReport.id == report_id).first()
            if not report:
                print(f"Report {report_id} not found")
                return False
            
            if report.processed:
                print(f"Report {report_id} already processed")
                return True
            
            # Step 1: NLP Classification with PROGRESSIVE CONFIDENCE + MEDIA VERIFICATION
            # Pass source and media info to NLP processor for enhanced confidence scaling
            print(f"🔍 Step 1: NLP Classification for report {report_id}")
            
            # Extract media information
            has_media = getattr(report, 'has_media', False) or bool(report.media_path)
            media_verified = getattr(report, 'media_verified', False)
            
            nlp_result = nlp_processor.classify_text(
                report.text, 
                report.source,
                has_media=has_media,
                media_verified=media_verified
            )
            
            # Emergency override: treat LoRa SOS as emergency with high confidence
            if is_emergency or report.source == "lora_sos":
                nlp_result = {
                    'hazard_type': 'emergency',
                    'confidence': 0.99,
                    'keywords_found': ['sos', 'emergency']
                }
            
            # Step 2: Credibility Scoring
            print(f"🔍 Step 2: Credibility Scoring for report {report_id}, timestamp: {report.timestamp}")
            
            # Ensure timestamp is timezone-aware for credibility calculation
            from datetime import timezone
            timestamp = report.timestamp
            if timestamp and timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            
            credibility_result = credibility_scorer.calculate_credibility(
                source=report.source,
                text=report.text,
                lat=report.lat,
                lon=report.lon,
                timestamp=timestamp,
                media_path=report.media_path
            )
            
            # Update report with NLP and credibility results
            report.nlp_type = nlp_result.hazard_type
            report.nlp_conf = nlp_result.confidence
            report.credibility = credibility_result.score
            
            # Step 3: Deduplication - find existing reports to group with
            existing_reports = self._get_reports_for_dedup(db, report_id)
            
            report_dict = {
                'id': report.id,
                'text': report.text,
                'lat': report.lat,
                'lon': report.lon,
                'timestamp': report.timestamp,
                'source': report.source,
                'nlp_conf': report.nlp_conf,
                'credibility': report.credibility
            }
            
            dedupe_result = dedupe_engine.find_duplicates(report_dict, existing_reports)
            
            # Update group_id
            report.group_id = dedupe_result.group_id
            report.processed = True
            
            db.commit()
            
            # Step 4: PROGRESSIVE FUSION - reprocess group to build confidence
            # This enables confidence to increase as more sources are added to the group
            fusion_result = self._process_group_fusion(dedupe_result.group_id, db)
            
            # Get group size for logging
            group_size = len(self._get_reports_in_group(db, dedupe_result.group_id))
            unique_sources = len(set(r['source'] for r in self._get_reports_in_group(db, dedupe_result.group_id)))
            
            print(f"Successfully processed report {report_id}: {nlp_result.hazard_type} "
                  f"(initial: {nlp_result.confidence:.2f} → group: {fusion_result.confidence:.2f}, "
                  f"cred: {credibility_result.score:.2f}, group: {dedupe_result.group_id}, "
                  f"reports: {group_size}, sources: {unique_sources})")
            
            return True
            
        except Exception as e:
            print(f"Error processing report {report_id}: {str(e)}")
            import traceback
            traceback.print_exc()
            db.rollback()
            return False
        finally:
            if close_db:
                db.close()

    def _get_reports_for_dedup(self, db: Session, exclude_id: int) -> List[Dict]:
        """Get processed reports for deduplication comparison"""
        reports = db.query(RawReport).filter(
            RawReport.processed == True,
            RawReport.id != exclude_id
        ).all()
        
        return [
            {
                'id': r.id,
                'text': r.text,
                'lat': r.lat,
                'lon': r.lon,
                'timestamp': r.timestamp,
                'source': r.source,
                'nlp_conf': r.nlp_conf or 0.5,
                'credibility': r.credibility or 0.5,
                'group_id': r.group_id
            }
            for r in reports
        ]
    
    def _get_reports_in_group(self, db: Session, group_id: int) -> List[Dict]:
        """Get all reports in a specific group for progressive confidence calculation"""
        reports = db.query(RawReport).filter(
            RawReport.group_id == group_id,
            RawReport.processed == True
        ).all()
        
        return [
            {
                'id': r.id,
                'source': r.source,
                'nlp_conf': r.nlp_conf or 0.5,
                'credibility': r.credibility or 0.5
            }
            for r in reports
        ]

    def _process_group_fusion(self, group_id: int, db: Session) -> FusionResult:
        """Process fusion for a specific group of reports and return fusion result for confidence tracking"""
        try:
            # Get all reports in this group
            group_reports = db.query(RawReport).filter(
                RawReport.group_id == group_id,
                RawReport.processed == True
            ).all()
            
            if not group_reports:
                print(f"No reports found for group {group_id}")
                # Return minimal fusion result
                class MinimalFusion:
                    def __init__(self):
                        self.confidence = 0.0
                        self.hazard_type = 'unknown'
                return MinimalFusion()
            
            # Convert to dict format for fusion with media verification info
            reports_data = [
                {
                    'id': r.id,
                    'text': r.text,
                    'lat': r.lat,
                    'lon': r.lon,
                    'timestamp': r.timestamp,
                    'source': r.source,
                    'nlp_type': r.nlp_type,
                    'nlp_conf': r.nlp_conf or 0.5,
                    'credibility': r.credibility or 0.5,
                    'has_media': getattr(r, 'has_media', False) or bool(r.media_path),
                    'media_verified': getattr(r, 'media_verified', False),
                    'keywords_found': [],  # Could extract from NLP result if stored
                    'severity_boost': 0,   # Could extract from NLP result if stored
                }
                for r in group_reports
            ]
            
            # Get group statistics
            group_stats = dedupe_engine.get_group_statistics(reports_data)
            
            # Perform fusion
            fusion_result = fusion_engine.fuse_reports(reports_data, group_stats)
            
            # Check if hazard event already exists for this group
            # Search for existing event whose evidence_json.report_ids contains this group_id
            # Use a single JSON containment check with a proper dict to let SQLAlchemy/psycopg
            # pass a JSONB parameter rather than concatenated strings which caused invalid
            # text representation errors.
            existing_event = db.query(HazardEvent).filter(
                HazardEvent.evidence_json.contains({"report_ids": [group_id]})
            ).first()
            
            if existing_event:
                # Update existing hazard event
                existing_event.hazard_type = fusion_result.hazard_type
                existing_event.confidence = fusion_result.confidence
                existing_event.severity = fusion_result.severity
                existing_event.status = fusion_result.status
                existing_event.centroid_lat = fusion_result.centroid_lat
                existing_event.centroid_lon = fusion_result.centroid_lon
                existing_event.evidence_json = fusion_result.evidence['json']
                existing_event.updated_at = datetime.now(timezone.utc)
                
                event_id = existing_event.id
                action = "updated"
            else:
                # Create new hazard event
                new_event = HazardEvent(
                    hazard_type=fusion_result.hazard_type,
                    confidence=fusion_result.confidence,
                    severity=fusion_result.severity,
                    status=fusion_result.status,
                    centroid_lat=fusion_result.centroid_lat,
                    centroid_lon=fusion_result.centroid_lon,
                    evidence_json=fusion_result.evidence['json'],
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc)
                )
                
                db.add(new_event)
                db.flush()  # Get the ID
                event_id = new_event.id
                action = "created"
            
            db.commit()
            
            explanation = fusion_engine.get_fusion_explanation(fusion_result, len(reports_data))
            print(f"Hazard event {event_id} {action} for group {group_id}: {explanation}")
            
            return fusion_result
            
        except Exception as e:
            print(f"Error processing fusion for group {group_id}: {str(e)}")
            db.rollback()
            # Return minimal fusion result on error
            class MinimalFusion:
                def __init__(self):
                    self.confidence = 0.0
                    self.hazard_type = 'error'
            return MinimalFusion()

    def process_all_unprocessed_reports(self) -> Dict[str, int]:
        """Process all unprocessed reports in the database"""
        db = self.get_db_session()
        stats = {"processed": 0, "failed": 0, "total": 0}
        
        try:
            # Get all unprocessed reports
            unprocessed_reports = db.query(RawReport).filter(
                RawReport.processed == False
            ).all()
            
            stats["total"] = len(unprocessed_reports)
            
            for report in unprocessed_reports:
                success = self.process_single_report(report.id, db)
                if success:
                    stats["processed"] += 1
                else:
                    stats["failed"] += 1
            
            print(f"Batch processing complete: {stats['processed']}/{stats['total']} reports processed")
            return stats
            
        except Exception as e:
            print(f"Error in batch processing: {str(e)}")
            return stats
        finally:
            db.close()

    def process_new_lora_sos(self, device_id: str, lat: float, lon: float, 
                           message: str, timestamp: Optional[datetime] = None) -> int:
        """Process a new LoRa SOS emergency signal"""
        db = self.get_db_session()
        
        try:
            # Create emergency hazard event immediately
            emergency_event = HazardEvent(
                hazard_type="emergency",
                confidence=0.99,
                severity=5,
                status="emergency",
                centroid_lat=lat,
                centroid_lon=lon,
                evidence_json=f'{{"lora_device": "{device_id}", "message": "{message}", "emergency": true}}',
                created_at=timestamp or datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            db.add(emergency_event)
            db.commit()
            db.refresh(emergency_event)
            
            print(f"Emergency event {emergency_event.id} created for LoRa SOS from device {device_id}")
            return emergency_event.id
            
        except Exception as e:
            print(f"Error creating LoRa SOS emergency: {str(e)}")
            db.rollback()
            return -1
        finally:
            db.close()

    def get_processing_stats(self) -> Dict[str, int]:
        """Get processing statistics"""
        db = self.get_db_session()
        
        try:
            total_reports = db.query(RawReport).count()
            processed_reports = db.query(RawReport).filter(RawReport.processed == True).count()
            total_events = db.query(HazardEvent).count()
            emergency_events = db.query(HazardEvent).filter(HazardEvent.status == 'emergency').count()
            
            return {
                "total_reports": total_reports,
                "processed_reports": processed_reports,
                "unprocessed_reports": total_reports - processed_reports,
                "total_events": total_events,
                "emergency_events": emergency_events
            }
        finally:
            db.close()

# Singleton instance
processing_pipeline = ProcessingPipeline()