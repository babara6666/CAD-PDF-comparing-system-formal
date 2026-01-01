"""
Utility Module
Security helpers, session management, and file cleanup.
"""

import os
import re
import shutil
import uuid
from pathlib import Path
from typing import Optional
import asyncio
from datetime import datetime, timedelta


# Base directory for temporary file storage
TEMP_DIR = Path(__file__).parent.parent / "temp"


def generate_session_id() -> str:
    """
    Generate a unique session identifier using UUID4.
    
    Returns:
        UUID string for session identification
    """
    return str(uuid.uuid4())


def secure_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal attacks.
    
    Removes or replaces dangerous characters and patterns:
    - Path separators (/ and \\)
    - Parent directory references (..)
    - Null bytes
    - Leading/trailing dots and spaces
    
    Args:
        filename: Original filename from user input
        
    Returns:
        Sanitized filename safe for filesystem use
    """
    # Remove null bytes
    filename = filename.replace('\x00', '')
    
    # Get just the filename, no path components
    filename = os.path.basename(filename)
    
    # Remove any remaining path separators (shouldn't be any after basename)
    filename = filename.replace('/', '').replace('\\', '')
    
    # Replace problematic characters with underscore
    filename = re.sub(r'[<>:"|?*]', '_', filename)
    
    # Remove leading/trailing dots and spaces
    filename = filename.strip('. ')
    
    # Limit length
    if len(filename) > 200:
        name, ext = os.path.splitext(filename)
        filename = name[:200-len(ext)] + ext
    
    # If nothing left, use a default
    if not filename:
        filename = 'unnamed_file'
    
    return filename


def get_session_dir(session_id: str) -> Path:
    """
    Get the directory path for a session, creating if necessary.
    
    Args:
        session_id: Valid UUID session identifier
        
    Returns:
        Path to session directory
        
    Raises:
        ValueError: If session_id format is invalid
    """
    # Validate session ID format (UUID4)
    try:
        uuid.UUID(session_id, version=4)
    except ValueError:
        raise ValueError(f"Invalid session ID format: {session_id}")
    
    session_dir = TEMP_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    
    return session_dir


def get_page_dir(session_id: str, page_num: int) -> Path:
    """
    Get the directory path for a specific page within a session.
    
    Args:
        session_id: Valid UUID session identifier
        page_num: Page number (0-indexed)
        
    Returns:
        Path to page directory within session
    """
    session_dir = get_session_dir(session_id)
    page_dir = session_dir / f"page_{page_num}"
    page_dir.mkdir(parents=True, exist_ok=True)
    
    return page_dir


def secure_filepath(session_id: str, filename: str) -> Path:
    """
    Create a secure file path within a session directory.
    
    Args:
        session_id: Valid session identifier
        filename: Original filename (will be sanitized)
        
    Returns:
        Full path to file within session directory
    """
    session_dir = get_session_dir(session_id)
    safe_name = secure_filename(filename)
    
    filepath = session_dir / safe_name
    
    # Extra safety: ensure path is within session dir
    try:
        filepath.resolve().relative_to(session_dir.resolve())
    except ValueError:
        raise ValueError("Path traversal attempt detected")
    
    return filepath


def cleanup_session(session_id: str) -> bool:
    """
    Securely delete all files and directories for a session.
    
    Args:
        session_id: Session identifier to clean up
        
    Returns:
        True if cleanup successful, False if session didn't exist
    """
    try:
        session_dir = get_session_dir(session_id)
        
        if session_dir.exists():
            shutil.rmtree(session_dir)
            return True
        return False
        
    except ValueError:
        # Invalid session ID
        return False


def cleanup_old_sessions(max_age_minutes: int = 60) -> int:
    """
    Clean up sessions older than specified age.
    
    Args:
        max_age_minutes: Maximum age in minutes before cleanup
        
    Returns:
        Number of sessions cleaned up
    """
    if not TEMP_DIR.exists():
        return 0
    
    cutoff = datetime.now() - timedelta(minutes=max_age_minutes)
    cleaned = 0
    
    for item in TEMP_DIR.iterdir():
        if item.is_dir():
            try:
                # Check modification time
                mtime = datetime.fromtimestamp(item.stat().st_mtime)
                if mtime < cutoff:
                    shutil.rmtree(item)
                    cleaned += 1
            except (OSError, ValueError):
                continue
    
    return cleaned


async def async_cleanup_old_sessions(max_age_minutes: int = 60) -> int:
    """Async wrapper for cleanup_old_sessions."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, cleanup_old_sessions, max_age_minutes)


def validate_pdf_extension(filename: str) -> bool:
    """
    Validate that filename has .pdf extension.
    
    Args:
        filename: Filename to check
        
    Returns:
        True if valid PDF extension
    """
    return filename.lower().endswith('.pdf')


def get_mime_type(filepath: Path) -> Optional[str]:
    """
    Get MIME type of file by checking magic bytes.
    
    Args:
        filepath: Path to file
        
    Returns:
        MIME type string or None if unknown
    """
    if not filepath.exists():
        return None
    
    with open(filepath, 'rb') as f:
        header = f.read(8)
    
    # Check for PDF magic bytes
    if header.startswith(b'%PDF'):
        return 'application/pdf'
    
    # Check for PNG
    if header.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    
    # Check for JPEG
    if header.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    
    return None


def validate_uploaded_pdf(filepath: Path) -> bool:
    """
    Comprehensive validation of uploaded PDF file.
    
    Args:
        filepath: Path to uploaded file
        
    Returns:
        True if valid PDF
        
    Raises:
        ValueError: If validation fails
    """
    if not filepath.exists():
        raise ValueError("File does not exist")
    
    if not validate_pdf_extension(filepath.name):
        raise ValueError("Invalid file extension. Only .pdf files are accepted.")
    
    mime = get_mime_type(filepath)
    if mime != 'application/pdf':
        raise ValueError("Invalid file content. File does not appear to be a valid PDF.")
    
    return True
