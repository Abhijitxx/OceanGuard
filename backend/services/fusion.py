import json
import statistics
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class FusionResult:
    hazard_type: str
    confidence: float
    severity: int
    status: str
    centroid_lat: float
    centroid_lon: float
    evidence: Dict[str, Any]
    priority_score: float

class FusionEngine:
    def __init__(self):
        # Source reliability weights for fusion
        self.source_weights = {
            'incois': 0.9,      # Official weather service
            'lora': 0.95,       # Emergency device  
            'citizen': 0.6,     # Citizen report
            'social': 0.4,      # Social media
        }
        
        # Confidence thresholds for automatic actions
        self.thresholds = {
            'auto_alert': 0.85,     # Auto-publish alert (higher threshold)
            'emergency': 0.9,       # Emergency status (higher threshold) 
            'review_required': 0.3,  # Needs admin review (lower threshold)
        }
        
        # Hazard type priority weights (updated for 5 main hazard types)
        self.hazard_priorities = {
            'emergency': 1.0,    # LoRa SOS
            'tsunami': 0.95,     # Extremely dangerous
            'earthquake': 0.9,   # Very dangerous
            'landslide': 0.85,   # High danger
            'flood': 0.8,        # Dangerous
            'tides': 0.7,        # Moderate to high danger
            'unknown': 0.3       # Uncertain
        }

    def calculate_weighted_confidence(self, reports: List[Dict]) -> float:
        """Calculate progressive confidence with diminishing returns and media verification"""
        if not reports:
            return 0.0
        
        # PROGRESSIVE CONFIDENCE WITH DIMINISHING RETURNS + MEDIA VERIFICATION
        # Group reports by source type to handle volume properly
        source_groups = {}
        verified_media_count = 0
        total_media_count = 0
        
        for report in reports:
            source = report.get('source', 'unknown').lower()
            nlp_conf = report.get('nlp_conf', 0.5)
            credibility = report.get('credibility', 0.5)
            
            # MEDIA VERIFICATION ENHANCEMENT
            has_media = report.get('has_media', False)
            media_verified = report.get('media_verified', False)
            
            if has_media:
                total_media_count += 1
                if media_verified:
                    verified_media_count += 1
            
            if source not in source_groups:
                source_groups[source] = []
            
            # Store individual report confidence with media boost
            base_report_confidence = nlp_conf * credibility
            
            # Apply media verification boost at report level
            if has_media and media_verified:
                # Verified images provide strong evidence boost
                media_boosted_confidence = min(0.95, base_report_confidence + 0.4)
                print(f"   📸 Report with VERIFIED image: {base_report_confidence:.3f} → {media_boosted_confidence:.3f}")
            elif has_media:
                # Unverified media still provides some boost
                media_boosted_confidence = min(0.7, base_report_confidence + 0.15)
                print(f"   📷 Report with unverified media: {base_report_confidence:.3f} → {media_boosted_confidence:.3f}")
            else:
                media_boosted_confidence = base_report_confidence
            
            source_groups[source].append(media_boosted_confidence)
        
        # Calculate confidence for each source type with diminishing returns
        total_confidence = 0.0
        total_weight = 0.0
        
        for source, report_confidences in source_groups.items():
            source_weight = self.source_weights.get(source, 0.3)
            
            # Average confidence for this source type
            avg_confidence = sum(report_confidences) / len(report_confidences)
            
            # Apply logarithmic scaling for volume (diminishing returns)
            # This prevents 1000 reports from giving 100% confidence
            volume = len(report_confidences)
            volume_factor = self._calculate_volume_factor(volume, source)
            
            # Source contribution = average quality × volume factor × source weight
            source_contribution = avg_confidence * volume_factor * source_weight
            
            total_confidence += source_contribution
            total_weight += source_weight
            
            print(f"   📊 {source}: {volume} reports, avg_conf: {avg_confidence:.3f}, "
                  f"volume_factor: {volume_factor:.3f}, contribution: {source_contribution:.3f}")
        
        base_confidence = total_confidence / total_weight if total_weight > 0 else 0.0
        
        # MULTI-SOURCE DIVERSITY BOOST
        unique_sources = set(source_groups.keys())
        num_sources = len(unique_sources)
        source_diversity_boost = self._calculate_source_diversity_boost(unique_sources, num_sources)
        
        # MEDIA EVIDENCE BOOST
        media_evidence_boost = self._calculate_media_evidence_boost(verified_media_count, total_media_count)
        
        # Apply progressive boost but cap at realistic maximum
        # Media verification can push confidence higher than normal cap
        max_confidence = 0.98 if verified_media_count > 0 else 0.95
        final_confidence = min(max_confidence, base_confidence * source_diversity_boost * media_evidence_boost)
        
        print(f"   🎥 Media evidence: {verified_media_count}/{total_media_count} verified, boost: {media_evidence_boost:.1f}x")
        print(f"   🎯 Base: {base_confidence:.3f}, Diversity: {source_diversity_boost:.1f}x, Media: {media_evidence_boost:.1f}x, Final: {final_confidence:.3f}")
        
        return final_confidence
    
    def _calculate_volume_factor(self, volume: int, source: str) -> float:
        """Calculate volume factor with dynamic scaling based on report count"""
        import math
        
        if volume <= 0:
            return 0.0
        
        # Different scaling for different source types with more dynamic growth
        if source in ['incois', 'lora']:
            # Official sources: high impact, moderate scaling
            # 1 report: 0.9, 5 reports: 1.0, 10+ reports: 1.0 (maxed out)
            return min(1.0, 0.8 + 0.1 * math.log10(volume + 1))
        
        elif source == 'citizen':
            # Citizen reports: dynamic scaling that rewards volume
            # 1 report: 0.3, 5 reports: 0.5, 10 reports: 0.6, 50 reports: 0.75, 100 reports: 0.8, 500 reports: 0.9, 1000+ reports: 0.95
            base = 0.25
            growth = 0.25 * math.log10(volume + 1)  # Logarithmic growth
            bonus = min(0.45, 0.1 * math.sqrt(volume / 10))  # Square root bonus for higher volumes
            return min(0.95, base + growth + bonus)
        
        elif source == 'social':
            # Social media: moderate scaling with volume rewards
            # 1 report: 0.2, 5 reports: 0.35, 10 reports: 0.45, 50 reports: 0.6, 100 reports: 0.7, 500+ reports: 0.8
            base = 0.15
            growth = 0.2 * math.log10(volume + 1)
            bonus = min(0.35, 0.08 * math.sqrt(volume / 5))
            return min(0.8, base + growth + bonus)
        
        else:
            # Unknown sources: conservative but still dynamic
            base = 0.1
            growth = 0.15 * math.log10(volume + 1)
            return min(0.5, base + growth)
        
        return final_confidence
    
    def _calculate_source_diversity_boost(self, unique_sources: set, num_sources: int) -> float:
        """Calculate confidence boost based on source diversity and total activity"""
        # Single source: minimal boost
        if num_sources == 1:
            return 1.0
        
        # Two sources: good boost
        if num_sources == 2:
            boost = 1.5
        
        # Three sources: significant boost
        elif num_sources == 3:
            boost = 2.0
        
        # Four or more sources: major boost
        elif num_sources >= 4:
            boost = 2.5
        
        # Extra boost for high-value source combinations
        if 'incois' in unique_sources:
            if 'citizen' in unique_sources:
                boost += 0.3  # Official + Citizen confirmation
            if 'lora' in unique_sources:
                boost += 0.4  # Official + Emergency device
        
        if 'lora' in unique_sources and 'citizen' in unique_sources:
            boost += 0.2  # Emergency device + Citizen reports
        
        # Cap the maximum boost to prevent unrealistic confidence
        return min(3.0, boost)
    
    def _calculate_media_evidence_boost(self, verified_media_count: int, total_media_count: int) -> float:
        """Calculate confidence boost based on visual evidence quality"""
        if total_media_count == 0:
            return 1.0  # No media, no boost
        
        # Base boost for having any media
        base_media_boost = 1.2  # +20% for having visual evidence
        
        # Additional boost for verified media
        verification_ratio = verified_media_count / total_media_count
        verification_boost = 1.0 + (verification_ratio * 0.5)  # Up to +50% for 100% verified
        
        # Volume boost for multiple verified images
        if verified_media_count >= 3:
            volume_boost = 1.3  # +30% for multiple verified images
        elif verified_media_count >= 2:
            volume_boost = 1.2  # +20% for two verified images
        else:
            volume_boost = 1.0
        
        total_boost = base_media_boost * verification_boost * volume_boost
        
        # Cap to prevent over-boosting
        return min(2.5, total_boost)

    def determine_consensus_hazard_type(self, reports: List[Dict]) -> str:
        """Determine consensus hazard type from multiple reports"""
        if not reports:
            return 'unknown'
        
        # Weighted voting for hazard type
        hazard_votes = {}
        
        for report in reports:
            hazard_type = report.get('nlp_type', 'unknown')
            source = report.get('source', 'unknown').lower()
            nlp_conf = report.get('nlp_conf', 0.5)
            credibility = report.get('credibility', 0.5)
            
            # Vote weight = source reliability × NLP confidence × credibility
            source_weight = self.source_weights.get(source, 0.3)
            vote_weight = source_weight * nlp_conf * credibility
            
            if hazard_type in hazard_votes:
                hazard_votes[hazard_type] += vote_weight
            else:
                hazard_votes[hazard_type] = vote_weight
        
        # Return hazard type with highest weighted votes
        if hazard_votes:
            return max(hazard_votes, key=hazard_votes.get)
        
        return 'unknown'

    def calculate_weighted_severity(self, reports: List[Dict]) -> int:
        """Calculate weighted severity from multiple reports"""
        if not reports:
            return 1
        
        weighted_severities = []
        weights = []
        
        for report in reports:
            # Base severity from bulletins (if available) or estimated from NLP
            base_severity = 3  # Default moderate severity
            
            # For INCOIS bulletins, use provided severity
            if report.get('source') == 'incois' and 'severity' in report:
                base_severity = report['severity']
            
            # Apply NLP severity boost
            nlp_boost = report.get('severity_boost', 0)
            severity = min(base_severity + nlp_boost, 5)
            
            # Weight by source and credibility
            source = report.get('source', 'unknown').lower()
            source_weight = self.source_weights.get(source, 0.3)
            credibility = report.get('credibility', 0.5)
            
            weight = source_weight * credibility
            
            weighted_severities.append(severity)
            weights.append(weight)
        
        if not weighted_severities:
            return 1
        
        # Calculate weighted average severity
        weighted_avg = sum(s * w for s, w in zip(weighted_severities, weights)) / sum(weights)
        
        # Round to nearest integer and clamp to [1, 5]
        return max(1, min(5, round(weighted_avg)))

    def calculate_centroid(self, reports: List[Dict]) -> tuple[float, float]:
        """Calculate weighted centroid location"""
        if not reports:
            return 0.0, 0.0
        
        weighted_lat = 0.0
        weighted_lon = 0.0
        total_weight = 0.0
        
        for report in reports:
            lat = report.get('lat', 0.0)
            lon = report.get('lon', 0.0)
            
            # Weight by credibility and source reliability
            source = report.get('source', 'unknown').lower()
            source_weight = self.source_weights.get(source, 0.3)
            credibility = report.get('credibility', 0.5)
            
            weight = source_weight * credibility
            
            weighted_lat += lat * weight
            weighted_lon += lon * weight
            total_weight += weight
        
        if total_weight > 0:
            return weighted_lat / total_weight, weighted_lon / total_weight
        
        # Fallback to simple average
        avg_lat = sum(r.get('lat', 0.0) for r in reports) / len(reports)
        avg_lon = sum(r.get('lon', 0.0) for r in reports) / len(reports)
        return avg_lat, avg_lon

    def determine_status(self, confidence: float, hazard_type: str, 
                        has_lora: bool = False) -> str:
        """Determine hazard event status based on confidence and type"""
        # Emergency status for LoRa SOS
        if has_lora or hazard_type == 'emergency':
            return 'emergency'
        
        # High confidence events
        if confidence >= self.thresholds['emergency']:
            if hazard_type in ['tsunami', 'earthquake']:
                return 'emergency'
            else:
                return 'confirmed'
        
        # Medium confidence events
        if confidence >= self.thresholds['auto_alert']:
            return 'confirmed'
        
        # Low confidence events need review
        if confidence >= self.thresholds['review_required']:
            return 'pending'
        
        # Very low confidence
        return 'review'

    def calculate_priority_score(self, hazard_type: str, confidence: float, 
                               severity: int) -> float:
        """Calculate priority score for hazard event"""
        hazard_priority = self.hazard_priorities.get(hazard_type, 0.3)
        severity_factor = severity / 5.0  # Normalize to [0, 1]
        
        # Priority = hazard type weight × confidence × severity factor
        priority = hazard_priority * confidence * severity_factor
        
        return min(1.0, priority)

    def create_evidence_json(self, reports: List[Dict], group_stats: Dict) -> str:
        """Create evidence JSON for the fused hazard event"""
        evidence = {
            'report_count': len(reports),
            'source_distribution': group_stats.get('source_distribution', {}),
            'confidence_scores': [r.get('nlp_conf', 0.0) for r in reports],
            'credibility_scores': [r.get('credibility', 0.0) for r in reports],
            'report_ids': [r.get('id') for r in reports],
            'time_range': {
                'earliest': group_stats.get('earliest_time').isoformat() if group_stats.get('earliest_time') else None,
                'latest': group_stats.get('latest_time').isoformat() if group_stats.get('latest_time') else None
            },
            'unique_descriptions': group_stats.get('unique_descriptions', []),
            'keywords_found': []
        }
        
        # Collect all keywords found across reports
        all_keywords = []
        for report in reports:
            keywords = report.get('keywords_found', [])
            if isinstance(keywords, list):
                all_keywords.extend(keywords)
        
        evidence['keywords_found'] = list(set(all_keywords))  # Remove duplicates
        
        return json.dumps(evidence, default=str)

    def fuse_reports(self, reports: List[Dict], group_stats: Dict) -> FusionResult:
        """Main fusion function to create a hazard event from grouped reports"""
        if not reports:
            raise ValueError("Cannot fuse empty report list")
        
        # Check for LoRa emergency reports
        has_lora = any(r.get('source', '').lower() == 'lora' for r in reports)
        
        # Calculate fused properties
        hazard_type = self.determine_consensus_hazard_type(reports)
        confidence = self.calculate_weighted_confidence(reports)
        severity = self.calculate_weighted_severity(reports)
        centroid_lat, centroid_lon = self.calculate_centroid(reports)
        status = self.determine_status(confidence, hazard_type, has_lora)
        priority_score = self.calculate_priority_score(hazard_type, confidence, severity)
        evidence_json = self.create_evidence_json(reports, group_stats)
        
        return FusionResult(
            hazard_type=hazard_type,
            confidence=confidence,
            severity=severity,
            status=status,
            centroid_lat=centroid_lat,
            centroid_lon=centroid_lon,
            evidence={'json': evidence_json, 'dict': json.loads(evidence_json)},
            priority_score=priority_score
        )

    def should_create_alert(self, fusion_result: FusionResult) -> bool:
        """Determine if an automatic alert should be created"""
        return (fusion_result.confidence >= self.thresholds['auto_alert'] or 
                fusion_result.status == 'emergency')

    def get_fusion_explanation(self, fusion_result: FusionResult, 
                              report_count: int) -> str:
        """Generate explanation for fusion result"""
        parts = []
        
        # Report count
        parts.append(f"Fused from {report_count} report(s)")
        
        # Confidence level
        if fusion_result.confidence >= 0.8:
            parts.append("high confidence")
        elif fusion_result.confidence >= 0.6:
            parts.append("medium confidence")
        else:
            parts.append("low confidence")
        
        # Hazard type
        if fusion_result.hazard_type != 'unknown':
            parts.append(f"classified as {fusion_result.hazard_type}")
        
        # Severity
        severity_text = {1: "low", 2: "low-medium", 3: "medium", 
                        4: "high", 5: "critical"}
        parts.append(f"{severity_text.get(fusion_result.severity, 'unknown')} severity")
        
        # Status
        if fusion_result.status == 'emergency':
            parts.append("EMERGENCY status")
        elif fusion_result.status == 'confirmed':
            parts.append("auto-confirmed")
        else:
            parts.append("requires review")
        
        return "; ".join(parts)

# Singleton instance
fusion_engine = FusionEngine()