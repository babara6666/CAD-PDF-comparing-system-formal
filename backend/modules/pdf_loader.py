"""
PDF Loader Module
Handles PDF-to-Image conversion with security validation.
"""

import os
from pathlib import Path
from typing import Tuple

import cv2
import fitz  # PyMuPDF
import numpy as np


def validate_pdf_file(filepath: str) -> bool:
    """
    Validate that file is a legitimate PDF.
    
    Args:
        filepath: Path to the file to validate
        
    Returns:
        True if valid PDF, raises ValueError otherwise
    """
    path = Path(filepath)
    
    # Check extension
    if path.suffix.lower() != '.pdf':
        raise ValueError(f"Invalid file extension: {path.suffix}. Only .pdf files are accepted.")
    
    # Check file exists
    if not path.exists():
        raise FileNotFoundError(f"File not found: {filepath}")
    
    # Check PDF magic bytes
    with open(filepath, 'rb') as f:
        header = f.read(8)
        if not header.startswith(b'%PDF'):
            raise ValueError("Invalid PDF file: Missing PDF header signature.")
    
    return True


def get_page_count(pdf_path: str) -> int:
    """
    Get total number of pages in a PDF file.
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Number of pages in the PDF
    """
    validate_pdf_file(pdf_path)
    
    doc = fitz.open(pdf_path)
    count = doc.page_count
    doc.close()
    
    return count


def load_pdf_page_as_image(
    pdf_path: str, 
    page_num: int = 0, 
    dpi: int = 300
) -> Tuple[np.ndarray, float]:
    """
    Convert a specific page of PDF to high-resolution grayscale image.
    
    Args:
        pdf_path: Path to PDF file
        page_num: 0-indexed page number
        dpi: Render resolution (default 300 for engineering drawings)
        
    Returns:
        Tuple of (image_array, scaling_factor)
        - image_array: Grayscale numpy array (uint8)
        - scaling_factor: Ratio for coordinate conversion (dpi / 72)
    """
    validate_pdf_file(pdf_path)
    
    doc = fitz.open(pdf_path)
    
    if page_num < 0 or page_num >= doc.page_count:
        doc.close()
        raise ValueError(f"Invalid page number {page_num}. PDF has {doc.page_count} pages.")
    
    page = doc[page_num]
    
    # Calculate zoom factor for target DPI (PDF default is 72 DPI)
    zoom = dpi / 72.0
    scaling_factor = zoom
    
    # Create transformation matrix for high-res rendering
    mat = fitz.Matrix(zoom, zoom)
    
    # Render page to pixmap
    pix = page.get_pixmap(matrix=mat, alpha=False)
    
    # Convert pixmap to numpy array
    img_data = np.frombuffer(pix.samples, dtype=np.uint8)
    img = img_data.reshape(pix.height, pix.width, pix.n)
    
    # Convert to grayscale if color
    if pix.n == 3:  # RGB
        img_gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    elif pix.n == 4:  # RGBA
        img_gray = cv2.cvtColor(img, cv2.COLOR_RGBA2GRAY)
    else:
        img_gray = img
    
    doc.close()
    
    return img_gray, scaling_factor


def load_pdf_page_as_color_image(
    pdf_path: str, 
    page_num: int = 0, 
    dpi: int = 300,
    grayscale: bool = False
) -> Tuple[np.ndarray, float]:
    """
    Convert a specific page of PDF to high-resolution color image (for display).
    
    Args:
        pdf_path: Path to PDF file
        page_num: 0-indexed page number
        dpi: Render resolution
        grayscale: If True, convert to grayscale (for better heatmap visibility)
        
    Returns:
        Tuple of (image_array, scaling_factor)
        - image_array: BGR numpy array (uint8) for OpenCV compatibility
        - scaling_factor: Ratio for coordinate conversion (dpi / 72)
    """
    validate_pdf_file(pdf_path)
    
    doc = fitz.open(pdf_path)
    
    if page_num < 0 or page_num >= doc.page_count:
        doc.close()
        raise ValueError(f"Invalid page number {page_num}. PDF has {doc.page_count} pages.")
    
    page = doc[page_num]
    
    zoom = dpi / 72.0
    scaling_factor = zoom
    
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    
    img_data = np.frombuffer(pix.samples, dtype=np.uint8)
    img = img_data.reshape(pix.height, pix.width, pix.n)
    
    # Convert RGB to BGR for OpenCV
    if pix.n == 3:
        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif pix.n == 4:
        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    else:
        img_bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    
    # Convert to grayscale if requested (for better heatmap visibility on colored backgrounds)
    if grayscale:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        img_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    
    doc.close()
    
    return img_bgr, scaling_factor

