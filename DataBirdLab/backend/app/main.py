import os
import shutil
from datetime import date
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlmodel import Session
from app.database import engine, create_db_and_tables
from app.models import Survey, MediaAsset, VisualDetection, AcousticDetection
from pipeline.pipeline import run_drone_pipeline
from typing import Optional


app = FastAPI(title="DataBirdLab API")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()


def get_session():
    with Session(engine) as session:
        yield session

from sqlmodel import select, func
from datetime import timedelta




@app.post("/api/surveys/import")
async def import_survey(

    survey_name: str = Form(..., description="'Boeung Sne - Zone 2'"),
    survey_date: str = Form(date.today().isoformat(), description="Optional date string, defaults to today's date"),
    file: UploadFile = File(..., description="The Orthomosaic GeoTIFF"),
    background_tasks: BackgroundTasks = None,
    session: Session = Depends(get_session)
):


    """
    1. Creates a Survey entry in DB.
    2. Saves the .tif file.
    3. Triggers the Drone Pipeline in background.
    """

    print(f"Creating Survey: {survey_name}")
    new_survey = Survey(
        name=survey_name,
        type="drone",

    )
    session.add(new_survey)
    session.commit()
    session.refresh(new_survey) 


    # Use absolute path for uploads to ensure it lands in backend/static/uploads
    # BASE_DIR is backend/
    upload_dir = BASE_DIR / "static" / "uploads" / f"survey_{new_survey.id}"
    os.makedirs(upload_dir, exist_ok=True)
    

    safe_filename = file.filename.replace(" ", "_")
    file_location = os.path.join(upload_dir, safe_filename)
    
    print(f"💾 Saving file to: {file_location}")
    
    # Stream write
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Pipeline
    print("🚀 Triggering Background Pipeline")
    background_tasks.add_task(
        run_drone_pipeline, 
        survey_id=new_survey.id, 
        orthomosaic_path=file_location
    )

    return {
        "status": "success",
        "message": "Survey created and processing started.",
        "survey_id": new_survey.id,
        "survey_name": new_survey.name
    }


@app.get("/api/surveys/{survey_id}/status")
def get_survey_status(survey_id: int, session: Session = Depends(get_session)):
    survey = session.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    # Count how many assets are processed
    # (This assumes you added a relationship or query logic)
    total_assets = len(survey.media)
    processed = sum(1 for asset in survey.media if asset.is_processed)
    
    return {
        "id": survey.id,
        "name": survey.name,
        "total_tiles": total_assets,
        "processed_tiles": processed,
        "is_complete": (total_assets > 0 and total_assets == processed)
    }

    return {
        "id": survey.id,
        "name": survey.name,
        "total_tiles": total_assets,
        "processed_tiles": processed,
        "is_complete": (total_assets > 0 and total_assets == processed)
    }


@app.get("/api/surveys")
def get_surveys(session: Session = Depends(get_session)):
    surveys = session.exec(select(Survey).order_by(Survey.date.desc())).all()
    
    results = []
    for s in surveys:
        # Calculate bounds
        # min_lat, max_lat, min_lon, max_lon
        # This is a bit heavy if many assets, but let's do it
        
        # We need to query MediaAsset for this survey
        # Using SQLModel direct query for aggregation is cleaner but let's stick to python for speed of dev if list is small
        # Actually, let's use SQL for performance
        
        bounds = session.exec(
            select(
                func.min(MediaAsset.lat_tl),
                func.max(MediaAsset.lat_br), # BR is usually lower lat, but check logic
                func.min(MediaAsset.lon_tl),
                func.max(MediaAsset.lon_br)
            ).where(MediaAsset.survey_id == s.id)
        ).first()
        
        # Determine actual NESW
        # Lat: usually TL > BR in northern hemisphere? 
        # Actually our models.py says: lat_tl, lat_br. 
        # Standard: min_lat is south, max_lat is north.
        
        # If no assets, bounds is (None, None, None, None)
        
        results.append({
            "id": s.id,
            "name": s.name,
            "date": s.date,
            "bounds": {
                "min_lat": bounds[1] if bounds[1] is not None else None, # Assuming BR is min? Let's treat raw min/max
                "max_lat": bounds[0] if bounds[0] is not None else None,
                "min_lon": bounds[2] if bounds[2] is not None else None,
                "max_lon": bounds[3] if bounds[3] is not None else None
            }
        })

    return results


