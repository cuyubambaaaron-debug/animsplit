CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS character_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    slot_number INT CHECK (slot_number BETWEEN 1 AND 10),
    name VARCHAR(255),
    reference_image_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, slot_number)
);

CREATE TABLE IF NOT EXISTS background_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    slot_number INT CHECK (slot_number BETWEEN 1 AND 10),
    name VARCHAR(255),
    reference_image_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, slot_number)
);

CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255),
    frame_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    total_api_calls INT DEFAULT 0,
    estimated_cost DECIMAL(10,4) DEFAULT 0,
    actual_cost DECIMAL(10,4) DEFAULT 0,
    processing_time_seconds INT,
    upload_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS video_elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    element_type VARCHAR(20),
    element_name VARCHAR(255),
    slot_id UUID,
    strategy VARCHAR(20) DEFAULT 'full',
    frames_processed INT DEFAULT 0,
    frames_copied INT DEFAULT 0,
    output_folder_url TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    element_id UUID REFERENCES video_elements(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'queued',
    current_frame INT DEFAULT 0,
    total_frames INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
