import re
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class CredibilityResult:
    score: float
    features: Dict[str, float]
    explanation: str

class CredibilityScorer:
    def __init__(self):
        # Source credibility weights
        self.source_weights = {
            'incois': 1.0,      # Official weather service
            'lora': 0.95,       # Emergency device
            'citizen': 0.6,     # Citizen report
            'social': 0.4,      # Social media
        }
        
        # Feature weights for credibility calculation
        self.feature_weights = {
            'source_reliability': 0.4,   # 40% - source type
            'has_media': 0.15,           # 15% - photo/video evidence
            'gps_accuracy': 0.15,        # 15% - GPS precision
            'text_quality': 0.15,        # 15% - text length and quality
            'temporal_consistency': 0.1,  # 10% - reasonable timestamp
            'past_accuracy': 0.05        # 5% - historical accuracy (future feature)
        }

    def score_source_reliability(self, source: str) -> float:
        """Score based on source type"""
        source = source.lower() if source else 'unknown'
        return self.source_weights.get(source, 0.3)

    def score_media_presence(self, media_path: Optional[str]) -> float:
        """Score based on media evidence"""
        if media_path and media_path.strip():
            return 0.8  # High credibility for media evidence
        return 0.2  # Low credibility without media

    def score_gps_accuracy(self, lat: float, lon: float, 
                          gps_accuracy: Optional[float] = None) -> float:
        """Score based on GPS accuracy and coordinate validity"""
        # Check if coordinates are valid (basic sanity check)
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return 0.0
        
        # Check if coordinates are too precise (suspicious)
        lat_precision = len(str(lat).split('.')[-1]) if '.' in str(lat) else 0
        lon_precision = len(str(lon).split('.')[-1]) if '.' in str(lon) else 0
        
        # Reasonable GPS precision is 4-6 decimal places
        if lat_precision > 8 or lon_precision > 8:
            return 0.3  # Too precise, might be fake
        
        if lat_precision < 2 or lon_precision < 2:
            return 0.4  # Too imprecise
        
        # If GPS accuracy is provided (in meters)
        if gps_accuracy is not None:
            if gps_accuracy <= 20:  # Very accurate GPS
                return 1.0
            elif gps_accuracy <= 50:  # Good GPS
                return 0.8
            elif gps_accuracy <= 100:  # Moderate GPS
                return 0.6
            else:  # Poor GPS
                return 0.3
        
        return 0.7  # Default for reasonable coordinates

    def score_text_quality(self, text: str) -> float:
        """Score based on text quality and informativeness"""
        if not text or not text.strip():
            return 0.0
        
        text = text.strip()
        text_length = len(text)
        word_count = len(text.split())
        
        # Length-based scoring
        length_score = 0.0
        if text_length >= 30:  # Minimum informative length
            length_score = 0.5
        if text_length >= 50:  # Good description
            length_score = 0.7
        if text_length >= 100:  # Detailed description
            length_score = 0.9
        if text_length > 500:  # Very long (might be spam)
            length_score = 0.6
        
        # Word diversity score
        unique_words = len(set(text.lower().split()))
        diversity_score = min(unique_words / max(word_count, 1), 1.0)
        
        # Check for spam patterns
        spam_patterns = [
            r'(.)\1{4,}',  # Repeated characters
            r'\b(\w+)\s+\1\b',  # Repeated words
            r'[!]{3,}',  # Multiple exclamation marks
            r'[A-Z]{10,}',  # All caps words
        ]
        
        spam_penalty = 0.0
        for pattern in spam_patterns:
            if re.search(pattern, text):
                spam_penalty += 0.1
        
        # Information content indicators
        info_indicators = [
            r'\b\d+\b',  # Numbers (quantities, times, etc.)
            r'\b(morning|evening|afternoon|night|am|pm)\b',  # Time references
            r'\b(near|at|in|around|beside)\b',  # Location references
            r'\b(level|height|depth|speed)\b',  # Measurement references
        ]
        
        info_bonus = 0.0
        for pattern in info_indicators:
            if re.search(pattern, text.lower()):
                info_bonus += 0.05
        
        final_score = min(
            max(length_score * 0.6 + diversity_score * 0.4 + info_bonus - spam_penalty, 0.0),
            1.0
        )
        
        return final_score

    def score_temporal_consistency(self, timestamp: datetime) -> float:
        """Score based on timestamp reasonableness"""
        if not timestamp:
            return 0.5  # Neutral score for missing timestamp
        
        # Ensure both timestamps are timezone-aware for comparison
        from datetime import timezone
        
        now = datetime.now(timezone.utc)
        
        # Make timestamp timezone-aware if it's naive
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        elif timestamp.tzinfo != timezone.utc:
            # Convert to UTC if it's in a different timezone
            timestamp = timestamp.astimezone(timezone.utc)
        
        time_diff = abs((now - timestamp).total_seconds())
        
        # Reports from future are suspicious
        if timestamp > now:
            return 0.1
        
        # Very recent reports (last hour) are highly credible
        if time_diff <= 3600:  # 1 hour
            return 1.0
        
        # Recent reports (last day) are credible
        if time_diff <= 86400:  # 24 hours
            return 0.9
        
        # Reports within a week are moderately credible
        if time_diff <= 604800:  # 7 days
            return 0.7
        
        # Old reports are less credible for real-time hazards
        if time_diff <= 2592000:  # 30 days
            return 0.4
        
        # Very old reports are suspicious
        return 0.2

    def score_past_accuracy(self, reporter_id: Optional[str]) -> float:
        """Score based on historical accuracy (placeholder for future ML)"""
        # TODO: Implement ML model to track reporter accuracy over time
        # For now, return neutral score
        return 0.5

    def calculate_credibility(self, 
                            source: str,
                            text: str,
                            lat: float,
                            lon: float,
                            timestamp: Optional[datetime] = None,
                            media_path: Optional[str] = None,
                            gps_accuracy: Optional[float] = None,
                            reporter_id: Optional[str] = None) -> CredibilityResult:
        """Calculate overall credibility score"""
        
        # Calculate individual feature scores
        features = {
            'source_reliability': self.score_source_reliability(source),
            'has_media': self.score_media_presence(media_path),
            'gps_accuracy': self.score_gps_accuracy(lat, lon, gps_accuracy),
            'text_quality': self.score_text_quality(text),
            'temporal_consistency': self.score_temporal_consistency(timestamp),
            'past_accuracy': self.score_past_accuracy(reporter_id)
        }
        
        # Calculate weighted average
        total_score = 0.0
        total_weight = 0.0
        
        for feature, score in features.items():
            weight = self.feature_weights[feature]
            total_score += score * weight
            total_weight += weight
        
        final_score = total_score / total_weight if total_weight > 0 else 0.0
        
        # Generate explanation
        explanation_parts = []
        if features['source_reliability'] >= 0.8:
            explanation_parts.append("Reliable source")
        elif features['source_reliability'] <= 0.4:
            explanation_parts.append("Unreliable source")
        
        if features['has_media'] >= 0.7:
            explanation_parts.append("has media evidence")
        
        if features['gps_accuracy'] >= 0.8:
            explanation_parts.append("accurate location")
        elif features['gps_accuracy'] <= 0.4:
            explanation_parts.append("poor location data")
        
        if features['text_quality'] >= 0.7:
            explanation_parts.append("detailed description")
        elif features['text_quality'] <= 0.4:
            explanation_parts.append("poor description quality")
        
        if features['temporal_consistency'] >= 0.8:
            explanation_parts.append("recent report")
        elif features['temporal_consistency'] <= 0.4:
            explanation_parts.append("outdated report")
        
        explanation = "; ".join(explanation_parts) if explanation_parts else "Average credibility"
        
        return CredibilityResult(
            score=final_score,
            features=features,
            explanation=explanation
        )

# Singleton instance
credibility_scorer = CredibilityScorer()