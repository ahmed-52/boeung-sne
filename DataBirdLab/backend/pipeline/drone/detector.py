import os
import json
from sqlmodel import Session, select
from ultralytics import YOLO
from app.database import engine
from app.models import MediaAsset, VisualDetection

# CONFIG
MODEL_PATH = "weights/best.pt"
CONF_THRESHOLD = 0.25

def run_inference_for_survey(survey_id: int):
    print(f"--- Starting Inference for Survey {survey_id} ---")

    if not os.path.exists(MODEL_PATH):
        print(f"Model not found at {os.path.abspath(MODEL_PATH)}")
        return
    
    model = YOLO(MODEL_PATH)

    with Session(engine) as session:
        
        statement = select(MediaAsset).where(
            MediaAsset.survey_id == survey_id,
            MediaAsset.is_processed == False
        )
        assets = session.exec(statement).all()
        
        for asset in assets:
            
            relative_path = asset.file_path.lstrip("/") 
            system_path = relative_path 
            
            if not os.path.exists(system_path):
                continue

            # Run YOLO
            results = model.predict(system_path, conf=CONF_THRESHOLD, verbose=False)

            for r in results:
                for box in r.boxes:
                    # 1. Get Class
                    class_id = int(box.cls[0])
                    class_name = model.names[class_id]
                
                    # Get Confidence
                    conf = float(box.conf[0])

                    # Get RAW NORMALIZED Box (xywhn)
                    raw_bbox = box.xywhn[0].tolist() 
                    
                    # Save to DB
                    detection = VisualDetection(
                        asset_id=asset.id,
                        class_name=class_name,
                        confidence=conf,
                        bbox_json=json.dumps(raw_bbox), 
                    )
                    session.add(detection)
            
            asset.is_processed = True
            session.add(asset)
            
        session.commit()
        print("Inference Complete.")

