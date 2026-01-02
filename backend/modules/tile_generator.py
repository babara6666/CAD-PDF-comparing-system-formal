"""
Tile Generator Module
Generates Deep Zoom Image (DZI) tile pyramids from PDF pages.
Uses PIL/Pillow for cross-platform compatibility (no libvips required).
"""

import os
import math
import json
from pathlib import Path
from typing import Tuple, Optional
from PIL import Image
import numpy as np


def generate_dzi_tiles(
    image: np.ndarray,
    output_dir: str,
    tile_size: int = 256,
    overlap: int = 0,
    format: str = "png"
) -> dict:
    """
    Generate Deep Zoom Image (DZI) tile pyramid from a numpy image array.
    
    DZI format is compatible with OpenSeadragon.
    
    Args:
        image: BGR numpy array (from OpenCV)
        output_dir: Directory to save tiles
        tile_size: Size of each tile (default 256)
        overlap: Tile overlap in pixels (default 0)
        format: Image format ('png' or 'jpg')
        
    Returns:
        Dict with DZI manifest info
    """
    # Convert BGR (OpenCV) to RGB (PIL)
    if len(image.shape) == 3 and image.shape[2] == 3:
        pil_image = Image.fromarray(image[:, :, ::-1])  # BGR to RGB
    else:
        pil_image = Image.fromarray(image)
    
    width, height = pil_image.size
    
    # Calculate number of zoom levels
    max_dimension = max(width, height)
    max_level = int(math.ceil(math.log2(max_dimension / tile_size))) + 1
    
    # Create output directory
    # DZI format requires tiles in {name}_files folder where {name}.dzi is the manifest
    # e.g., image.dzi expects image_files/
    tiles_dir = Path(output_dir) / "image_files"
    tiles_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate tiles for each level
    for level in range(max_level + 1):
        level_dir = tiles_dir / str(level)
        level_dir.mkdir(exist_ok=True)
        
        # Calculate scale for this level
        scale = 2 ** (max_level - level)
        level_width = max(1, int(math.ceil(width / scale)))
        level_height = max(1, int(math.ceil(height / scale)))
        
        # Resize image for this level
        if scale > 1:
            level_image = pil_image.resize(
                (level_width, level_height),
                Image.Resampling.LANCZOS
            )
        else:
            level_image = pil_image
        
        # Calculate number of tiles
        cols = int(math.ceil(level_width / tile_size))
        rows = int(math.ceil(level_height / tile_size))
        
        # Generate tiles
        for col in range(cols):
            for row in range(rows):
                # Calculate tile bounds
                left = col * tile_size
                top = row * tile_size
                right = min(left + tile_size + overlap, level_width)
                bottom = min(top + tile_size + overlap, level_height)
                
                # Crop tile
                tile = level_image.crop((left, top, right, bottom))
                
                # Save tile
                tile_path = level_dir / f"{col}_{row}.{format}"
                if format == "png":
                    tile.save(tile_path, "PNG", optimize=True)
                else:
                    tile.save(tile_path, "JPEG", quality=90)
    
    # Generate DZI manifest
    dzi_info = {
        "Image": {
            "xmlns": "http://schemas.microsoft.com/deepzoom/2008",
            "Format": format,
            "Overlap": str(overlap),
            "TileSize": str(tile_size),
            "Size": {
                "Width": str(width),
                "Height": str(height)
            }
        }
    }
    
    # Write DZI XML file
    dzi_path = Path(output_dir) / "image.dzi"
    dzi_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
       Format="{format}" 
       Overlap="{overlap}" 
       TileSize="{tile_size}">
    <Size Width="{width}" Height="{height}"/>
