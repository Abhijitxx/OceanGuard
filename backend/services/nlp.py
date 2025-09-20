import re
import json
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

@dataclass
class NLPResult:
    hazard_type: str
    confidence: float
    severity_boost: int
    keywords_found: List[str]

class NLPProcessor:
    def __init__(self):
        # Hazard type keyword dictionaries (English + some transliterations)
        # Updated to focus on 5 main hazard types: floods, tsunami, tides, earthquakes, landslides
        self.hazard_keywords = {
            'flood': [
                'flood', 'flooding', 'water level', 'overflow', 'inundation', 'waterlogged',
                'submerg', 'drain', 'sewage', 'rain', 'monsoon', 'deluge', 'torrent',
                'heavy rain', 'downpour', 'cloudburst', 'river overflow', 'flash flood',
                'urban flooding', 'street flooding', 'water rising', 'high water',
                # Transliterations
                'baarish', 'paani', 'sel', 'jal', 'baadh'
            ],
            'tsunami': [
                'tsunami', 'tidal wave', 'sea surge', 'ocean wave', 'seismic wave',
                'underwater earthquake', 'sea level rise', 'giant wave', 'wall of water',
                'abnormal wave', 'huge wave', 'tidal surge', 'sea wall', 'marine surge',
                'oceanic wave', 'mega wave', 'killer wave', 'harbor wave',
                # Transliterations
                'sunami', 'samudri lahar', 'samudri toofan'
            ],
            'tides': [
                'high tide', 'low tide', 'tidal surge', 'tidal flooding', 'abnormal tide',
                'spring tide', 'neap tide', 'tide level', 'tidal bore', 'tidal wave',
                'unusual tide', 'extreme tide', 'king tide', 'storm tide', 'tidal current',
                'tide height', 'tidal inundation', 'coastal surge', 'tidal overflow',
                # Transliterations
                'jowar', 'bhata', 'samudri lehren'
            ],
            'earthquake': [
                'earthquake', 'tremor', 'quake', 'seismic', 'ground shaking', 'earth tremor',
                'shaking', 'vibration', 'ground movement', 'fault', 'epicenter', 'aftershock',
                'richter', 'magnitude', 'building shake', 'ground shake', 'seismic activity',
                'tectonic', 'trembling', 'earth movement', 'foreshock', 'mainshock',
                # Transliterations
                'bhukamp', 'zameen hilna', 'kampan', 'dharti hilna'
            ],
            'landslide': [
                'landslide', 'landslip', 'mudslide', 'rockslide', 'slope failure', 
                'mass wasting', 'debris flow', 'rock fall', 'cliff collapse', 'soil erosion',
                'hill collapse', 'mountain slide', 'embankment failure', 'slope instability',
                'avalanche', 'mudflow', 'earth movement', 'ground collapse', 'subsidence',
                # Transliterations
                'bhooskalan', 'pahad girna', 'mitti ka khisakna', 'zameen dhansna'
            ]
        }
        
        # Severity indicator keywords
        self.severity_keywords = {
            'high': ['emergency', 'urgent', 'critical', 'severe', 'dangerous', 'trapped', 
                    'injured', 'casualties', 'death', 'rescue', 'evacuate', 'siren'],
            'medium': ['warning', 'alert', 'caution', 'moderate', 'rising', 'increasing'],
            'low': ['minor', 'slight', 'mild', 'small', 'beginning', 'starting']
        }
        
        # Stopwords for preprocessing
        self.stopwords = {
            'english': ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                       'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
                       'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'],
            'hindi': ['aur', 'ka', 'ki', 'ke', 'mein', 'se', 'par', 'ko', 'hai', 'hain', 'tha', 'thi']
        }

    def preprocess_text(self, text: str) -> str:
        """Clean and normalize text"""
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters but keep spaces and basic punctuation
        text = re.sub(r'[^\w\s\-\.]', ' ', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove stopwords (basic implementation)
        words = text.split()
        filtered_words = []
        all_stopwords = set()
        for lang_stops in self.stopwords.values():
            all_stopwords.update(lang_stops)
        
        for word in words:
            if word not in all_stopwords and len(word) > 2:
                filtered_words.append(word)
        
        return ' '.join(filtered_words)

    def extract_hazard_type(self, text: str) -> Tuple[str, float, List[str]]:
        """Extract hazard type using keyword matching"""
        preprocessed_text = self.preprocess_text(text)
        
        hazard_scores = {}
        found_keywords = {}
        
        # Score each hazard type based on keyword matches
        for hazard_type, keywords in self.hazard_keywords.items():
            score = 0
            found = []
            
            for keyword in keywords:
                # Count exact matches and partial matches
                exact_matches = preprocessed_text.count(keyword)
                if exact_matches > 0:
                    score += exact_matches * 2  # Exact match gets higher weight
                    found.append(keyword)
                elif keyword in preprocessed_text:
                    score += 1  # Partial match
                    found.append(keyword)
            
            if score > 0:
                hazard_scores[hazard_type] = score
                found_keywords[hazard_type] = found
        
        if not hazard_scores:
            return 'unknown', 0.3, []
        
        # Get the hazard type with highest score
        best_hazard = max(hazard_scores, key=hazard_scores.get)
        max_score = hazard_scores[best_hazard]
        
        # Conservative base confidence for progressive system
        # Start with lower base confidence to allow for gradual building
        confidence = min(0.4 + (max_score * 0.05), 0.7)
        
        return best_hazard, confidence, found_keywords.get(best_hazard, [])

    def extract_severity_boost(self, text: str) -> int:
        """Extract severity indicators that boost the severity level"""
        preprocessed_text = self.preprocess_text(text)
        
        boost = 0
        
        # Check for high severity indicators
        for keyword in self.severity_keywords['high']:
            if keyword in preprocessed_text:
                boost += 2
                break  # Only count once per category
        
        # Check for medium severity indicators
        for keyword in self.severity_keywords['medium']:
            if keyword in preprocessed_text:
                boost += 1
                break
        
        # Cap the boost
        return min(boost, 2)

    def classify_text(self, text: str, source: str = 'citizen', has_media: bool = False, media_verified: bool = False) -> NLPResult:
        """Main classification function with progressive confidence and media verification"""
        if not text or not text.strip():
            return NLPResult(
                hazard_type='unknown',
                confidence=0.1,  # Lower for empty text
                severity_boost=0,
                keywords_found=[]
            )
        
        # Extract hazard type
        hazard_type, base_confidence, keywords = self.extract_hazard_type(text)
        
        # PROGRESSIVE CONFIDENCE: Apply source-based scaling
        confidence = self._apply_progressive_confidence(base_confidence, source)
        
        # MEDIA VERIFICATION BOOST: Apply image verification enhancement
        confidence = self._apply_media_verification_boost(confidence, has_media, media_verified)
        
        # Extract severity boost
        severity_boost = self.extract_severity_boost(text)
        
        return NLPResult(
            hazard_type=hazard_type,
            confidence=confidence,
            severity_boost=severity_boost,
            keywords_found=keywords
        )
    
    def _apply_progressive_confidence(self, base_confidence: float, source: str) -> float:
        """Apply progressive confidence scaling - start low for single reports"""
        # Source-based initial confidence scaling
        source_scaling = {
            'citizen': 0.25,      # Citizens start at 25% of base (0.08-0.25 range)
            'social_media': 0.20, # Social media even lower (0.06-0.20 range)  
            'incois': 0.80,       # Official sources much higher (0.24-0.80 range)
            'lora_sos': 0.95,     # Emergency devices highest (0.29-0.95 range)
        }
        
        scaling_factor = source_scaling.get(source.lower(), 0.25)
        scaled_confidence = base_confidence * scaling_factor
        
        # Ensure single citizen reports stay in low confidence range
        # They will increase through multi-source fusion
        if source.lower() in ['citizen', 'social_media']:
            scaled_confidence = max(0.08, min(0.35, scaled_confidence))
        elif source.lower() == 'incois':
            scaled_confidence = max(0.50, min(0.85, scaled_confidence))
        
        return scaled_confidence
    
    def _apply_media_verification_boost(self, base_confidence: float, has_media: bool, media_verified: bool) -> float:
        """Apply confidence boost for reports with verified images/media"""
        if not has_media:
            return base_confidence
        
        # Different boosts based on verification status
        if media_verified:
            # VERIFIED IMAGES: Significant confidence boost
            # A verified flood image can boost confidence from 0.2 to 0.8+
            media_boost = 0.6  # +60% absolute boost for verified images
            boosted_confidence = min(0.95, base_confidence + media_boost)
            
            print(f"📸 VERIFIED IMAGE BOOST: {base_confidence:.3f} → {boosted_confidence:.3f} (+{media_boost:.1f})")
            return boosted_confidence
        
        else:
            # UNVERIFIED MEDIA: Moderate boost (pending verification)
            # Still valuable as visual evidence, but not as strong
            media_boost = 0.15  # +15% absolute boost for unverified media
            boosted_confidence = min(0.7, base_confidence + media_boost)
            
            print(f"📷 UNVERIFIED MEDIA BOOST: {base_confidence:.3f} → {boosted_confidence:.3f} (+{media_boost:.1f})")
            return boosted_confidence

    def extract_location_mentions(self, text: str) -> List[str]:
        """Extract location mentions from text (basic implementation)"""
        preprocessed_text = self.preprocess_text(text)
        
        # Common location indicators
        location_patterns = [
            r'\b(near|at|in|around|beside|close to)\s+([a-zA-Z\s]+)',
            r'\b([a-zA-Z]+\s+(beach|coast|shore|river|area|district|zone))',
            r'\b(north|south|east|west|central)\s+([a-zA-Z\s]+)',
        ]
        
        locations = []
        for pattern in location_patterns:
            matches = re.findall(pattern, preprocessed_text, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple):
                    locations.extend([m.strip() for m in match if m.strip()])
                else:
                    locations.append(match.strip())
        
        return list(set(locations))  # Remove duplicates

# Singleton instance
nlp_processor = NLPProcessor()