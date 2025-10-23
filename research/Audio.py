import os
import re
import pandas as pd
from datetime import datetime, timedelta
from birdnetlib import Recording
from birdnetlib.analyzer import Analyzer
import logging
from pathlib import Path
import traceback

# Configuration
DATA_DIR = "data/all-audio"
OUTPUT_CSV = "detections_master.csv"
LOG_FILE = "processing.log"
LAT, LON = 11.406172, 105.397017
MIN_CONFIDENCE = 0.25
CHECKPOINT_INTERVAL = 50  

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def parse_filename(fname):
    """
    Parse: 4_S7902_20250204_090000(UTC+7).wav
    Returns: dict with metadata or None if invalid
    """
    try:
        pattern = r"(\d+)_S(\d+)_(\d{8})_(\d{6})\(UTC([+-]\d+)\)"
        match = re.match(pattern, fname)
        
        if not match:
            return None
        
        site, sensor, datestr, timestr, utc_offset = match.groups()
        dt_local = datetime.strptime(datestr + timestr, "%Y%m%d%H%M%S")
        
        return {
            "site_id": int(site),
            "sensor_id": int(sensor),
            "datetime_local": dt_local,
            "file_name": fname
        }
    except Exception as e:
        logger.error(f"Failed to parse filename {fname}: {str(e)}")
        return None

def process_audio_file(filepath, meta, analyzer):
    """
    Process single audio file with BirdNET
    Returns: list of detection records or empty list on error
    """
    records = []
    
    try:
        rec = Recording(
            analyzer,
            str(filepath),
            lat=LAT,
            lon=LON,
            date=meta["datetime_local"],
            min_conf=MIN_CONFIDENCE
        )
        
        rec.analyze()
        
        for detection in rec.detections:
            records.append({
                "site_id": meta["site_id"],
                "sensor_id": meta["sensor_id"],
                "datetime_local": meta["datetime_local"],
                "species_common": detection["common_name"],
                "species_scientific": detection["scientific_name"],
                "confidence": detection["confidence"],
                "start_time_sec": detection["start_time"],
                "end_time_sec": detection["end_time"],
                "file_name": meta["file_name"]
            })
        
        return records
        
    except Exception as e:
        logger.error(f"Failed to process {meta['file_name']}: {str(e)}")
        logger.debug(traceback.format_exc())
        return []

def save_checkpoint(df, filename):
    """Save intermediate results"""
    try:
        df.to_csv(filename, index=False)
        logger.info(f"Checkpoint saved: {len(df)} records")
    except Exception as e:
        logger.error(f"Failed to save checkpoint: {str(e)}")

def main():
    logger.info("="*70)
    logger.info("Starting audio processing pipeline")
    logger.info(f"Data directory: {DATA_DIR}")
    logger.info(f"Output file: {OUTPUT_CSV}")
    logger.info(f"Min confidence: {MIN_CONFIDENCE}")
    logger.info("="*70)
    
    # Validate data directory
    data_path = Path(DATA_DIR)
    if not data_path.exists():
        logger.error(f"Data directory not found: {DATA_DIR}")
        return
    
    # Get all WAV files
    wav_files = sorted(list(data_path.glob("*.wav")))
    total_files = len(wav_files)
    
    if total_files == 0:
        logger.error("No WAV files found in directory")
        return
    
    logger.info(f"Found {total_files} WAV files to process")
    
    # Initialize analyzer
    logger.info("Initializing BirdNET analyzer...")
    analyzer = Analyzer()
    
    # Storage for all records
    all_records = []
    processed_count = 0
    skipped_count = 0
    detection_count = 0
    
    # Process each file
    for idx, filepath in enumerate(wav_files, 1):
        filename = filepath.name
        
        # Parse filename
        meta = parse_filename(filename)
        if not meta:
            logger.warning(f"[{idx}/{total_files}] Skipped (invalid filename): {filename}")
            skipped_count += 1
            continue
        
        # Process audio
        logger.info(f"[{idx}/{total_files}] Processing: {filename}")
        records = process_audio_file(filepath, meta, analyzer)
        
        if records:
            all_records.extend(records)
            detection_count += len(records)
            logger.info(f"  -> Found {len(records)} detections")
        else:
            logger.info(f"  -> No detections")
        
        processed_count += 1
        
        # Checkpoint save
        if processed_count % CHECKPOINT_INTERVAL == 0:
            if all_records:
                df_checkpoint = pd.DataFrame(all_records)
                save_checkpoint(df_checkpoint, f"{OUTPUT_CSV}.checkpoint")
    
    # Final results
    logger.info("="*70)
    logger.info("Processing complete")
    logger.info(f"Total files found: {total_files}")
    logger.info(f"Successfully processed: {processed_count}")
    logger.info(f"Skipped/failed: {skipped_count}")
    logger.info(f"Total detections: {detection_count}")
    
    # Create final dataframe
    if not all_records:
        logger.warning("No detections found in any files")
        return
    
    df = pd.DataFrame(all_records)
    
    # Add derived columns
    logger.info("Adding derived columns...")
    df['date'] = pd.to_datetime(df['datetime_local']).dt.date
    df['hour'] = pd.to_datetime(df['datetime_local']).dt.hour
    df['minute'] = pd.to_datetime(df['datetime_local']).dt.minute
    df['call_duration'] = df['end_time_sec'] - df['start_time_sec']
    
    # Sort by time
    df = df.sort_values(['datetime_local', 'start_time_sec']).reset_index(drop=True)
    
    # Save final output
    logger.info(f"Saving final results to {OUTPUT_CSV}...")
    df.to_csv(OUTPUT_CSV, index=False)
    
    # Summary statistics
    logger.info("="*70)
    logger.info("SUMMARY STATISTICS")
    logger.info(f"Total detections: {len(df):,}")
    logger.info(f"Unique species: {df['species_common'].nunique()}")
    logger.info(f"Date range: {df['date'].min()} to {df['date'].max()}")
    logger.info(f"Hour range: {df['hour'].min()}:00 to {df['hour'].max()}:00")
    logger.info(f"Mean confidence: {df['confidence'].mean():.3f}")
    logger.info("")
    logger.info("Top 10 species:")
    for species, count in df['species_common'].value_counts().head(10).items():
        logger.info(f"  {species}: {count}")
    logger.info("="*70)
    logger.info(f"Results saved to: {OUTPUT_CSV}")
    logger.info(f"Log saved to: {LOG_FILE}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.warning("Processing interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        logger.debug(traceback.format_exc())