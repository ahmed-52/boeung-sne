import sys
import os
import random
from datetime import datetime, timedelta
from sqlmodel import Session, select

# Add correct path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, create_db_and_tables
from app.models import Survey, MediaAsset, AcousticDetection

def populate_acoustic_data():
    create_db_and_tables()
    
    species_list = [
        "Black-crowned Night-Heron",
        "Cattle Egret",
        "Eurasian Tree Sparrow",
        "Little Egret",
        "White-breasted Waterhen",
        "Common Greenshank",
        "Great Cormorant",
        "Asian Openbill",
        "Great Egret",
        "House Sparrow"
    ]

    print("Starting data population...")
    
    with Session(engine) as session:
        # Generate data for the last 7 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        current_date = start_date
        while current_date <= end_date:
            print(f"Generating data for {current_date.date()}")
            
            # Create 2-4 surveys per day
            num_surveys = random.randint(2, 4)
            for _ in range(num_surveys):
                # Random time for survey between 6 AM and 6 PM
                survey_hour = random.randint(6, 18)
                survey_time = current_date.replace(hour=survey_hour, minute=random.randint(0, 59))
                
                survey = Survey(
                    name=f"Survey {survey_time.strftime('%Y-%m-%d %H:%M')}",
                    date=survey_time,
                    type="acoustic"
                )
                session.add(survey)
                session.flush() # flush to get ID
                
                # Create 3-8 media assets per survey
                num_assets = random.randint(3, 8)
                for i in range(num_assets):
                    asset = MediaAsset(
                        survey_id=survey.id,
                        file_path=f"/data/audio/rec_{survey.id}_{i}_{random.randint(1000,9999)}.wav",
                        is_processed=True,
                        lat_tl=11.40 + random.uniform(0, 0.01), # Approx loc from context
                        lon_tl=105.39 + random.uniform(0, 0.01)
                    )
                    session.add(asset)
                    session.flush()
                    
                    # Create 0-5 acoustic detections per asset
                    num_detections = random.randint(0, 5)
                    for _ in range(num_detections):
                        detection_start = random.uniform(0, 60.0) # Assume 1 min recordings
                        detection_duration = random.uniform(0.5, 5.0)
                        
                        detection = AcousticDetection(
                            asset_id=asset.id,
                            class_name=random.choice(species_list),
                            confidence=random.uniform(0.65, 0.99),
                            start_time=detection_start,
                            end_time=detection_start + detection_duration,
                            is_human_reviewed=random.choice([True, False])
                        )
                        session.add(detection)
            
            current_date += timedelta(days=1)
        
        session.commit()
        print("Data population complete!")

if __name__ == "__main__":
    populate_acoustic_data()
