#!/usr/bin/env python3
"""
Tile large orthomosaic for CVAT labeling (no labels yet).
Creates high-quality tiles ready for manual annotation.

Usage: python tile_for_labeling.py orthomosaic.tif output_folder [tile_size]
Example: python tile_for_labeling.py huge_colony.tif tiles_for_cvat 2048
"""

import sys
import os
import numpy as np
from PIL import Image
import rasterio

def tile_orthomosaic(tif_path, output_folder, tile_size=2048, overlap=256):
    """Tile orthomosaic into CVAT-ready chunks"""
    
    print(f"Reading orthomosaic: {tif_path}...")
    
    with rasterio.open(tif_path) as src:
        # Read RGB bands
        img = src.read([1, 2, 3])
        img = np.transpose(img, (1, 2, 0))
        
        print(f"Original size: {img.shape[1]} x {img.shape[0]} pixels")
        
        # Normalize if needed
        if img.dtype == np.uint16:
            print("Converting from 16-bit to 8-bit...")
            img = (img / 256).astype(np.uint8)
    
    height, width = img.shape[:2]
    pil_img = Image.fromarray(img)
    
    # Create output directory
    os.makedirs(output_folder, exist_ok=True)
    
    # Calculate tile grid
    tiles_x = int(np.ceil(width / (tile_size - overlap)))
    tiles_y = int(np.ceil(height / (tile_size - overlap)))
    estimated_tiles = tiles_x * tiles_y
    
    print(f"\nTiling into {tile_size}×{tile_size} chunks (overlap={overlap}px)...")
    print(f"Estimated tiles: {estimated_tiles} ({tiles_x}×{tiles_y} grid)")
    
    # Tile the image
    tile_count = 0
    
    for y in range(0, height, tile_size - overlap):
        for x in range(0, width, tile_size - overlap):
            x_end = min(x + tile_size, width)
            y_end = min(y + tile_size, height)
            
            # Crop tile
            tile = pil_img.crop((x, y, x_end, y_end))
            
            # Save tile
            tile_name = f'tile_{tile_count:04d}_x{x}_y{y}.png'
            tile_path = os.path.join(output_folder, tile_name)
            tile.save(tile_path, optimize=True, quality=95)
            
            tile_count += 1
            
            if tile_count % 20 == 0:
                print(f"  Created {tile_count}/{estimated_tiles} tiles...")
    
    # Save metadata
    import json
    metadata = {
        'original_width': width,
        'original_height': height,
        'tile_size': tile_size,
        'overlap': overlap,
        'total_tiles': tile_count,
        'source_file': os.path.basename(tif_path)
    }
    
    metadata_path = os.path.join(output_folder, 'tile_info.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\nTiling complete!")
    print(f"   Total tiles: {tile_count}")
    print(f"   Tile size: {tile_size}×{tile_size} pixels")
    print(f"   Output folder: {output_folder}/")
    print(f"   Metadata: {metadata_path}")
    
    # Calculate total size
    import glob
    tiles = glob.glob(os.path.join(output_folder, '*.png'))
    total_size = sum(os.path.getsize(t) for t in tiles) / (1024**3)
    print(f"   Total size: {total_size:.2f} GB")
    
    
    return tile_count

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python tile_for_labeling.py orthomosaic.tif output_folder [tile_size]")
        print("\nExample:")
        print("  python tile_for_labeling.py huge_colony.tif tiles_2048")
        print("  python tile_for_labeling.py huge_colony.tif tiles_2048 2048")
        print("\nRecommended tile sizes:")
        print("  2048 - Best balance (recommended)")
        print("  1280 - More tiles, faster CVAT")
        print("  4096 - Fewer tiles, slower CVAT")
        sys.exit(1)
    
    tif_path = sys.argv[1]
    output_folder = sys.argv[2]
    tile_size = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
    
    tile_orthomosaic(tif_path, output_folder, tile_size)