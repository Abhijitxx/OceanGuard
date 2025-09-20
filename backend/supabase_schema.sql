-- OceanGuard Database Schema for Supabase
-- Run these commands in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Users table with enhanced authentication support
CREATE TABLE public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    emergency_contact TEXT,
    role TEXT DEFAULT 'citizen' CHECK (role IN ('admin', 'citizen', 'volunteer')),
    picture TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw reports table with enhanced media support
CREATE TABLE public.raw_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source TEXT NOT NULL,
    text TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326), -- PostGIS geography for better spatial queries
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    media_path TEXT,
    has_media BOOLEAN DEFAULT false,
    media_verified BOOLEAN DEFAULT false,
    media_confidence REAL,
    processed BOOLEAN DEFAULT false,
    nlp_type TEXT,
    nlp_conf REAL,
    credibility REAL,
    group_id INTEGER,
    user_id UUID REFERENCES public.users(id),
    user_name TEXT,
    user_session_id TEXT, -- For anonymous reports
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hazard events table with enhanced confidence tracking
CREATE TABLE public.hazard_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hazard_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'resolved', 'emergency')),
    
    -- Geographic data
    centroid_lat REAL NOT NULL,
    centroid_lon REAL NOT NULL,
    location GEOGRAPHY(POINT, 4326), -- PostGIS geography
    
    -- Confidence scoring
    confidence REAL DEFAULT 0.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    incois_contribution REAL DEFAULT 0.0,
    citizen_contribution REAL DEFAULT 0.0,
    social_media_contribution REAL DEFAULT 0.0,
    iot_contribution REAL DEFAULT 0.0,
    
    -- Evidence and metadata
    evidence_json JSONB, -- Better JSON support in PostgreSQL
    source_count INTEGER DEFAULT 0,
    validated BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Volunteer registrations table
CREATE TABLE public.volunteer_registrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    emergency_contact TEXT,
    skills TEXT[],  -- Array of skills
    availability JSONB, -- Flexible availability data
    is_active BOOLEAN DEFAULT true,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin validations table
CREATE TABLE public.admin_validations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hazard_id UUID REFERENCES public.hazard_events(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.users(id),
    action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'escalate', 'modify')),
    notes TEXT,
    previous_values JSONB, -- Store what was changed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw bulletins table (INCOIS data)
CREATE TABLE public.raw_bulletins (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source TEXT DEFAULT 'INCOIS',
    hazard_type TEXT NOT NULL,
    severity INTEGER CHECK (severity >= 1 AND severity <= 5),
    description TEXT NOT NULL,
    area_affected TEXT,
    location GEOGRAPHY(POINT, 4326),
    lat REAL,
    lon REAL,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    bulletin_id TEXT UNIQUE, -- External bulletin ID
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_raw_reports_location ON public.raw_reports USING GIST (location);
CREATE INDEX idx_raw_reports_timestamp ON public.raw_reports (timestamp);
CREATE INDEX idx_raw_reports_user_id ON public.raw_reports (user_id);
CREATE INDEX idx_raw_reports_processed ON public.raw_reports (processed);

CREATE INDEX idx_hazard_events_location ON public.hazard_events USING GIST (location);
CREATE INDEX idx_hazard_events_type_status ON public.hazard_events (hazard_type, status);
CREATE INDEX idx_hazard_events_confidence ON public.hazard_events (confidence);
CREATE INDEX idx_hazard_events_created_at ON public.hazard_events (created_at);

CREATE INDEX idx_users_email ON public.users (email);
CREATE INDEX idx_users_role ON public.users (role);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_raw_reports_updated_at BEFORE UPDATE ON public.raw_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hazard_events_updated_at BEFORE UPDATE ON public.hazard_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_volunteer_registrations_updated_at BEFORE UPDATE ON public.volunteer_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_validations ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be refined later)
-- Users can read their own data
CREATE POLICY "Users can read own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Reports policies - anyone can read, authenticated users can insert
CREATE POLICY "Anyone can read reports" ON public.raw_reports FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reports" ON public.raw_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own reports" ON public.raw_reports FOR UPDATE USING (auth.uid() = user_id);

-- Hazard events - readable by all, only admins can modify
CREATE POLICY "Anyone can read hazard events" ON public.hazard_events FOR SELECT USING (true);
CREATE POLICY "Only admins can modify hazard events" ON public.hazard_events FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Admin validations - only admins
CREATE POLICY "Only admins can access validations" ON public.admin_validations FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);