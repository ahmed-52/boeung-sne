from pathlib import Path
from ultralytics import YOLO
import cv2
import numpy as np

def predict_directory(model_path: Path, data_dir: Path) -> None:
    """
    1. Deletes old .txt files.
    2. Applies Gamma Correction to 'tile_' images to boost ghost birds.
    3. Runs YOLO with specific NMS settings.
    4. Writes format: <ClassID> <CenterX> <CenterY> <Width> <Height>
    """
    
    # --- STEP 0: CLEANUP ---
    if not data_dir.exists():
        print(f"Error: Data directory not found at {data_dir}")
        return

    print(f"🧹 Cleaning up old .txt files in {data_dir}...")
    deleted_count = 0
    for item in data_dir.iterdir():
        if item.suffix == ".txt":
            item.unlink()
            deleted_count += 1
    print(f"   - Deleted {deleted_count} old text files.")

    # --- STEP 1: LOAD MODEL ---
    print(f"🦅 Loading Model: {model_path}")
    model = YOLO(model_path)
    
    image_exts = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}

    print(f"🚀 Starting Inference...")

    for image_path in sorted(data_dir.iterdir()):
        if image_path.suffix.lower() not in image_exts:
            continue

        # --- STEP 1.5: CONDITIONAL PRE-PROCESSING ---
        inference_source = image_path
        
        # Check if this is a tile that needs boosting
        if image_path.name.startswith("tile"):
            # Load image into memory
            img = cv2.imread(str(image_path))
            
            if img is not None:
                # Apply Gamma Correction (Gamma < 1.0 makes faint things brighter)
                gamma = 0.6 
                lookUpTable = np.empty((1, 256), np.uint8)
                for i in range(256):
                    lookUpTable[0, i] = np.clip(pow(i / 255.0, gamma) * 255.0, 0, 255)
                
                # Update source to be the modified numpy array, not the file path
                inference_source = cv2.LUT(img, lookUpTable)
        
        # --- STEP 2: INFERENCE ---
        results = model(
            inference_source,  # Pass either the file path OR the numpy array
            imgsz=1280, 
            
            # Capture faint ghosts
            conf=0.1, 
            
            # NMS Settings
            iou=0.70,          
            agnostic_nms=True,  
            
            verbose=False
        )
        
        prediction = results[0]
        boxes = prediction.boxes
        
        output_path = image_path.with_suffix(".txt")

        if boxes is None or len(boxes) == 0:
            continue

        with output_path.open("w", encoding="utf-8") as f:
            xywhn = boxes.xywhn.tolist()
            classes = boxes.cls.tolist()

            for cls_id, (x_c, y_c, w, h) in zip(classes, xywhn):
                # Write format for JS: Class X Y W H
                f.write(
                    f"{int(cls_id)} "
                    f"{x_c:.6f} {y_c:.6f} {w:.6f} {h:.6f}\n"
                )
    
    print("✅ Inference complete.")


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent
    predict_directory(base_dir / "best.pt", base_dir / "data")