</Image>'''
    
    with open(dzi_path, "w") as f:
        f.write(dzi_xml)
    
    return {
        "dzi_url": "image.dzi",
        "tiles_url": "image_files",
        "width": width,
        "height": height,
        "tile_size": tile_size,
        "max_level": max_level,
        "format": format
    }


def generate_xyz_tiles(
    image: np.ndarray,
    output_dir: str,
    tile_size: int = 256,
    max_zoom: int = 5,
    format: str = "png"
) -> dict:
    """
    Generate XYZ tile structure (Leaflet/Mapbox compatible).
    
    Tile URL pattern: {z}/{x}/{y}.png
    
    Args:
        image: BGR numpy array (from OpenCV)
        output_dir: Directory to save tiles
        tile_size: Size of each tile (default 256)
        max_zoom: Maximum zoom level
        format: Image format
        
    Returns:
        Dict with tile info
    """
    # Convert BGR to RGB
    if len(image.shape) == 3 and image.shape[2] == 3:
        pil_image = Image.fromarray(image[:, :, ::-1])
    else:
        pil_image = Image.fromarray(image)
    
    width, height = pil_image.size
    tiles_dir = Path(output_dir)
    tiles_dir.mkdir(parents=True, exist_ok=True)
    
    for zoom in range(max_zoom + 1):
        # Calculate scale for this zoom level
        # At zoom 0, fit entire image in one tile
        # At higher zooms, show more detail
        scale_factor = 2 ** zoom
        
        # Target size at this zoom level
        target_width = int(width * scale_factor / (2 ** max_zoom))
        target_height = int(height * scale_factor / (2 ** max_zoom))
        
        if target_width < 1 or target_height < 1:
            continue
        
        # Resize for this zoom level
        scaled = pil_image.resize(
            (target_width, target_height),
            Image.Resampling.LANCZOS
        )
        
        # Calculate tiles needed
        tiles_x = int(math.ceil(target_width / tile_size))
        tiles_y = int(math.ceil(target_height / tile_size))
        
        for x in range(tiles_x):
            for y in range(tiles_y):
                # Crop tile
                left = x * tile_size
                top = y * tile_size
                right = min(left + tile_size, target_width)
                bottom = min(top + tile_size, target_height)
                
                tile = scaled.crop((left, top, right, bottom))
                
                # Save: {z}/{x}/{y}.png
                tile_path = tiles_dir / str(zoom) / str(x)
                tile_path.mkdir(parents=True, exist_ok=True)
                
                if format == "png":
                    tile.save(tile_path / f"{y}.png", "PNG", optimize=True)
                else:
                    tile.save(tile_path / f"{y}.jpg", "JPEG", quality=90)
    
    return {
        "url_template": "{z}/{x}/{y}." + format,
        "max_zoom": max_zoom,
        "tile_size": tile_size,
        "width": width,
        "height": height
    }


def generate_mask_overlay_tiles(
    mask_red: np.ndarray,
    mask_green: np.ndarray,
    mask_blue: np.ndarray,
    output_dir: str,
    tile_size: int = 256,
    format: str = "png"
) -> dict:
    """
    Generate combined heatmap overlay as tiles.
    
    Combines red, green, blue masks into single RGBA overlay tiles.
    
    Args:
        mask_red: Red mask RGBA array
        mask_green: Green mask RGBA array
        mask_blue: Blue mask RGBA array
        tile_size: Tile size
        format: Output format
        
    Returns:
        Dict with overlay tile info
    """
    # Combine masks into single RGBA overlay
    height, width = mask_red.shape[:2]
    combined = np.zeros((height, width, 4), dtype=np.uint8)
    
    # Layer masks (later layers on top)
    for mask in [mask_blue, mask_green, mask_red]:
        if mask is not None and len(mask.shape) == 3 and mask.shape[2] == 4:
            alpha = mask[:, :, 3:4] / 255.0
            combined[:, :, :3] = (
                combined[:, :, :3] * (1 - alpha) + 
                mask[:, :, :3] * alpha
            ).astype(np.uint8)
            combined[:, :, 3] = np.maximum(combined[:, :, 3], mask[:, :, 3])
    
    # Generate tiles for overlay
    return generate_dzi_tiles(
        combined, 
        output_dir, 
        tile_size=tile_size, 
        format="png"  # Always PNG for transparency
    )
