from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime




class Survey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    date: datetime = Field(default_factory=datetime.now)
    type: str
    media: List["MediaAsset"] = Relationship(back_populates="survey")



class MediaAsset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    survey_id: int = Field(foreign_key="survey.id")
    file_path: str 
    
    # --- GEOSPATIAL DATA ---
    # TL = Top Left, BR = Bottom Right
    lat_tl: Optional[float] = None
    lon_tl: Optional[float] = None
    lat_br: Optional[float] = None
    lon_br: Optional[float] = None
    # ---------------------------------------

    is_processed: bool = False
    is_validated: bool = False  

    # Relationships
    survey: Survey = Relationship(back_populates="media")
    visual_detections: List["VisualDetection"] = Relationship(back_populates="asset")
    acoustic_detections: List["AcousticDetection"] = Relationship(back_populates="asset")


# 3. YOLO detections
class VisualDetection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    asset_id: int = Field(foreign_key="mediaasset.id")

    confidence: float
    
    # AI Prediction
    class_name: str
    # bbox_json stores pixels: [x, y, w, h] inside the 1280x1280 image
    bbox_json: str  
    
    # We allow corrections here 
    # But the "Validated" status lives on the parent Asset
    corrected_class: Optional[str] = None
    corrected_bbox: Optional[str] = None

    asset: MediaAsset = Relationship(back_populates="visual_detections")


# 4. Acoustic Detection 
class AcousticDetection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    asset_id: int = Field(foreign_key="mediaasset.id")
    
    # AI Prediction -- Have TO REVIEW THE OUTPUT OF MODEL
    class_name: str
    confidence: float
    
    start_time: float
    end_time: float
    
    # Human Correction
    is_human_reviewed: bool = True
    corrected_class: Optional[str] = None

    asset: MediaAsset = Relationship(back_populates="acoustic_detections")