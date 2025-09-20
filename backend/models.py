from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String)
    address = Column(String)
    emergency_contact = Column(String)
    role = Column(String, default='citizen')  # 'admin', 'citizen', 'volunteer'
    picture = Column(String)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    reports = relationship("RawReport", back_populates="user")
    volunteer_registration = relationship("VolunteerRegistration", back_populates="user", uselist=False)
    admin_validations = relationship("AdminValidation", back_populates="admin")

class RawReport(Base):
    __tablename__ = 'raw_reports'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    source = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    media_path = Column(String, nullable=True)
    has_media = Column(Boolean, default=False)
    media_verified = Column(Boolean, default=False)
    media_confidence = Column(Float, nullable=True)
    processed = Column(Boolean, default=False)
    nlp_type = Column(String, nullable=True)
    nlp_conf = Column(Float, nullable=True)
    credibility = Column(Float, nullable=True)
    group_id = Column(Integer, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    user_name = Column(String, nullable=True)
    user_session_id = Column(String, nullable=True)  # For anonymous reports
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="reports")

class HazardEvent(Base):
    __tablename__ = 'hazard_events'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    hazard_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # 'low', 'medium', 'high', 'critical'
    status = Column(String, default='pending')  # 'pending', 'active', 'resolved', 'emergency'
    
    # Geographic data
    centroid_lat = Column(Float, nullable=False)
    centroid_lon = Column(Float, nullable=False)
    
    # Confidence scoring
    confidence = Column(Float, default=0.0)
    incois_contribution = Column(Float, default=0.0)
    citizen_contribution = Column(Float, default=0.0)
    social_media_contribution = Column(Float, default=0.0)
    iot_contribution = Column(Float, default=0.0)
    
    # Evidence and metadata
    evidence_json = Column(JSONB)
    source_count = Column(Integer, default=0)
    validated = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    validations = relationship("AdminValidation", back_populates="hazard_event")

class VolunteerRegistration(Base):
    __tablename__ = 'volunteer_registrations'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String)
    address = Column(String, nullable=False)
    emergency_contact = Column(String)
    skills = Column(ARRAY(String))  # PostgreSQL array of skills
    availability = Column(JSONB)  # JSONB for flexible availability data
    is_active = Column(Boolean, default=True)
    verification_status = Column(String, default='pending')  # 'pending', 'verified', 'rejected'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="volunteer_registration")

class AdminValidation(Base):
    __tablename__ = 'admin_validations'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    hazard_id = Column(UUID(as_uuid=True), ForeignKey('hazard_events.id'), nullable=False)
    admin_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    action = Column(String, nullable=False)  # 'approve', 'reject', 'escalate', 'modify'
    notes = Column(Text)
    previous_values = Column(JSONB)  # Store what was changed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    hazard_event = relationship("HazardEvent", back_populates="validations")
    admin = relationship("User", back_populates="admin_validations")

class RawBulletin(Base):
    __tablename__ = 'raw_bulletins'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    source = Column(String, default='INCOIS')
    hazard_type = Column(String, nullable=False)
    severity = Column(Integer)  # 1-5 scale
    description = Column(Text, nullable=False)
    area_affected = Column(String)
    lat = Column(Float)
    lon = Column(Float)
    valid_from = Column(DateTime(timezone=True))
    valid_until = Column(DateTime(timezone=True))
    bulletin_id = Column(String, unique=True)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
