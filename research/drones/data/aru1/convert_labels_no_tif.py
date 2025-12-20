#!/usr/bin/env python3
"""
Convert GeoJSON labels to CVAT format WITHOUT needing the TIF file.
This script estimates the coordinate transformation from the clip area GeoJSON.

Usage: python convert_labels_no_tif.py labels.geojson clip_area.geojson png_width png_height output.xml
Example: python convert_labels_no_tif.py ARU1_r025_labels__1_.geojson ARU1_r025_clip_area.geojson 7386 7387 labels.xml
"""

import sys
import json
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

def get_bounds_from_clip_area(clip_geojson_path):
    """Extract geographic bounds from clip area polygon"""
    with open(clip_geojson_path, 'r') as f:
        data = json.load(f)
    
    # Get the polygon coordinates
    coords = data['features'][0]['geometry']['coordinates'][0]
    
    # Extract min/max lat/lon
    lons = [point[0] for point in coords]
    lats = [point[1] for point in coords]
    
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    
    return min_lon, min_lat, max_lon, max_lat

def create_transform(min_lon, min_lat, max_lon, max_lat, img_width, img_height):
    """Create a simple affine transformation"""
    # Calculate pixels per degree
    pixels_per_lon = img_width / (max_lon - min_lon)
    pixels_per_lat = img_height / (max_lat - min_lat)
    
    def lonlat_to_pixel(lon, lat):
        # Note: latitude increases northward, but pixel y increases downward
        x = (lon - min_lon) * pixels_per_lon
        y = (max_lat - lat) * pixels_per_lat
        return int(round(x)), int(round(y))
    
    return lonlat_to_pixel

def polygon_to_bbox(coordinates, transform_func):
    """Convert polygon to bounding box in pixel coordinates"""
    # Extract points from MultiPolygon format
    points = coordinates[0][0]
    
    # Convert all points to pixels
    pixel_points = [transform_func(lon, lat) for lon, lat in points]
    
    # Get bounding box
    xs = [p[0] for p in pixel_points]
    ys = [p[1] for p in pixel_points]
    
    xtl = min(xs)  # x top-left
    ytl = min(ys)  # y top-left
    xbr = max(xs)  # x bottom-right
    ybr = max(ys)  # y bottom-right
    
    return xtl, ytl, xbr, ybr

def convert_geojson_to_cvat(labels_path, clip_area_path, img_width, img_height, output_path):
    """Convert GeoJSON labels to CVAT XML format"""
    
    print(f"Reading clip area from {clip_area_path}...")
    min_lon, min_lat, max_lon, max_lat = get_bounds_from_clip_area(clip_area_path)
    
    print(f"Geographic bounds:")
    print(f"  Longitude: {min_lon:.6f} to {max_lon:.6f}")
    print(f"  Latitude: {min_lat:.6f} to {max_lat:.6f}")
    print(f"Image size: {img_width} x {img_height}")
    
    # Create transformation function
    transform = create_transform(min_lon, min_lat, max_lon, max_lat, img_width, img_height)
    
    # Read labels
    print(f"\nReading labels from {labels_path}...")
    with open(labels_path, 'r') as f:
        data = json.load(f)
    
    # Create class mapping
    species_list = []
    class_map = {}
    for feature in data['features']:
        species = feature['properties'].get('species', 'unknown')
        if species and species not in class_map:
            class_map[species] = len(species_list)
            species_list.append(species)
    
    print(f"Found {len(species_list)} species: {species_list}")
    

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
    image_elem.set('name', 'ARU1_r025_ortho.png')
    image_elem.set('width', str(img_width))
    image_elem.set('height', str(img_height))
    
    # Convert each bird to a box
    converted_count = 0
    skipped_count = 0
    
    print(f"\nConverting {len(data['features'])} birds to bounding boxes...")
    
    for idx, feature in enumerate(data['features']):
        try:
            species = feature['properties'].get('species')
            if not species:
                species = 'unknown'
            
            coords = feature['geometry']['coordinates']
            
            # Convert to bounding box
            xtl, ytl, xbr, ybr = polygon_to_bbox(coords, transform)
            
            # Skip if box is invalid or outside image bounds
            if xtl >= xbr or ytl >= ybr or xtl < 0 or ytl < 0 or xbr > img_width or ybr > img_height:
                skipped_count += 1
                continue
            
            # Skip if box is too small (likely noise)
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
    
    print(f"\n✅ Conversion complete!")
    print(f"   Converted: {converted_count} birds")
    print(f"   Skipped: {skipped_count} birds")
    print(f"   Output: {output_path}")
    print(f"\n📋 To import into CVAT:")
    print(f"   1. Open your task in CVAT")
    print(f"   2. Click 'Menu' → 'Upload annotations'")
    print(f"   3. Format: 'CVAT 1.1'")
    print(f"   4. Upload: {output_path}")
    
    return output_path

if __name__ == '__main__':
    if len(sys.argv) != 6:
        print("Usage: python convert_labels_no_tif.py labels.geojson clip_area.geojson img_width img_height output.xml")
        print("\nExample:")
        print("  python convert_labels_no_tif.py ARU1_r025_labels__1_.geojson ARU1_r025_clip_area.geojson 7386 7387 birds_cvat.xml")
        print("\nNote: Get img_width and img_height from your PNG file properties")
        sys.exit(1)
    
    labels_path = sys.argv[1]
    clip_area_path = sys.argv[2]
    img_width = int(sys.argv[3])
    img_height = int(sys.argv[4])
    output_path = sys.argv[5]
    
    convert_geojson_to_cvat(labels_path, clip_area_path, img_width, img_height, output_path)
    
    print("\n🎉 Done!")