@app.get("/api/surveys/{survey_id}/map_data")
def get_survey_map_data(survey_id: int, session: Session = Depends(get_session)):
    """
    Returns a list of detections with their estimated lat/lon based on the MediaAsset bounds.
    Scale: simple interpolation for now.
    """
    survey = session.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    detections_data = []
    
    # Pre-fetch assets to avoid N+1 query issues if lists are huge (keeping it simple for now)
    # Ideally should use a join, but python logic for geo-calc is easier to write explicitly here
    
    import json
    
    for asset in survey.media:
        if not asset.visual_detections:
            continue
            
        # Basic bounds checks
        if asset.lat_tl is None or asset.lat_br is None or asset.lon_tl is None or asset.lon_br is None:
            continue
            
        lat_diff = asset.lat_br - asset.lat_tl
        lon_diff = asset.lon_br - asset.lon_tl
        
        # Image dimensions assumed 1280x1280 based on models.py comments or defaults
        # If dynamic, need to store it. Assuming 1280x1280 for the thermal/drone slices
        IMG_W, IMG_H = 1280, 1280 
        
        for det in asset.visual_detections:
            try:
                # bbox_json is [x, y, w, h] (x,y is center? or top-left? usually top-left for xywh)
                # YOLO format varies, but usually center_x, center_y, w, h normalized OR pixel x1,y1,x2,y2
                # The model says "pixels: [x, y, w, h]" inside 1280x1280.
                # Let's assume x,y are center or top-left. Let's assume Top-Left for pixel coords usually
                # But safer to take the center of the box for the point on map.
                
                bbox = json.loads(det.bbox_json)
                # If bbox is [x, y, w, h]
                x, y, w, h = bbox
                
                cx = x + w / 2
                cy = y + h / 2
                
                # Interpolate
                # latitude moves locally; 0 is TL, H is BR.
                # So relative_y = cy / IMG_H
                # feature_lat = lat_tl + (relative_y * lat_diff)
                
                relative_x = cx / IMG_W
                relative_y = cy / IMG_H
                
                det_lat = asset.lat_tl + (relative_y * lat_diff)
                det_lon = asset.lon_tl + (relative_x * lon_diff)
                
                detections_data.append({
                    "id": det.id,
                    "lat": det_lat,
                    "lon": det_lon,
                    "class": det.class_name,
                    "confidence": det.confidence,
                    "asset_id": asset.id
                })
            except:
                continue
                
    return detections_data


@app.get("/api/stats/daily")
def get_daily_activity(
    session: Session = Depends(get_session),
    days: int = 7,
    survey_id: Optional[int] = None
):
    """
    Returns total visual detections grouped by day.
    """
    
    base_query = (
        select(func.date(Survey.date), func.count(VisualDetection.id))
        .join(MediaAsset, Survey.id == MediaAsset.survey_id)
        .join(VisualDetection, MediaAsset.id == VisualDetection.asset_id)
    )
    
    # Filter
    if survey_id:
        base_query = base_query.where(Survey.id == survey_id)
    
    # Date filter
    # If using sqlite func.date, be careful with comparison
    cutoff_date = date.today() - timedelta(days=days)
    base_query = base_query.where(Survey.date >= cutoff_date)

    query = (
        base_query
        .group_by(func.date(Survey.date))
        .order_by(func.date(Survey.date).desc())
    )
    
    results = session.exec(query).all()
    
    data = []
    
    for date_str, count in results:
        # date_str comes out as string 'YYYY-MM-DD' from func.date usually
        d = date_str if isinstance(date_str, str) else date_str.strftime("%Y-%m-%d")
        dt_obj = date.fromisoformat(d)
        
        data.append({
            "day": dt_obj.strftime("%a"), # Mon, Tue
            "full_date": d,
            "count": count
        })
        
    return data[::-1]


@app.get("/api/stats/acoustic")
def get_acoustic_activity(
    session: Session = Depends(get_session),
    days: int = 7,
    survey_id: Optional[int] = None
):
    """
    Returns acoustic detections grouped by class or time.
    For now, let's return top acoustic classes to display in a chart.
    """
    # Join needed
    base_query = (
        select(AcousticDetection.class_name, func.count(AcousticDetection.id))
        .join(MediaAsset, AcousticDetection.asset_id == MediaAsset.id)
        .join(Survey, MediaAsset.survey_id == Survey.id)
    )

    if survey_id:
        base_query = base_query.where(Survey.id == survey_id)

    cutoff_date = date.today() - timedelta(days=days)
    base_query = base_query.where(Survey.date >= cutoff_date)
    
    query = (
        base_query
        .group_by(AcousticDetection.class_name)
        .order_by(func.count(AcousticDetection.id).desc())
    )
    
    results = session.exec(query).all()
    
    data = []
    for class_name, count in results:
        data.append({"name": class_name, "value": count})
        
    return data


