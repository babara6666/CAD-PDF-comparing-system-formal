"""
Engineering Drawing Comparison System - FastAPI Backend

Main entry point with API route definitions.
"""

import os
from pathlib import Path
from typing import Optional

import cv2
from fastapi import FastAPI, File, UploadFile, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from modules.pdf_loader import (
    get_page_count, 
    load_pdf_page_as_image, 
    load_pdf_page_as_color_image,
    validate_pdf_file
)
from modules.alignment import align_images, AlignmentError
from modules.diff_engine import generate_difference_masks, save_overlay_as_png
from modules.utils import (
    generate_session_id,
    secure_filename,
    get_session_dir,
    get_page_dir,
    secure_filepath,
    cleanup_session,
    cleanup_old_sessions,
    validate_uploaded_pdf
)


# Initialize FastAPI app
app = FastAPI(
    title="Engineering Drawing Comparison API",
    description="Compare PDF engineering drawings and visualize differences",
    version="1.0.0"
)

# CORS configuration for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure temp directory exists
TEMP_DIR = Path(__file__).parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)

# Mount static files for serving processed images
app.mount("/images", StaticFiles(directory=str(TEMP_DIR)), name="images")


# Response Models
class UploadResponse(BaseModel):
    session_id: str
    status: str
    files: dict
    page_count: dict


class ProcessResponse(BaseModel):
    status: str
    current_page: int
    total_pages: int
    scaling_factor: float
    images: dict
    stats: dict


class CleanupResponse(BaseModel):
    status: str
    message: str


# Session storage (in-memory for simplicity, could be Redis in production)
sessions = {}


@app.post("/upload", response_model=UploadResponse)
async def upload_pdfs(
    ref_pdf: UploadFile = File(..., description="Reference PDF (Drawing A)"),
    target_pdf: UploadFile = File(..., description="Target PDF (Drawing B)")
):
    """
    Upload two PDF files for comparison.
    
    Returns session_id to use for processing.
    """
    # Validate file extensions
    if not ref_pdf.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Reference file must be a PDF")
    if not target_pdf.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Target file must be a PDF")
    
    # Generate session
    session_id = generate_session_id()
    session_dir = get_session_dir(session_id)
    
    try:
        # Save reference PDF
        ref_filename = secure_filename(ref_pdf.filename)
        ref_path = session_dir / f"reference_{ref_filename}"
        with open(ref_path, "wb") as f:
            content = await ref_pdf.read()
            f.write(content)
        
        # Validate reference PDF
        validate_uploaded_pdf(ref_path)
        
        # Save target PDF
        target_filename = secure_filename(target_pdf.filename)
        target_path = session_dir / f"target_{target_filename}"
        with open(target_path, "wb") as f:
            content = await target_pdf.read()
            f.write(content)
        
        # Validate target PDF
        validate_uploaded_pdf(target_path)
        
        # Get page counts
        ref_pages = get_page_count(str(ref_path))
        target_pages = get_page_count(str(target_path))
        
        # Store session data
        sessions[session_id] = {
            "ref_path": str(ref_path),
            "target_path": str(target_path),
            "ref_filename": ref_filename,
            "target_filename": target_filename,
            "ref_pages": ref_pages,
            "target_pages": target_pages,
            "processed_pages": {}
        }
        
        return UploadResponse(
            session_id=session_id,
            status="uploaded",
            files={
                "reference": ref_filename,
                "target": target_filename
            },
            page_count={
                "reference": ref_pages,
                "target": target_pages
            }
        )
        
    except ValueError as e:
        # Cleanup on validation error
        cleanup_session(session_id)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        cleanup_session(session_id)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/process/{session_id}")
