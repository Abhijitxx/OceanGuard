import math
import re
from typing import List, Dict, Set, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class DedupeResult:
    group_id: int
    is_duplicate: bool
    similarity_score: float
    matched_reports: List[int]
    explanation: str

class DeduplicationEngine:
    def __init__(self):
        # Deduplication thresholds
        self.spatial_threshold_km = 5.0      # 5km radius
        self.temporal_threshold_minutes = 30  # 30 minutes
        self.text_similarity_threshold = 0.4  # Jaccard similarity
        self.combined_threshold = 0.6         # Combined score threshold
        
        # Weights for combined similarity
        self.weights = {
            'spatial': 0.4,
            'temporal': 0.3,
            'textual': 0.3
        }

    def haversine_distance(self, lat1: float, lon1: float, 
                          lat2: float, lon2: float) -> float:
        """Calculate the great circle distance between two points in kilometers"""
        # Convert latitude and longitude from degrees to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Haversine formula
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = (math.sin(dlat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2)
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of earth in kilometers
        r = 6371
        
        return r * c

    def spatial_similarity(self, lat1: float, lon1: float, 
                          lat2: float, lon2: float) -> float:
        """Calculate spatial similarity (0-1 scale)"""
        distance_km = self.haversine_distance(lat1, lon1, lat2, lon2)
        
        if distance_km > self.spatial_threshold_km:
            return 0.0
        
        # Linear decay from 1.0 at distance 0 to 0.0 at threshold
        similarity = 1.0 - (distance_km / self.spatial_threshold_km)
        return max(0.0, similarity)

    def temporal_similarity(self, time1: datetime, time2: datetime) -> float:
        """Calculate temporal similarity (0-1 scale)"""
        if not time1 or not time2:
            return 0.5  # Neutral score for missing timestamps
        
        # Ensure both timestamps are timezone-aware for comparison
        from datetime import timezone
        
        # Make timezone-aware if naive
        if time1.tzinfo is None:
            time1 = time1.replace(tzinfo=timezone.utc)
        if time2.tzinfo is None:
            time2 = time2.replace(tzinfo=timezone.utc)
        
        time_diff_minutes = abs((time2 - time1).total_seconds()) / 60
        
        if time_diff_minutes > self.temporal_threshold_minutes:
            return 0.0
        
        # Linear decay from 1.0 at time 0 to 0.0 at threshold
        similarity = 1.0 - (time_diff_minutes / self.temporal_threshold_minutes)
        return max(0.0, similarity)

    def jaccard_similarity(self, text1: str, text2: str) -> float:
        """Calculate Jaccard similarity between two texts"""
        if not text1 or not text2:
            return 0.0
        
        # Tokenize and normalize
        tokens1 = set(self._tokenize(text1.lower()))
        tokens2 = set(self._tokenize(text2.lower()))
        
        if not tokens1 and not tokens2:
            return 1.0
        
        if not tokens1 or not tokens2:
            return 0.0
        
        # Calculate Jaccard similarity
        intersection = len(tokens1.intersection(tokens2))
        union = len(tokens1.union(tokens2))
        
        return intersection / union if union > 0 else 0.0

    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization for text similarity"""
        # Remove punctuation and split into words
        text = re.sub(r'[^\w\s]', '', text)
        tokens = text.split()
        
        # Remove very short tokens
        tokens = [token for token in tokens if len(token) > 2]
        
        return tokens

    def textual_similarity(self, text1: str, text2: str) -> float:
        """Calculate textual similarity using Jaccard index"""
        return self.jaccard_similarity(text1, text2)

    def combined_similarity(self, report1: Dict, report2: Dict) -> float:
        """Calculate combined similarity score"""
        # Calculate individual similarities
        spatial_sim = self.spatial_similarity(
            report1['lat'], report1['lon'],
            report2['lat'], report2['lon']
        )
        
        temporal_sim = self.temporal_similarity(
            report1['timestamp'], report2['timestamp']
        )
        
        textual_sim = self.textual_similarity(
            report1['text'], report2['text']
        )
        
        # Calculate weighted average
        combined_score = (
            spatial_sim * self.weights['spatial'] +
            temporal_sim * self.weights['temporal'] +
            textual_sim * self.weights['textual']
        )
        
        return combined_score

    def find_duplicates(self, new_report: Dict, 
                       existing_reports: List[Dict]) -> DedupeResult:
        """Find duplicates for a new report against existing reports"""
        if not existing_reports:
            return DedupeResult(
                group_id=1,  # New group
                is_duplicate=False,
                similarity_score=0.0,
                matched_reports=[],
                explanation="First report in database"
            )
        
        best_match = None
        best_score = 0.0
        matched_reports = []
        
        # Compare with all existing reports
        for existing_report in existing_reports:
            similarity = self.combined_similarity(new_report, existing_report)
            
            if similarity >= self.combined_threshold:
                matched_reports.append(existing_report['id'])
                if similarity > best_score:
                    best_score = similarity
                    best_match = existing_report
        
        if best_match:
            # This is a duplicate
            explanation_parts = []
            
            # Explain why it's a duplicate
            spatial_sim = self.spatial_similarity(
                new_report['lat'], new_report['lon'],
                best_match['lat'], best_match['lon']
            )
            temporal_sim = self.temporal_similarity(
                new_report['timestamp'], best_match['timestamp']
            )
            textual_sim = self.textual_similarity(
                new_report['text'], best_match['text']
            )
            
            if spatial_sim > 0.7:
                distance = self.haversine_distance(
                    new_report['lat'], new_report['lon'],
                    best_match['lat'], best_match['lon']
                )
                explanation_parts.append(f"Same location ({distance:.1f}km apart)")
            
            if temporal_sim > 0.7:
                time_diff = abs((new_report['timestamp'] - best_match['timestamp']).total_seconds() / 60)
                explanation_parts.append(f"Similar time ({time_diff:.0f}min apart)")
            
            if textual_sim > 0.4:
                explanation_parts.append(f"Similar description ({textual_sim:.2f} similarity)")
            
            explanation = "; ".join(explanation_parts)
            
            return DedupeResult(
                group_id=best_match.get('group_id', best_match['id']),
                is_duplicate=True,
                similarity_score=best_score,
                matched_reports=matched_reports,
                explanation=explanation
            )
        
        else:
            # This is a new unique report
            # Generate new group ID (max existing group_id + 1)
            max_group_id = max([r.get('group_id', r['id']) for r in existing_reports], default=0)
            new_group_id = max_group_id + 1
            
            return DedupeResult(
                group_id=new_group_id,
                is_duplicate=False,
                similarity_score=best_score,
                matched_reports=[],
                explanation="Unique report - no duplicates found"
            )

    def group_reports(self, reports: List[Dict]) -> Dict[int, List[Dict]]:
        """Group all reports by similarity"""
        if not reports:
            return {}
        
        groups = {}
        processed_reports = []
        
        for report in reports:
            if report.get('group_id'):
                # Already has a group ID
                group_id = report['group_id']
            else:
                # Find duplicates among processed reports
                dedupe_result = self.find_duplicates(report, processed_reports)
                group_id = dedupe_result.group_id
                report['group_id'] = group_id
            
            if group_id not in groups:
                groups[group_id] = []
            
            groups[group_id].append(report)
            processed_reports.append(report)
        
        return groups

    def get_group_statistics(self, group_reports: List[Dict]) -> Dict:
        """Calculate statistics for a group of reports"""
        if not group_reports:
            return {}
        
        # Calculate centroid location
        avg_lat = sum(r['lat'] for r in group_reports) / len(group_reports)
        avg_lon = sum(r['lon'] for r in group_reports) / len(group_reports)
        
        # Get time range
        timestamps = [r['timestamp'] for r in group_reports if r.get('timestamp')]
        earliest_time = min(timestamps) if timestamps else None
        latest_time = max(timestamps) if timestamps else None
        
        # Count by source
        source_counts = {}
        for report in group_reports:
            source = report.get('source', 'unknown')
            source_counts[source] = source_counts.get(source, 0) + 1
        
        # Get all unique text content
        unique_texts = list(set(r['text'] for r in group_reports if r.get('text')))
        
        return {
            'count': len(group_reports),
            'centroid_lat': avg_lat,
            'centroid_lon': avg_lon,
            'earliest_time': earliest_time,
            'latest_time': latest_time,
            'source_distribution': source_counts,
            'unique_descriptions': unique_texts[:5],  # Top 5 unique descriptions
            'report_ids': [r['id'] for r in group_reports]
        }

# Singleton instance
dedupe_engine = DeduplicationEngine()