@app.get("/api/stats/species")
def get_species_stats(
    session: Session = Depends(get_session),
    days: int = 7,
    survey_id: Optional[int] = None
):
    """
    Returns breakdown of species detections.
    """
    # Join needed to filter by Survey Date/ID if filter applied
    base_query = (
        select(VisualDetection.class_name, func.count(VisualDetection.id))
        .join(MediaAsset, VisualDetection.asset_id == MediaAsset.id)
        .join(Survey, MediaAsset.survey_id == Survey.id)
    )
    
    if survey_id:
        base_query = base_query.where(Survey.id == survey_id)
    
    cutoff_date = date.today() - timedelta(days=days)
    base_query = base_query.where(Survey.date >= cutoff_date)
    
    query = (
        base_query
        .group_by(VisualDetection.class_name)
        .order_by(func.count(VisualDetection.id).desc())
    )
    
    results = session.exec(query).all()
    
    data = []
    for class_name, count in results:
        data.append({"name": class_name, "value": count})
        
    return data


@app.get("/api/stats/overview")
def get_overview_stats(
    session: Session = Depends(get_session),
    days: int = 7,
    survey_id: Optional[int] = None
):
    """
    Returns high-level aggregate stats.
    """
    
    # helper for constructing query
    def get_filtered_scalar(field):
        q = select(field).join(MediaAsset, VisualDetection.asset_id == MediaAsset.id).join(Survey, MediaAsset.survey_id == Survey.id)
        if survey_id:
            q = q.where(Survey.id == survey_id)
        q = q.where(Survey.date >= (date.today() - timedelta(days=days)))
        return q

    # Total Detections
    total_q = (
        select(func.count(VisualDetection.id))
        .join(MediaAsset, VisualDetection.asset_id == MediaAsset.id)
        .join(Survey, MediaAsset.survey_id == Survey.id)
        .where(Survey.date >= (date.today() - timedelta(days=days)))
    )
    if survey_id:
        total_q = total_q.where(Survey.id == survey_id)
        
    total_detections = session.exec(total_q).one()
    
    # Species
    species_q = (
        select(func.count(func.distinct(VisualDetection.class_name)))
        .join(MediaAsset, VisualDetection.asset_id == MediaAsset.id)
        .join(Survey, MediaAsset.survey_id == Survey.id)
        .where(Survey.date >= (date.today() - timedelta(days=days)))
    )
    if survey_id:
        species_q = species_q.where(Survey.id == survey_id)
        
    unique_species = session.exec(species_q).one()
    
    # Conf
    conf_q = (
        select(func.avg(VisualDetection.confidence))
        .join(MediaAsset, VisualDetection.asset_id == MediaAsset.id)
        .join(Survey, MediaAsset.survey_id == Survey.id)
        .where(Survey.date >= (date.today() - timedelta(days=days)))
    )
    if survey_id:
        conf_q = conf_q.where(Survey.id == survey_id)
        
    avg_conf = session.exec(conf_q).one()
    
    # Area Calculation (hectares)
    # Sum of (lat_diff * lon_diff) * conversion_factor?
    # Or just sum of tile areas? 
    # Approx: 1 deg lat ~ 111km. 1 deg lon ~ 111km * cos(11).
    # Area = sum( (lat_br-lat_tl) * (lon_br-lon_tl) ) * logic
    # Simplified: Just count Tiles * Approx Area Per Tile
    # Drone images 1280x1280, GSD ~? 
    # Let's say 1 tile = 0.5 Hectares for now as a constant if bounds not perfect
    
    # Count processed tiles in filter
    tiles_q = (
        select(func.count(MediaAsset.id))
        .join(Survey, MediaAsset.survey_id == Survey.id)
        .where(MediaAsset.is_processed == True)
        .where(Survey.date >= (date.today() - timedelta(days=days)))
    )
    if survey_id:
        tiles_q = tiles_q.where(Survey.id == survey_id)
    
    tile_count = session.exec(tiles_q).one()
    area_hectares = tile_count * 0.15 # Dummy factor
    
    
    return {
        "total_detections": total_detections,
        "unique_species": unique_species,
        "avg_confidence": avg_conf if avg_conf else 0.0,
        "storage_used": f"{area_hectares:.2f} ha" # Re-purposing this field or adding new
    }

BASE_DIR = Path(__file__).resolve().parent.parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")