async def process_comparison(
    session_id: str,
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    dpi: int = Query(300, ge=72, le=600, description="Render DPI"),
    threshold: int = Query(30, ge=1, le=100, description="Difference threshold")
):
    """
    Process PDFs and generate difference masks for a specific page.
    
    Returns URLs for base image and overlay masks.
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Upload files first.")
    
    session = sessions[session_id]
    
    # Validate page number
    max_pages = min(session["ref_pages"], session["target_pages"])
    if page >= max_pages:
        raise HTTPException(
            status_code=400, 
            detail=f"Page {page} out of range. Max comparable pages: {max_pages}"
        )
    
    # Check if already processed
    if page in session.get("processed_pages", {}):
        cached = session["processed_pages"][page]
        return ProcessResponse(
            status="completed",
            current_page=page,
            total_pages=max_pages,
            scaling_factor=cached["scaling_factor"],
            images=cached["images"],
            stats=cached["stats"]
        )
    
    try:
        # Load PDF pages as images
        ref_gray, scaling_factor = load_pdf_page_as_image(
            session["ref_path"], page, dpi
        )
        target_gray, _ = load_pdf_page_as_image(
            session["target_path"], page, dpi
        )
        
        # Load color version of reference for display
        ref_color, _ = load_pdf_page_as_color_image(
            session["ref_path"], page, dpi, grayscale=False
        )
        
        # Load grayscale version for better heatmap visibility
        ref_grayscale, _ = load_pdf_page_as_color_image(
            session["ref_path"], page, dpi, grayscale=True
        )
        
        # Align target to reference
        try:
            aligned_gray, alignment_stats = align_images(ref_gray, target_gray)
        except AlignmentError as e:
            raise HTTPException(status_code=422, detail=f"Alignment failed: {str(e)}")
        
        # Generate difference masks
        overlay_red, overlay_green, overlay_blue, diff_stats = generate_difference_masks(
            ref_gray, 
            aligned_gray,
            threshold=threshold
        )
        
        # Create page output directory
        page_dir = get_page_dir(session_id, page)
        
        # Save base images (color and grayscale)
        base_color_path = page_dir / "reference.png"
        base_gray_path = page_dir / "reference_gray.png"
        cv2.imwrite(str(base_color_path), ref_color)
        cv2.imwrite(str(base_gray_path), ref_grayscale)
        
        # Save mask overlays
        red_path = page_dir / "mask_red.png"
        green_path = page_dir / "mask_green.png"
        blue_path = page_dir / "mask_blue.png"
        
        save_overlay_as_png(overlay_red, str(red_path))
        save_overlay_as_png(overlay_green, str(green_path))
        save_overlay_as_png(overlay_blue, str(blue_path))
        
        # Construct image URLs
        base_url = f"/images/{session_id}/page_{page}"
        images = {
            "base": f"{base_url}/reference.png",
            "base_grayscale": f"{base_url}/reference_gray.png",
            "mask_red": f"{base_url}/mask_red.png",
            "mask_green": f"{base_url}/mask_green.png",
            "mask_blue": f"{base_url}/mask_blue.png"
        }
        
        # Combined stats
        stats = {
            **alignment_stats,
            **diff_stats
        }
        
        # Cache results
        session["processed_pages"][page] = {
            "scaling_factor": scaling_factor,
            "images": images,
            "stats": stats
        }
        
        return ProcessResponse(
            status="completed",
            current_page=page,
            total_pages=max_pages,
            scaling_factor=scaling_factor,
            images=images,
            stats=stats
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.post("/cleanup/{session_id}", response_model=CleanupResponse)
async def cleanup(session_id: str):
    """
    Clean up session files after user is done.
    """
    if session_id in sessions:
        del sessions[session_id]
    
    if cleanup_session(session_id):
        return CleanupResponse(
            status="success",
            message=f"Session {session_id} cleaned up successfully"
        )
    else:
        return CleanupResponse(
            status="not_found",
            message=f"Session {session_id} not found or already cleaned"
        )


@app.get("/session/{session_id}")
async def get_session_info(session_id: str):
    """
    Get information about an existing session.
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    return {
        "session_id": session_id,
        "files": {
            "reference": session["ref_filename"],
            "target": session["target_filename"]
        },
        "page_count": {
            "reference": session["ref_pages"],
            "target": session["target_pages"]
        },
        "processed_pages": list(session.get("processed_pages", {}).keys())
    }


@app.post("/cleanup-old")
async def cleanup_old(
    background_tasks: BackgroundTasks,
    max_age_minutes: int = Query(60, ge=5, le=1440)
):
    """
    Clean up old sessions (background task).
    """
    background_tasks.add_task(cleanup_old_sessions, max_age_minutes)
    return {"status": "cleanup_scheduled", "max_age_minutes": max_age_minutes}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
