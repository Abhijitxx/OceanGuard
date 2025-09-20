#!/usr/bin/env python3
"""
OceanGuard FastAPI Backend
Real-time coastal hazard reporting and monitoring system
Using Supabase/PostgreSQL database
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import json
import asyncio
import os
from collections import defaultdict
import uuid
import base64
from io import BytesIO

# Import our database layer and models
from database import get_supabase, get_db, db_manager
from models import User, RawReport, HazardEvent, VolunteerRegistration, AdminValidation, RawBulletin

# Get Supabase client instance
supabase = get_supabase()

# Import our ML pipeline
from services.ingest import ProcessingPipeline

# Timezone utility functions
def get_current_timestamp():
    """Get current timestamp in ISO format with timezone info"""
    return datetime.now(timezone.utc).isoformat()

def get_local_timestamp():
    """Get current local timestamp in ISO format"""
    return datetime.now().isoformat()

app = FastAPI(
    title="OceanGuard API",
    description="Coastal Hazard Monitoring & Emergency Response System",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ML pipeline
pipeline = ProcessingPipeline()

# Real-time event broadcasting
active_connections = set()
notification_counters = defaultdict(int)

# Pydantic models for API requests/responses
class UserRegistration(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    role: Optional[str] = "citizen"
    picture: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str]
    address: Optional[str]
    emergency_contact: Optional[str]
    role: str
    picture: Optional[str]
    registered_at: str

class ReportSubmission(BaseModel):
    text: str
    lat: float
    lon: float
    media_path: Optional[str] = None
    user_name: Optional[str] = None
    user_session_id: Optional[str] = None

class ReportResponse(BaseModel):
    id: str
    message: str
    report_id: str
    confidence: Optional[float] = None

class HazardEventResponse(BaseModel):
    id: str
    hazard_type: str
    severity: str
    status: str
    centroid_lat: float
    centroid_lon: float
    confidence: float
    evidence_json: Optional[dict]
    created_at: str
    validated: bool

# Database helper functions
def get_supabase_client():
    """Get Supabase client"""
    return get_supabase()

def check_incois_correlation(report_timestamp, citizen_hazard_type, db: Session):
    """
    Check if citizen report correlates with recent INCOIS bulletins
    Returns correlation info with confidence boost/penalty
    """
    from datetime import datetime, timedelta
    
    # Parse report timestamp
    try:
        if isinstance(report_timestamp, str):
            # Handle different timestamp formats
            if 'T' in report_timestamp:
                report_time = datetime.fromisoformat(report_timestamp.replace('Z', '+00:00'))
            else:
                report_time = datetime.fromisoformat(report_timestamp)
        else:
            report_time = report_timestamp
    except Exception as e:
        print(f"Warning: Could not parse timestamp {report_timestamp}: {e}")
        return {'correlation': 0, 'boost': 0.0, 'type': 'none', 'matching_bulletins': 0}
    
    # Look for INCOIS bulletins within 72 hours before report
    time_window_start = report_time - timedelta(hours=72)
    time_window_end = report_time + timedelta(hours=6)
    
    # Query recent bulletins using SQLAlchemy/Supabase
    recent_bulletins = db.query(RawBulletin).filter(
        RawBulletin.issued_at >= time_window_start,
        RawBulletin.issued_at <= time_window_end
    ).order_by(RawBulletin.issued_at.desc()).limit(20).all()
    
    print(f"🔍 Checking INCOIS correlation for {citizen_hazard_type}")
    print(f"   Time window: {time_window_start.strftime('%Y-%m-%d %H:%M')} to {time_window_end.strftime('%Y-%m-%d %H:%M')}")
    print(f"   Found {len(recent_bulletins)} bulletins in window")
    
    if not recent_bulletins:
        return {'correlation': 0, 'boost': 0.0, 'type': 'none', 'matching_bulletins': 0}
    
    # Analyze correlation
    matching_bulletins = []
    conflicting_bulletins = []
    
    # Hazard type mapping for broader matching
    hazard_groups = {
        'flood': ['flood', 'tsunami', 'tides'],
        'tsunami': ['tsunami', 'flood', 'earthquake'],
        'tides': ['tides', 'flood', 'tsunami'],
        'earthquake': ['earthquake', 'tsunami', 'landslide'],
        'landslide': ['landslide', 'earthquake', 'flood']
    }
    
    related_types = hazard_groups.get(citizen_hazard_type.lower(), [citizen_hazard_type.lower()])
    
    for bulletin in recent_bulletins:
        bulletin_type = bulletin.hazard_type.lower()
        
        # Check for matches
        if bulletin_type in related_types or citizen_hazard_type.lower() in bulletin_type:
            matching_bulletins.append(bulletin)
        # Check for conflicts (high severity bulletin of different type)
        elif bulletin.severity and bulletin.severity >= 4:
            conflicting_bulletins.append(bulletin)
    
    # Calculate correlation score
    if matching_bulletins:
        # Strong positive correlation
        correlation_score = min(0.95, 0.6 + (len(matching_bulletins) * 0.1))
        boost = 0.3  # 30% confidence boost
        correlation_type = 'strong_match'
        
        # Higher boost for exact type matches
        exact_matches = [b for b in matching_bulletins if b.hazard_type.lower() == citizen_hazard_type.lower()]
        if exact_matches:
            boost = 0.4  # 40% boost for exact matches
            correlation_type = 'exact_match'
            
        print(f"   ✅ Strong correlation: {len(matching_bulletins)} matching bulletins")
        return {
            'correlation': correlation_score,
            'boost': boost,
            'type': correlation_type,
            'matching_bulletins': len(matching_bulletins)
        }
    
    elif conflicting_bulletins:
        # Weak negative correlation
        penalty = -0.1  # 10% penalty
        print(f"   ⚠️ Weak conflict: {len(conflicting_bulletins)} conflicting bulletins")
        return {
            'correlation': 0.3,
            'boost': penalty,
            'type': 'weak_conflict',
            'matching_bulletins': 0
        }
    
    else:
        # No correlation
        print(f"   ℹ️ No correlation found")
        return {
            'correlation': 0.5,
            'boost': 0.0,
            'type': 'no_correlation',
            'matching_bulletins': 0
        }

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List = []

    async def connect(self, websocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.copy():
            try:
                await connection.send_text(message)
            except:
                self.active_connections.remove(connection)

manager = ConnectionManager()

# API Routes
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "🌊 OceanGuard API is running",
        "version": "1.0.0",
        "status": "healthy",
        "database": "Supabase PostgreSQL",
        "timestamp": get_current_timestamp()
    }

@app.get("/api/events")
async def get_events():
    """Server-sent events endpoint for real-time updates"""
    async def event_generator():
        while True:
            # Yield current timestamp as heartbeat
            yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': get_current_timestamp()})}\n\n"
            await asyncio.sleep(30)
    
    return StreamingResponse(event_generator(), media_type="text/plain")

@app.post("/api/users/register", response_model=UserResponse)
async def register_user(user: UserRegistration, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Create new user
        new_user = User(
            name=user.name,
            email=user.email,
            phone=user.phone,
            address=user.address,
            emergency_contact=user.emergency_contact,
            role=user.role or 'citizen',
            picture=user.picture
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return UserResponse(
            id=str(new_user.id),
            name=new_user.name,
            email=new_user.email,
            phone=new_user.phone,
            address=new_user.address,
            emergency_contact=new_user.emergency_contact,
            role=new_user.role,
            picture=new_user.picture,
            registered_at=new_user.created_at.isoformat()
        )
        
    except Exception as e:
        print(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to register user: {str(e)}")

@app.post("/api/reports", response_model=ReportResponse)
async def submit_report(
    report: ReportSubmission, 
    background_tasks: BackgroundTasks
):
    """Submit a new hazard report using Supabase client"""
    try:
        supabase = get_supabase()
        
        # Create new raw report data
        report_data = {
            "source": "citizen_app",
            "text": report.text,
            "lat": report.lat,
            "lon": report.lon,
            "media_path": report.media_path,
            "has_media": bool(report.media_path),
            "user_name": report.user_name,
            "user_session_id": report.user_session_id,
            "processed": False,
            "created_at": get_current_timestamp(),
            "timestamp": get_current_timestamp()
        }
        
        # Insert into Supabase
        response = supabase.table('raw_reports').insert(report_data).execute()
        
        if not response.data:
            raise Exception("Failed to insert report into database")
        
        new_report = response.data[0]
        report_id = str(new_report['id'])
        
        # Process report in background
        background_tasks.add_task(process_report_background, report_id)
        
        return ReportResponse(
            id=report_id,
            message="Report submitted successfully",
            report_id=report_id,
            confidence=None
        )
        
    except Exception as e:
        print(f"Error submitting report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {str(e)}")

async def process_report_background(report_id: str):
    """Background task to process submitted report"""
    try:
        # This would integrate with your ML pipeline
        print(f"🔄 Processing report {report_id} in background...")
        # Add your processing logic here
        
    except Exception as e:
        print(f"Error processing report {report_id}: {e}")

@app.get("/api/hazards")
async def get_hazards(limit: int = 50):
    """Get all hazard events using Supabase client"""
    try:
        supabase = get_supabase()
        
        # Query hazards using Supabase client
        response = supabase.table('hazard_events').select('*').order('created_at', desc=True).limit(limit).execute()
        
        result = []
        for hazard in response.data:
            result.append({
                "id": str(hazard['id']),
                "hazard_type": hazard.get('hazard_type', ''),
                "severity": hazard.get('severity', ''),
                "status": hazard.get('status', ''),
                "centroid_lat": hazard.get('centroid_lat', 0),
                "centroid_lon": hazard.get('centroid_lon', 0),
                "confidence": hazard.get('confidence', 0),
                "created_at": hazard.get('created_at'),
                "updated_at": hazard.get('updated_at')
            })
        
        return result
        
    except Exception as e:
        print(f"Error fetching hazards: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch hazards: {str(e)}")

@app.get("/api/raw-reports")
async def get_raw_reports(limit: int = 50):
    """Get raw reports using Supabase client"""
    try:
        supabase = get_supabase()
        
        # Query reports using Supabase client
        response = supabase.table('raw_reports').select('*').order('created_at', desc=True).limit(limit).execute()
        
        result = []
        for report in response.data:
            result.append({
                "id": str(report['id']),
                "source": report.get('source', ''),
                "text": report.get('text', ''),
                "lat": report.get('lat', 0),
                "lon": report.get('lon', 0),
                "timestamp": report.get('timestamp') or report.get('created_at'),
                "processed": report.get('processed', False),
                "user_name": report.get('user_name', ''),
                "nlp_type": report.get('nlp_type', ''),
                "nlp_conf": report.get('nlp_conf', 0),
                "credibility": report.get('credibility', 0)
            })
        
        return result
        
    except Exception as e:
        print(f"Error fetching raw reports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")

@app.get("/api/incois-bulletins")
async def get_incois_bulletins(limit: int = 20):
    """Get INCOIS bulletins"""
    try:
        # Get bulletins using Supabase client
        result = supabase.table('raw_bulletins').select('*').order('issued_at', desc=True).limit(limit).execute()
        
        formatted_result = []
        for bulletin in result.data:
            formatted_result.append({
                "id": str(bulletin.get('id')),
                "source": bulletin.get('source'),
                "hazard_type": bulletin.get('hazard_type'),
                "severity": bulletin.get('severity'),
                "description": bulletin.get('description'),
                "area_affected": bulletin.get('area_affected'),
                "lat": bulletin.get('lat'),
                "lon": bulletin.get('lon'),
                "bulletin_id": bulletin.get('bulletin_id'),
                "issued_at": bulletin.get('issued_at')
            })
        
        return formatted_result
        
    except Exception as e:
        print(f"Error fetching bulletins: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch bulletins: {str(e)}")

# Add more endpoints as needed...

# Citizen-specific API endpoints
@app.post("/api/citizen/submit-report")
async def citizen_submit_report(request: Request):
    """Submit a new hazard report from citizen"""
    try:
        data = await request.json()
        print(f"Received citizen report data: {data}")
        
        # Insert using Supabase client with correct column names
        result = supabase.table('raw_reports').insert({
            'source': 'citizen_app',
            'text': data.get('description', data.get('text', '')),
            'lat': float(data.get('lat', 0)),
            'lon': float(data.get('lon', 0)),
            'user_name': data.get('user_name', 'Anonymous'),
            'user_session_id': data.get('user_session_id'),
            'media_path': data.get('photos', [None])[0] if data.get('photos') else None,
            'has_media': bool(data.get('photos'))
        }).execute()
        
        return {"success": True, "message": "Report submitted successfully", "id": result.data[0]['id']}
    except Exception as e:
        print(f"Error submitting citizen report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/citizen/hazard-feed")
async def citizen_hazard_feed():
    """Get current hazards for citizen dashboard"""
    try:
           # Get verified hazards using Supabase client
           result = supabase.table('hazard_events').select('*').eq('status', 'active').execute()
           return {"hazards": result.data}
    except Exception as e:
        print(f"Error fetching citizen hazard feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/citizen/my-reports")
async def citizen_my_reports(user_id: str = None):
    """Get reports submitted by the citizen"""
    try:
        if user_id:
            result = supabase.table('raw_reports').select('*').eq('reporter_id', user_id).execute()
        else:
            # If no user_id, return recent reports
            result = supabase.table('raw_reports').select('*').order('created_at', desc=True).limit(10).execute()
        return {"reports": result.data}
    except Exception as e:
        print(f"Error fetching citizen reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/citizen/notifications")
async def citizen_notifications(user_id: str = None):
    """Get notifications for citizen"""
    try:
        # For now, return empty notifications - can be enhanced later
        return {"notifications": []}
    except Exception as e:
        print(f"Error fetching citizen notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# File Upload Endpoints
@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file to Supabase Storage"""
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        # Read file content
        file_content = await file.read()

        # Upload to Supabase Storage
        bucket_name = "hazard-media"  # You need to create this bucket in Supabase
        
        # Upload the file
        # Perform a straightforward upload to Supabase Storage
        upload_result = supabase.storage.from_(bucket_name).upload(
            path=f"reports/{unique_filename}",
            file=file_content,
            file_options={"content-type": file.content_type}
        )

        # DEBUG: print full upload_result for troubleshooting
        print("DEBUG upload_result:", upload_result)

        # The Supabase Python client may return an UploadResponse object or a dict.
        # Normalize checks to support both shapes.
        error = None
        try:
            # UploadResponse has attributes; try to access common ones
            error = getattr(upload_result, 'error', None)
        except Exception:
            error = None

        # If upload_result behaves like a dict, check for key
        if (not error) and isinstance(upload_result, dict):
            error = upload_result.get('error') or upload_result.get('msg') or upload_result.get('message')

        if error:
            # Attach representation for debugging
            raise HTTPException(status_code=500, detail=f"Upload failed: {error}")

        # Determine the storage path returned by the client so we can build a public URL.
        storage_path = None
        try:
            storage_path = getattr(upload_result, 'path', None) or getattr(upload_result, 'full_path', None) or getattr(upload_result, 'fullPath', None)
        except Exception:
            storage_path = None

        # If we didn't get a path from the response, fall back to the path we uploaded to.
        if not storage_path:
            storage_path = f"reports/{unique_filename}"

        # Get public URL (returns dict with 'publicUrl' or a string depending on client version)
        public_url_resp = supabase.storage.from_(bucket_name).get_public_url(storage_path)

        public_url = None
        # Normalize public_url_resp
        try:
            if isinstance(public_url_resp, dict):
                # Different versions return either 'publicUrl' or 'public_url'
                public_url = public_url_resp.get('publicUrl') or public_url_resp.get('public_url') or public_url_resp.get('url')
            else:
                # Some clients return a simple object with 'public_url' attribute
                public_url = getattr(public_url_resp, 'public_url', None) or getattr(public_url_resp, 'publicUrl', None)
        except Exception:
            public_url = None

        # As a last resort, construct a URL using SUPABASE_URL env + storage path (useful for public buckets)
        if not public_url:
            supabase_url = os.getenv('SUPABASE_URL', '').rstrip('/')
            if supabase_url:
                public_url = f"{supabase_url}/storage/v1/object/public/{bucket_name}/{storage_path}"

        return {
            "success": True,
            "file_url": public_url,
            "filename": unique_filename,
            "message": "File uploaded successfully"
        }
        
    except Exception as e:
        print(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/citizen/submit-report-with-media")
async def submit_report_with_media(
    report_data: str = Form(...),
    images: List[UploadFile] = File(None)
):
    """Submit a hazard report with optional image uploads"""
    try:
        # Parse the report data
        data = json.loads(report_data)
        print(f"Received report with media: {data}")
        
        uploaded_images = []
        
        # Upload images if provided
        if images:
            for image in images:
                if image.content_type and image.content_type.startswith('image/'):
                    # Generate unique filename
                    file_extension = image.filename.split('.')[-1] if '.' in image.filename else 'jpg'
                    unique_filename = f"{uuid.uuid4()}.{file_extension}"
                    
                    # Read file content
                    file_content = await image.read()
                    
                    # Upload to Supabase Storage
                    bucket_name = "hazard-media"
                    
                    upload_result = supabase.storage.from_(bucket_name).upload(
                        path=f"reports/{unique_filename}",
                        file=file_content,
                        file_options={"content-type": image.content_type}
                    )
                    
                    if not upload_result.error:
                        # Get public URL
                        public_url = supabase.storage.from_(bucket_name).get_public_url(f"reports/{unique_filename}")
                        uploaded_images.append({
                            "url": public_url,
                            "filename": unique_filename,
                            "content_type": image.content_type
                        })
        
        # Insert report with image URLs
        result = supabase.table('raw_reports').insert({
            'source': 'citizen_app',
            'text': data.get('description', ''),
            'lat': float(data.get('lat', 0)),
            'lon': float(data.get('lon', 0)),
            'user_name': data.get('user_name', 'Anonymous'),
            'user_session_id': data.get('user_session_id'),
            'media_path': uploaded_images[0]['url'] if uploaded_images else None,
            'has_media': len(uploaded_images) > 0
        }).execute()
        
        return {
            "success": True, 
            "message": "Report submitted successfully", 
            "id": result.data[0]['id'],
            "uploaded_images": len(uploaded_images)
        }
        
    except Exception as e:
        print(f"Error submitting report with media: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    
    # Initialize database tables
    print("🚀 Starting OceanGuard API with Supabase...")
    try:
        db_manager.create_tables()
        print("✅ Database tables verified")
    except Exception as e:
        print(f"⚠️ Database initialization warning: {e}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)