import os
from sqlmodel import Session
from app.database import engine
from app.models import MediaAsset
from .drone.slicer import process_orthomosaic
from .drone.detector import run_inference_for_survey


STATIC_TILES_DIR = "static/tiles"

def run_drone_pipeline(survey_id: int, orthomosaic_path: str):
    """
    The Master Function.
    App.py calls this in the background.
    """
    print(f"[Pipeline] Starting Drone Pipeline for Survey #{survey_id}")
    print(f" [Pipeline] Input: {orthomosaic_path}")
    print("[Stage 1] Slicing Orthomosaic...")
    
    # This creates the physical files in 'static/tiles/survey_X'
    # And returns a list of metadata dicts

    # Note: process_orthomosaic returns paths relative to what we passed or constructed.
    # We want absolute paths for writing (safest), but we might want relative for DB.
    # Let's use absolute for the output_dir to be safe with CWD.
    from pathlib import Path
    # backend/static/tiles
    # Assuming this file is in backend/pipeline/, ... relative paths are tricky.
    # Let's rely on CWD being 'backend/' as established by app startup.
    
    assets_metadata = process_orthomosaic(
        input_path=orthomosaic_path, 
        output_dir=STATIC_TILES_DIR, 
        survey_id=survey_id
    )
    
    if not assets_metadata:
        print("❌ [Stage 1] No tiles generated. Check the orthomosaic file.")
        return

    print(f"[Stage 1] Generated {len(assets_metadata)} tiles.")


    # STAGE 2: REGISTRATION (Saving Tiles to Database)

    print("[Stage 2] Registering assets in Database...")
    
    with Session(engine) as session:
        for meta in assets_metadata:
            # meta["file_path"] comes from slicer. 
            # If slicer uses os.path.join("static/tiles", "1", "img.jpg"), we get that.
            # We want "/static/tiles/1/img.jpg" for the frontend.
            
            p = meta["file_path"]
            if not p.startswith("/"):
                p = "/" + p
                
            # Create the Database Row
            new_asset = MediaAsset(
                survey_id=survey_id,
                file_path=meta["file_path"],
                lat_tl=meta["lat_tl"],
                lon_tl=meta["lon_tl"],
                lat_br=meta["lat_br"],
                lon_br=meta["lon_br"],
                is_processed=False
            )
            session.add(new_asset)
        
        # Save all rows
        session.commit()
    
    print("[Stage 2] Assets saved to DB.")
    print("[Stage 3] Running Inference Engine...")
    
    run_inference_for_survey(survey_id)

    print(f"[Pipeline] Survey #{survey_id} Processing Complete!")