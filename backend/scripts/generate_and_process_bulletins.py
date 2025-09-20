"""Generate sample INCOIS and IMD bulletins, insert them into RawBulletin, and process them into HazardEvent entries.

Run from backend/ with PYTHONPATH set to backend (or from repo root with PYTHONPATH pointing to backend).
"""
from datetime import datetime, timedelta, timezone
import uuid
from database import db_manager
from models import RawBulletin, HazardEvent
from services.fusion import fusion_engine
from supabase import Client
import json


def insert_bulletins_and_fuse():
    Session = db_manager.SessionLocal
    db = Session()

    try:
        now = datetime.now(timezone.utc)

        bulletins = [
            # INCOIS official bulletin (high reliability)
            {
                'source': 'INCOIS',
                'hazard_type': 'tsunami',
                'severity': 5,
                'description': 'Tsunami advisory: Potential sea-level anomalies detected off Chennai coast. Evacuate low-lying areas.',
                'area_affected': 'Chennai coast',
                'lat': 13.0827,
                'lon': 80.2707,
                'valid_from': now,
                'valid_until': now + timedelta(hours=6),
                'bulletin_id': f'INCOIS-{uuid.uuid4()}',
                'issued_at': now
            },
            # IMD bulletin (high reliability, weather heavy rainfall)
            {
                'source': 'IMD',
                'hazard_type': 'flood',
                'severity': 4,
                'description': 'Heavy rainfall warning for Chennai and adjoining districts. Expect urban flooding.',
                'area_affected': 'Chennai metropolitan area',
                'lat': 13.0827,
                'lon': 80.2707,
                'valid_from': now,
                'valid_until': now + timedelta(hours=12),
                'bulletin_id': f'IMD-{uuid.uuid4()}',
                'issued_at': now
            }
        ]

        created_ids = []
        for b in bulletins:
            rb = RawBulletin(
                source=b['source'],
                hazard_type=b['hazard_type'],
                severity=b['severity'],
                description=b['description'],
                area_affected=b['area_affected'],
                lat=b['lat'],
                lon=b['lon'],
                valid_from=b['valid_from'],
                valid_until=b['valid_until'],
                bulletin_id=b['bulletin_id'],
                issued_at=b['issued_at']
            )
            db.add(rb)
            db.flush()
            created_ids.append(rb.id)
            print(f"Inserted RawBulletin {rb.bulletin_id} ({rb.source}) → id={rb.id}")

        db.commit()

        # For each bulletin, create a HazardEvent using fusion_engine
        for b_id in created_ids:
            rb = db.query(RawBulletin).filter(RawBulletin.id == b_id).first()
            if not rb:
                continue

            # Build a single-report-like dict for fusion with higher weight for official source
            report_like = {
                'id': str(uuid.uuid4()),
                'text': rb.description,
                'lat': rb.lat or 0.0,
                'lon': rb.lon or 0.0,
                'timestamp': rb.issued_at or now,
                'source': rb.source.lower(),
                'nlp_type': (rb.hazard_type or '').lower(),
                'nlp_conf': 0.95,  # official bulletin -> high confidence in hazard type
                'credibility': 0.95 if rb.source.lower() in ['incois', 'imd'] else 0.7,
                'severity_boost': 0,
                'has_media': False,
                'media_verified': False,
            }

            group_stats = {
                'earliest_time': report_like['timestamp'],
                'latest_time': report_like['timestamp'],
                'source_distribution': {report_like['source']: 1},
                'unique_descriptions': [report_like['text']],
                'report_ids': [report_like['id']]
            }

            fusion_result = fusion_engine.fuse_reports([report_like], group_stats)

            # Insert as a HazardEvent
            # Map numeric severity to DB textual severity if needed
            severity_map = {1: 'low', 2: 'low-medium', 3: 'medium', 4: 'high', 5: 'critical'}
            severity_value = fusion_result.severity
            severity_db = severity_map.get(severity_value, str(severity_value))

            # Map fusion status to DB-allowed status values
            status_map = {
                'confirmed': 'active',
                'review': 'pending',
                'pending': 'pending',
                'emergency': 'emergency',
                'error': 'pending'
            }
            status_db = status_map.get(fusion_result.status, 'pending')

            new_event = HazardEvent(
                hazard_type=fusion_result.hazard_type,
                confidence=fusion_result.confidence,
                severity=severity_db,
                status=status_db,
                centroid_lat=fusion_result.centroid_lat,
                centroid_lon=fusion_result.centroid_lon,
                evidence_json=fusion_result.evidence['json'],
                source_count=1,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )

            db.add(new_event)
            db.commit()
            db.refresh(new_event)
            print(f"Created HazardEvent {new_event.id} from bulletin {rb.bulletin_id} ({rb.source}) -> confidence={new_event.confidence:.3f}")

    except Exception as e:
        # If SQLAlchemy/DB access fails (for example DNS resolution to the DB host),
        # fall back to using the Supabase client to insert rows.
        print(f"Primary DB path failed, attempting Supabase client fallback: {e}")
        try:
            db.rollback()
        except Exception:
            pass

        try:
            supabase: Client = db_manager.get_supabase_client()

            # Insert bulletins via Supabase REST client
            sb_insert = []
            for b in bulletins:
                sb_insert.append({
                    'source': b['source'],
                    'hazard_type': b['hazard_type'],
                    'severity': b['severity'],
                    'description': b['description'],
                    'area_affected': b['area_affected'],
                    'lat': b['lat'],
                    'lon': b['lon'],
                    'valid_from': b['valid_from'].isoformat(),
                    'valid_until': b['valid_until'].isoformat(),
                    'bulletin_id': b['bulletin_id'],
                    'issued_at': b['issued_at'].isoformat()
                })

            resp = supabase.from_('raw_bulletins').insert(sb_insert).execute()

            # Robust check for APIResponse success (different supabase client versions differ)
            def _sb_success(r):
                # prefer explicit error field
                if getattr(r, 'error', None):
                    return False
                # status_code may not exist; if present use it
                sc = getattr(r, 'status_code', None)
                if sc is not None:
                    return sc in (200, 201, 204)
                # fallback: treat presence of data as success
                return getattr(r, 'data', None) is not None

            if not _sb_success(resp):
                print('Supabase insert may have failed:', repr(resp))
            else:
                print('Inserted bulletins via Supabase client')

            # For each inserted bulletin, create hazard events using local fusion and insert via supabase
            for b in bulletins:
                report_like = {
                    'id': str(uuid.uuid4()),
                    'text': b['description'],
                    'lat': b['lat'] or 0.0,
                    'lon': b['lon'] or 0.0,
                    'timestamp': b['issued_at'],
                    'source': b['source'].lower(),
                    'nlp_type': (b['hazard_type'] or '').lower(),
                    'nlp_conf': 0.95,
                    'credibility': 0.95 if b['source'].lower() in ['incois', 'imd'] else 0.7,
                    'severity_boost': 0,
                    'has_media': False,
                    'media_verified': False,
                }

                group_stats = {
                    'earliest_time': report_like['timestamp'],
                    'latest_time': report_like['timestamp'],
                    'source_distribution': {report_like['source']: 1},
                    'unique_descriptions': [report_like['text']],
                    'report_ids': [report_like['id']]
                }

                fusion_result = fusion_engine.fuse_reports([report_like], group_stats)

                # Map severity to textual form for DB constraint compatibility
                severity_map = {1: 'low', 2: 'low-medium', 3: 'medium', 4: 'high', 5: 'critical'}
                sev = fusion_result.severity
                sev_db = severity_map.get(sev, str(sev))

                # Map fusion status to DB-allowed status values
                status_map = {
                    'confirmed': 'active',
                    'review': 'pending',
                    'pending': 'pending',
                    'emergency': 'emergency',
                    'error': 'pending'
                }
                status_db = status_map.get(fusion_result.status, 'pending')

                hb = {
                    'hazard_type': fusion_result.hazard_type,
                    'confidence': fusion_result.confidence,
                    'severity': sev_db,
                    'status': status_db,
                    'centroid_lat': fusion_result.centroid_lat,
                    'centroid_lon': fusion_result.centroid_lon,
                    'evidence_json': fusion_result.evidence['json'],
                    'source_count': 1,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }

                resp = supabase.from_('hazard_events').insert(hb).execute()
                if not _sb_success(resp):
                    print('Failed to insert HazardEvent via Supabase client:', repr(resp))
                else:
                    print(f"Created HazardEvent via Supabase client from bulletin {b['bulletin_id']} -> confidence={fusion_result.confidence:.3f}")

        except Exception as sup_e:
            print(f"Supabase fallback also failed: {sup_e}")
            import traceback
            traceback.print_exc()
    finally:
        db.close()


if __name__ == '__main__':
    insert_bulletins_and_fuse()
