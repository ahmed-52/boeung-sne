#!/usr/bin/env python3
"""
Complete conversion: TIF + GeoJSON labels → Resized PNG + CVAT XML
Resizes large orthomosaics to be CVAT-compatible (<178M pixels).

Usage: python convert_for_cvat.py orthomosaic.tif labels.geojson clip_area.geojson output_folder
Example: python convert_for_cvat.py ARU3_r050_ortho.tif ARU3_r050_labels.geojson ARU3_r050_clip_area.geojson ARU3_cvat
"""

import sys
import os
import json
import numpy as np
from PIL import Image
import rasterio
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

MAX_PIXELS = 178000000  # CVAT limit

def convert_tif_to_png(tif_path, output_path, max_pixels=MAX_PIXELS):
    """Convert TIF to PNG and resize if needed"""
    
    print(f"Reading orthomosaic: {tif_path}...")
    
    with rasterio.open(tif_path) as src:
        # Read RGB bands
        img = src.read([1, 2, 3])
        
        # Transpose from (bands, height, width) to (height, width, bands)
        img = np.transpose(img, (1, 2, 0))
        
        print(f"Original dimensions: {img.shape[1]} x {img.shape[0]} pixels")
        
        # Normalize if needed (16-bit to 8-bit)
        if img.dtype == np.uint16:
            print("Converting from 16-bit to 8-bit...")
            img = (img / 256).astype(np.uint8)
        
        # Convert to PIL Image
        pil_img = Image.fromarray(img)
        width, height = pil_img.size
        total_pixels = width * height
        
        # Resize if too large
        if total_pixels > max_pixels:
            scale = (max_pixels / total_pixels) ** 0.5
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            print(f"⚠️  Image too large ({total_pixels:,} pixels)")
            print(f"   Resizing to {new_width} x {new_height} ({new_width*new_height:,} pixels)...")
            
            pil_img = pil_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            width, height = new_width, new_height
        
        # Save
        print(f"Saving PNG to {output_path}...")
        pil_img.save(output_path)
        
        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"✅ PNG created! Size: {width} x {height} pixels ({file_size_mb:.2f} MB)")
    
    return width, height

def get_bounds_from_clip_area(clip_geojson_path):
    """Extract geographic bounds from clip area polygon"""
    with open(clip_geojson_path, 'r') as f:
        data = json.load(f)
    
    coords = data['features'][0]['geometry']['coordinates'][0]
    lons = [point[0] for point in coords]
    lats = [point[1] for point in coords]
    
    return min(lons), min(lats), max(lons), max(lats)

def create_transform(min_lon, min_lat, max_lon, max_lat, img_width, img_height):
    """Create coordinate transformation function"""
    pixels_per_lon = img_width / (max_lon - min_lon)
    pixels_per_lat = img_height / (max_lat - min_lat)
    
    def lonlat_to_pixel(lon, lat):
        x = (lon - min_lon) * pixels_per_lon
        y = (max_lat - lat) * pixels_per_lat
        return int(round(x)), int(round(y))
    
    return lonlat_to_pixel

def polygon_to_bbox(coordinates, transform_func):
    """Convert polygon to bounding box in pixel coordinates"""
    points = coordinates[0][0]
    pixel_points = [transform_func(lon, lat) for lon, lat in points]
    
    xs = [p[0] for p in pixel_points]
    ys = [p[1] for p in pixel_points]
    
    return min(xs), min(ys), max(xs), max(ys)  # xtl, ytl, xbr, ybr

