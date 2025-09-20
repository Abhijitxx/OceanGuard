#!/usr/bin/env python3
"""
Initialize OceanGuard Database with Supabase
Creates all necessary tables and initial data
"""

import os
import sys
from dotenv import load_dotenv

# Add the current directory to Python path to import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import db_manager, get_supabase
from models import Base
import uuid
from datetime import datetime, timezone

def init_supabase_database():
    """Initialize the Supabase database with all required tables and sample data"""
    
    try:
        # Create tables using SQLAlchemy
        print("📊 Creating database tables...")
        db_manager.create_tables()
        
        # Get Supabase client for data insertion
        supabase = get_supabase()
        
        # Insert sample users
        print("👥 Creating sample users...")
        sample_users = [
            {
                'id': str(uuid.uuid4()),
                'name': 'Admin User',
                'email': 'admin@oceanguard.com',
                'phone': '+91-9876543210',
                'address': 'Chennai, India',
                'emergency_contact': '+91-9876543211',
                'role': 'admin',
                'picture': 'https://via.placeholder.com/100x100?text=Admin',
                'is_active': True,
                'email_verified': True
            },
            {
                'id': str(uuid.uuid4()),
                'name': 'Citizen User',
                'email': 'citizen@example.com',
                'phone': '+91-9876543212',
                'address': 'Mumbai, India',
                'emergency_contact': '+91-9876543213',
                'role': 'citizen',
                'picture': 'https://via.placeholder.com/100x100?text=Citizen',
                'is_active': True,
                'email_verified': False
            },
            {
                'id': str(uuid.uuid4()),
                'name': 'Volunteer User',
                'email': 'volunteer@example.com',
                'phone': '+91-9876543214',
                'address': 'Kochi, India',
                'emergency_contact': '+91-9876543215',
                'role': 'volunteer',
                'picture': 'https://via.placeholder.com/100x100?text=Volunteer',
                'is_active': True,
                'email_verified': True
            }
        ]
        
        for user in sample_users:
            result = supabase.table('users').insert(user).execute()
            print(f"   ✅ Created user: {user['email']}")
        
        # Insert sample hazard events
        print("🌊 Creating sample hazard events...")
        sample_hazards = [
            {
                'id': str(uuid.uuid4()),
                'hazard_type': 'tsunami',
                'severity': 'high',
                'status': 'active',
                'centroid_lat': 12.9716,
                'centroid_lon': 77.5946,
                'confidence': 0.85,
                'incois_contribution': 0.6,
                'citizen_contribution': 0.3,
                'social_media_contribution': 0.1,
                'evidence_json': {
                    'source_distribution': {
                        'incois': 2,
                        'citizen': 5,
                        'social': 1,
                        'iot': 0
                    },
                    'confidence_factors': {
                        'location_accuracy': 0.9,
                        'temporal_relevance': 0.8,
                        'source_credibility': 0.85
                    }
                },
                'source_count': 8,
                'validated': True
            },
            {
                'id': str(uuid.uuid4()),
                'hazard_type': 'flood',
                'severity': 'medium',
                'status': 'pending',
                'centroid_lat': 12.9116,
                'centroid_lon': 77.6648,
                'confidence': 0.72,
                'incois_contribution': 0.4,
                'citizen_contribution': 0.5,
                'social_media_contribution': 0.1,
                'evidence_json': {
                    'source_distribution': {
                        'incois': 1,
                        'citizen': 8,
                        'social': 2,
                        'iot': 1
                    },
                    'confidence_factors': {
                        'location_accuracy': 0.7,
                        'temporal_relevance': 0.9,
                        'source_credibility': 0.6
                    }
                },
                'source_count': 12,
                'validated': False
            },
            {
                'id': str(uuid.uuid4()),
                'hazard_type': 'earthquake',
                'severity': 'low',
                'status': 'resolved',
                'centroid_lat': 13.0827,
                'centroid_lon': 80.2707,
                'confidence': 0.68,
                'incois_contribution': 0.7,
                'citizen_contribution': 0.2,
                'social_media_contribution': 0.1,
                'evidence_json': {
                    'source_distribution': {
                        'incois': 3,
                        'citizen': 2,
                        'social': 1,
                        'iot': 2
                    },
                    'confidence_factors': {
                        'location_accuracy': 0.95,
                        'temporal_relevance': 0.6,
                        'source_credibility': 0.9
                    }
                },
                'source_count': 8,
                'validated': True
            }
        ]
        
        for hazard in sample_hazards:
            result = supabase.table('hazard_events').insert(hazard).execute()
            print(f"   ✅ Created hazard event: {hazard['hazard_type']} ({hazard['severity']})")
        
        # Insert sample raw reports
        print("📝 Creating sample raw reports...")
        sample_reports = [
            {
                'id': str(uuid.uuid4()),
                'source': 'citizen_app',
                'text': 'Heavy flooding observed in Marina Beach area. Water level rising rapidly.',
                'lat': 13.0475,
                'lon': 80.2824,
                'has_media': False,
                'processed': True,
                'nlp_type': 'flood',
                'nlp_conf': 0.9,
                'credibility': 0.8,
                'user_name': 'Anonymous Citizen'
            },
            {
                'id': str(uuid.uuid4()),
                'source': 'social_media',
                'text': 'Tsunami warning issued for coastal areas. Evacuations underway.',
                'lat': 12.9716,
                'lon': 77.5946,
                'has_media': True,
                'media_path': '/media/sample_tsunami.jpg',
                'media_verified': True,
                'media_confidence': 0.85,
                'processed': True,
                'nlp_type': 'tsunami',
                'nlp_conf': 0.95,
                'credibility': 0.9,
                'user_name': 'Local News'
            }
        ]
        
        for report in sample_reports:
            result = supabase.table('raw_reports').insert(report).execute()
            print(f"   ✅ Created raw report: {report['nlp_type']}")
        
        # Insert sample INCOIS bulletin
        print("📊 Creating sample INCOIS bulletin...")
        sample_bulletin = {
            'id': str(uuid.uuid4()),
            'source': 'INCOIS',
            'hazard_type': 'tsunami',
            'severity': 4,
            'description': 'High tsunami risk detected in Bay of Bengal. Coastal areas advised to remain alert.',
            'area_affected': 'Tamil Nadu, Andhra Pradesh coastal areas',
            'lat': 13.0827,
            'lon': 80.2707,
            'bulletin_id': 'INCOIS-2025-09-20-001',
            'valid_from': datetime.now(timezone.utc).isoformat(),
            'valid_until': datetime.now(timezone.utc).isoformat()
        }
        
        result = supabase.table('raw_bulletins').insert(sample_bulletin).execute()
        print(f"   ✅ Created INCOIS bulletin: {sample_bulletin['bulletin_id']}")
        
        print("\n🎉 Database initialization completed successfully!")
        print("✅ Created tables: users, raw_reports, hazard_events, volunteer_registrations, admin_validations, raw_bulletins")
        print("✅ Inserted sample data for testing")
        print(f"✅ Admin user: admin@oceanguard.com")
        print(f"✅ Citizen user: citizen@example.com")
        print(f"✅ Volunteer user: volunteer@example.com")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        raise

if __name__ == "__main__":
    # Load environment variables
    load_dotenv()
    
    # Check if required environment variables are set
    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_KEY"):
        print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file")
        print("📝 Please create a .env file based on .env.example")
        sys.exit(1)
    
    print("🌊 Initializing OceanGuard Database with Supabase...")
    init_supabase_database()