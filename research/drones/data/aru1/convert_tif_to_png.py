#!/usr/bin/env python3
"""
Convert TIF orthomosaic to PNG and print dimensions
Usage: python tif_to_png.py input.tif [output.png]
"""

import sys
import numpy as np
from PIL import Image
import rasterio

def convert_tif_to_png(tif_path, output_path=None):
    """Convert TIF to PNG and print size"""
    
    if output_path is None:
        output_path = tif_path.replace('.tif', '.png')
    
    print(f"Reading {tif_path}...")
    
    with rasterio.open(tif_path) as src:
        # Read RGB bands
        img = src.read([1, 2, 3])
        
        # Transpose from (bands, height, width) to (height, width, bands)
        img = np.transpose(img, (1, 2, 0))
        
        print(f"Image shape: {img.shape}")
        print(f"Data type: {img.dtype}")
        print(f"Dimensions: {img.shape[1]} x {img.shape[0]} pixels (width x height)")
        
        # Normalize if needed (16-bit to 8-bit)
        if img.dtype == np.uint16:
            print("Converting from 16-bit to 8-bit...")
            img = (img / 256).astype(np.uint8)
        
        # Convert to PIL Image and save
        print(f"Saving to {output_path}...")
        pil_img = Image.fromarray(img)
        pil_img.save(output_path)
        
        # Get file size
        import os
        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        
        print(f"\n Conversion complete!")
        print(f"   Output: {output_path}")
        print(f"   Size: {img.shape[1]} x {img.shape[0]} pixels")
        print(f"   File size: {file_size_mb:.2f} MB")
    
    return output_path

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python tif_to_png.py input.tif [output.png]")
        print("\nExample:")
        print("  python tif_to_png.py ARU1_r025_ortho.tif")
        print("  python tif_to_png.py ARU1_r025_ortho.tif my_output.png")
        sys.exit(1)
    
    tif_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    convert_tif_to_png(tif_path, output_path)