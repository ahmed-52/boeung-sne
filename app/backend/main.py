from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List
import os
import uuid
import shutil
from pathlib import Path
import mimetypes
from fastapi import HTTPException, Query
from services.birdnet import BirdNETService

app = FastAPI(title="BirdJet API", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UPLOAD_DIR = Path("uploads")
AUDIO_DIR = UPLOAD_DIR / "audio"
IMAGE_DIR = UPLOAD_DIR / "images"
RESULTS_DIR = Path("results")


for dir_path in [AUDIO_DIR, IMAGE_DIR, RESULTS_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)


# birdnet

birdnet = BirdNETService(
    model_path="models/birdnet/audio-model.tflite",
    labels_path="models/birdnet/labels/en_us.txt"
)


uploaded_files = []
analysis_results = []

@app.get("/")
async def root():
    return {"message": "BirdJet API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "BirdJet API"}

@app.post("/upload/audio")
async def upload_audio(files: List[UploadFile] = File(...)):
    """Upload audio files for BirdNET analysis"""
    uploaded = []
    
    for file in files:
        mime_type, _ = mimetypes.guess_type(file.filename)
        if not mime_type or not mime_type.startswith('audio/'):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid audio file: {file.filename}"
)
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        saved_filename = f"{file_id}{file_extension}"
        file_path = AUDIO_DIR / saved_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_info = {
            "id": file_id,
            "original_name": file.filename,
            "saved_name": saved_filename,
            "file_path": str(file_path),
            "file_size": file_path.stat().st_size,
            "file_type": "audio",
            "status": "uploaded"
        }
        
        uploaded_files.append(file_info)
        uploaded.append(file_info)
    
    return {"message": f"Uploaded {len(uploaded)} audio files", "files": uploaded}

@app.post("/upload/images")
async def upload_images(files: List[UploadFile] = File(...)):
    """Upload image files for computer vision analysis"""
    uploaded = []
    
    for file in files:
        # Validate file type
        mime_type, _ = mimetypes.guess_type(file.filename)
        if not mime_type or not mime_type.startswith('image/'):
            print("invalid type")
            raise HTTPException(status_code=400)

        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        saved_filename = f"{file_id}{file_extension}"
        file_path = IMAGE_DIR / saved_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_info = {
            "id": file_id,
            "original_name": file.filename,
            "saved_name": saved_filename,
            "file_path": str(file_path),
            "file_size": file_path.stat().st_size,
            "file_type": "image",
            "status": "uploaded"
        }
        
        uploaded_files.append(file_info)
        uploaded.append(file_info)
    
    return {"message": f"Uploaded {len(uploaded)} image files", "files": uploaded}

@app.get("/files")
async def list_files():
    """List all uploaded files"""
    return {"files": uploaded_files, "total": len(uploaded_files)}

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    top_k: int = Query(5, ge=1, le=50),
    overlap: float = Query(0.5, ge=0.0, lt=1.0),
    min_conf: float = Query(0.1, ge=0.0, le=1.0),
    return_segments: bool = Query(False),
):
    if not file.filename.lower().endswith((".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac")):
        raise HTTPException(status_code=400, detail=f"Invalid audio file type: {file.filename}")
    data = await file.read()
    try:
        res = birdnet.predict(
            data,
            top_k=top_k,
            overlap=overlap,
            min_conf=min_conf,
            return_segments=return_segments,
        )
        res["filename"] = file.filename
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")


@app.get("/results")
async def get_results():
    """Get analysis results"""
    return {"results": analysis_results, "total": len(analysis_results)}

@app.get("/results/{analysis_id}")
async def get_result(analysis_id: str):
    """Get specific analysis result"""
    result = next((r for r in analysis_results if r["analysis_id"] == analysis_id), None)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis result not found")
    return result

@app.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete uploaded file"""
    file_info = next((f for f in uploaded_files if f["id"] == file_id), None)
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = Path(file_info["file_path"])
    if file_path.exists():
        file_path.unlink()
    
    uploaded_files.remove(file_info)
    
    return {"message": "File deleted successfully"}

@app.delete("/files")
async def clear_all_files():
    """Clear all uploaded files"""
    # Delete physical files
    for file_info in uploaded_files:
        file_path = Path(file_info["file_path"])
        if file_path.exists():
            file_path.unlink()
    
    # Clear memory
    uploaded_files.clear()
    analysis_results.clear()
    
    return {"message": "All files cleared"}


@app.post("/dev/mock-analysis")
async def mock_analysis_endpoint():
    """Development endpoint to simulate long-running analysis"""
    import asyncio
    import random
    

    await asyncio.sleep(2)
    
    mock_result = {
        "analysis_id": str(uuid.uuid4()),
        "status": "completed",
        "species_found": [
            {"name": "American Robin", "confidence": 0.94, "count": random.randint(2, 8)},
            {"name": "Blue Jay", "confidence": 0.89, "count": random.randint(1, 5)},
            {"name": "Northern Cardinal", "confidence": 0.92, "count": random.randint(1, 4)}
        ],
        "total_detections": random.randint(10, 25),
        "processing_time": f"{random.uniform(30, 120):.1f}s"
    }
    
    return mock_result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)