def convert_geojson_to_cvat(labels_path, clip_area_path, img_width, img_height, output_path, png_filename):
    """Convert GeoJSON labels to CVAT XML format"""
    
    print(f"\nReading labels from {labels_path}...")
    
    # Get geographic bounds
    min_lon, min_lat, max_lon, max_lat = get_bounds_from_clip_area(clip_area_path)
    transform = create_transform(min_lon, min_lat, max_lon, max_lat, img_width, img_height)
    
    print(f"Geographic bounds:")
    print(f"  Longitude: {min_lon:.6f} to {max_lon:.6f}")
    print(f"  Latitude: {min_lat:.6f} to {max_lat:.6f}")
    
    # Read labels
    with open(labels_path, 'r') as f:
        data = json.load(f)
    
    # Create species mapping
    species_list = []
    species_to_id = {}
    for feature in data['features']:
        species = feature['properties'].get('species', 'unknown')
        if species and species not in species_to_id:
            species_to_id[species] = len(species_list)
            species_list.append(species)
    
    print(f"Found {len(species_list)} species: {species_list}")
    
    # Create CVAT XML
    annotations = Element('annotations')
    
    version = SubElement(annotations, 'version')
    version.text = '1.1'
    
    meta = SubElement(annotations, 'meta')
    task = SubElement(meta, 'task')
    
    SubElement(task, 'id').text = '1'
    SubElement(task, 'name').text = 'Bird Colony Detection'
    SubElement(task, 'size').text = '1'
    SubElement(task, 'mode').text = 'annotation'
    
    owner = SubElement(task, 'owner')
    SubElement(owner, 'username').text = 'annotator'
    SubElement(owner, 'email').text = ''
    
    SubElement(task, 'created').text = '2025-11-17 00:00:00.000000+00:00'
    SubElement(task, 'updated').text = '2025-11-17 00:00:00.000000+00:00'
    
    # Add labels
    labels_elem = SubElement(task, 'labels')
    for idx, species in enumerate(species_list):
        label = SubElement(labels_elem, 'label')
        SubElement(label, 'name').text = str(species)
        SubElement(label, 'color').text = f'#{(idx * 123456) % 0xFFFFFF:06x}'
        SubElement(label, 'type').text = 'rectangle'
    
    SubElement(task, 'segments')
    
    # Add image
    image_elem = SubElement(annotations, 'image')
    image_elem.set('id', '0')
    image_elem.set('name', png_filename)
    image_elem.set('width', str(img_width))
    image_elem.set('height', str(img_height))
    
    # Convert each bird to a box
    converted_count = 0
    skipped_count = 0
    
    print(f"\nConverting {len(data['features'])} birds to bounding boxes...")
    
    for idx, feature in enumerate(data['features']):
        try:
            species = feature['properties'].get('species', 'unknown')
            coords = feature['geometry']['coordinates']
            
            # Convert to bounding box
            xtl, ytl, xbr, ybr = polygon_to_bbox(coords, transform)
            
            # Skip if invalid or outside bounds
            if xtl >= xbr or ytl >= ybr:
                skipped_count += 1
                continue
            
            if xtl < 0 or ytl < 0 or xbr > img_width or ybr > img_height:
                skipped_count += 1
                continue
            
            # Skip if too small
            if (xbr - xtl) < 2 or (ybr - ytl) < 2:
                skipped_count += 1
                continue
            
            # Create box element
            box = SubElement(image_elem, 'box')
            box.set('label', str(species))
            box.set('occluded', '0')
            box.set('xtl', str(xtl))
            box.set('ytl', str(ytl))
            box.set('xbr', str(xbr))
            box.set('ybr', str(ybr))
            box.set('z_order', '0')
            
            # Add confidence as attribute if available
            confidence = feature['properties'].get('confidence')
            if confidence:
                attr = SubElement(box, 'attribute')
                attr.set('name', 'confidence')
                attr.text = f'{confidence:.3f}'
            
            converted_count += 1
            
        except Exception as e:
            print(f"Warning: Failed to convert bird {idx}: {e}")
            skipped_count += 1
            continue
    
    # Pretty print XML
    xml_str = minidom.parseString(tostring(annotations)).toprettyxml(indent="  ")
    
    # Write to file
    with open(output_path, 'w') as f:
        f.write(xml_str)
    
    print(f"\n✅ CVAT XML created!")
    print(f"   Converted: {converted_count} birds")
    print(f"   Skipped: {skipped_count} birds")
    
    return converted_count

def main(tif_path, labels_path, clip_area_path, output_folder):
    """Main conversion pipeline"""
    
    print("=" * 70)
    print("TIF + GeoJSON → PNG + CVAT XML Converter (CVAT-Compatible)")
    print("=" * 70)
    
    # Create output folder
    os.makedirs(output_folder, exist_ok=True)
    print(f"\nOutput folder: {output_folder}/")
    
    # Get base filename
    base_name = os.path.splitext(os.path.basename(tif_path))[0]
    
    # Step 1: Convert TIF to PNG (resize if needed)
    png_filename = f"{base_name}.png"
    png_path = os.path.join(output_folder, png_filename)
    img_width, img_height = convert_tif_to_png(tif_path, png_path)
    
    # Step 2: Convert GeoJSON to CVAT XML
    xml_filename = f"{base_name}_labels.xml"
    xml_path = os.path.join(output_folder, xml_filename)
    bird_count = convert_geojson_to_cvat(labels_path, clip_area_path, img_width, img_height, xml_path, png_filename)
    
    # Summary
    print("\n" + "=" * 70)
    print(" Conversion Complete!")
    print("=" * 70)
    print(f"\nOutput files in: {output_folder}/")
    print(f"  📷 {png_filename} ({img_width} x {img_height} pixels)")
    print(f"  📋 {xml_filename} ({bird_count} birds)")
    print(f"  1. Go to CVAT → Create new task")
    print(f"  2. Upload {png_filename}")
    print(f"  3. Create task")
    print(f"  4. In task: Menu → Upload annotations")
    print(f"  5. Format: CVAT 1.1")
    print(f"  6. Upload {xml_filename}")
    print(f"  7. Review and correct labels")
    print(f"  8. Export as YOLO 1.1 for training")
    
    return png_path, xml_path

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print("Usage: python convert_for_cvat.py orthomosaic.tif labels.geojson clip_area.geojson output_folder")
        print("\nExample:")
        print("  python convert_for_cvat.py ARU3_r050_ortho.tif ARU3_r050_labels.geojson ARU3_r050_clip_area.geojson ARU3_cvat")
        print("\nOutput:")
        print("  output_folder/")
        print("    ├── ARU3_r050_ortho.png (resized if needed)")
        print("    └── ARU3_r050_ortho_labels.xml (CVAT format)")
        print("\nNote: Automatically resizes images >178M pixels for CVAT compatibility")
        sys.exit(1)
    
    tif_path = sys.argv[1]
    labels_path = sys.argv[2]
    clip_area_path = sys.argv[3]
    output_folder = sys.argv[4]
    
    main(tif_path, labels_path, clip_area_path, output_folder)