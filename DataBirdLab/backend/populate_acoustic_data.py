import sys
import os
import random
import json
from datetime import datetime
from sqlmodel import Session, select, text

# --- 1. Setup Python Path to find your 'app' module ---
# This allows the script to run from the root directory
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# --- 2. Import your App's specific modules ---
try:
    from app.database import engine, create_db_and_tables
    # Importing models ensures they are registered with SQLModel
    from app.models import Survey, MediaAsset, VisualDetection, AcousticDetection
except ImportError as e:
    print("❌ Error: Could not import 'app'. Make sure this file is in the project root.")
    print(f"Details: {e}")
    sys.exit(1)

# --- Configuration ---
ARU_LOCATIONS = [
    {"lat": 11.40655, "lon": 105.39677, "name": "ARU_North_Station"},
    {"lat": 11.40369, "lon": 105.39827, "name": "ARU_East_Wetland"},
    {"lat": 11.40617, "lon": 105.39701, "name": "ARU_North_Backup"},
]

SPECIES = [
    "asian_openbill", 
    "black_headed_ibis", 
    "painted_stork", 
    "spot_billed_pelican", 
    "little_cormorant"
]

def seed_data():
    print("🌱 Connecting to database via SQLModel...")
    
    # Ensure tables exist
    create_db_and_tables()

    with Session(engine) as session:

        # 2. Create Survey
        survey = Survey(
            name="ARU Survey",
            date=datetime.now(),
            type="Hybrid"
        )
        session.add(survey)
        session.commit()
        session.refresh(survey)
        print(f"✅ Created Survey: {survey.name} (ID: {survey.id})")

        # 3. Create ARU Assets (Audio)
        for i, aru in enumerate(ARU_LOCATIONS):
            # Audio asset (Point source: TL = BR)
            audio_asset = MediaAsset(
                survey_id=survey.id,
                file_path=f"/data/audio/aru_{i+1}.wav",
                lat_tl=aru["lat"], lon_tl=aru["lon"],
                lat_br=aru["lat"], lon_br=aru["lon"],
                is_processed=True,
                is_validated=True
            )
            session.add(audio_asset)
            session.commit()
            session.refresh(audio_asset)

            # Add Acoustic Detections
            num_detections = random.randint(3, 8)
            for _ in range(num_detections):
                detection = AcousticDetection(
                    asset_id=audio_asset.id,
                    class_name=random.choice(SPECIES),
                    confidence=random.uniform(0.65, 0.99),
                    start_time=random.uniform(0, 300),
                    end_time=random.uniform(0, 300) + 3.0,
                    is_human_reviewed=False
                )
                session.add(detection)
        
        print(f"✅ added ARU data.")

        # 4. Create Drone Assets (Visual) NEAR the ARUs
        for i, aru in enumerate(ARU_LOCATIONS):
            for j in range(2):
                # Offset coordinates slightly
                lat_offset = random.uniform(-0.0002, 0.0002)
                lon_offset = random.uniform(-0.0002, 0.0002)
                img_lat = aru["lat"] + lat_offset
                img_lon = aru["lon"] + lon_offset

                visual_asset = MediaAsset(
                    survey_id=survey.id,
                    file_path=f"/data/images/tile_{i}_{j}.jpg",
                    lat_tl=img_lat + 0.00005, lon_tl=img_lon - 0.00005,
                    lat_br=img_lat - 0.00005, lon_br=img_lon + 0.00005,
                    is_processed=True,
                    is_validated=False
                )
                session.add(visual_asset)
                session.commit()
                session.refresh(visual_asset)

                # Force a "Match" for the first item
                if i == 0 and j == 0:
                    det_species = "painted_stork"
                else:
                    det_species = random.choice(SPECIES)

                # Add Visual Detection
                bbox = [random.randint(100, 1000), random.randint(100, 1000), 50, 50]
                visual_det = VisualDetection(
                    asset_id=visual_asset.id,
                    confidence=random.uniform(0.7, 0.95),
                    class_name=det_species,
                    bbox_json=json.dumps(bbox)
                )
                session.add(visual_det)

        session.commit()
        print(f"✅ Added Visual data.")
        print("🚀 Database seeding complete!")

if __name__ == "__main__":
    seed_data()