"""
Difference Engine Module
Generates 3-color difference masks using pixel subtraction and SSIM.
"""

from typing import Tuple
import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim


def apply_morphological_cleanup(
    mask: np.ndarray,
    kernel_size: int = 2,
    iterations: int = 1
) -> np.ndarray:
    """
    Apply morphological operations to clean up noise in mask.
    
    Args:
        mask: Binary mask (uint8, 0 or 255)
        kernel_size: Size of morphological kernel
        iterations: Number of iterations for each operation
        
    Returns:
        Cleaned binary mask
    """
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    
    # Opening: remove small noise (erosion then dilation)
    opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=iterations)
    
    # Closing: fill small gaps (dilation then erosion)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=iterations)
    
    return closed


def generate_missing_mask(
    ref_img: np.ndarray,
    aligned_target: np.ndarray,
    threshold: int = 30
) -> np.ndarray:
    """
    Generate RED mask for pixels present in Reference but missing in Target.
    
    Formula: mask = (A - B) > threshold
    
    Args:
        ref_img: Reference image (grayscale)
        aligned_target: Aligned target image (grayscale)
        threshold: Difference threshold (0-255)
        
    Returns:
        Binary mask (uint8, 0 or 255)
    """
    # Ensure same size
    if ref_img.shape != aligned_target.shape:
        raise ValueError("Images must have the same dimensions")
    
    # Convert to signed int to handle negative differences
    ref = ref_img.astype(np.int16)
    target = aligned_target.astype(np.int16)
    
    # A - B: positive where A is darker (has content) and B is lighter (missing)
    # For white-background drawings, darker = content
    diff = target - ref  # Inverted: where target is lighter than ref = missing in target
    
    # Create mask where difference exceeds threshold
    mask = np.zeros_like(ref_img, dtype=np.uint8)
    mask[diff > threshold] = 255
    
    # Clean up noise
    mask = apply_morphological_cleanup(mask)
    
    return mask


def generate_added_mask(
    ref_img: np.ndarray,
    aligned_target: np.ndarray,
    threshold: int = 30
) -> np.ndarray:
    """
    Generate GREEN mask for pixels present in Target but not in Reference.
    
    Formula: mask = (B - A) > threshold
    
    Args:
        ref_img: Reference image (grayscale)
        aligned_target: Aligned target image (grayscale)
        threshold: Difference threshold (0-255)
        
    Returns:
        Binary mask (uint8, 0 or 255)
    """
    if ref_img.shape != aligned_target.shape:
        raise ValueError("Images must have the same dimensions")
    
    ref = ref_img.astype(np.int16)
    target = aligned_target.astype(np.int16)
    
    # B - A: where reference is lighter than target = added in target
    diff = ref - target
    
    mask = np.zeros_like(ref_img, dtype=np.uint8)
    mask[diff > threshold] = 255
    
    mask = apply_morphological_cleanup(mask)
    
    return mask


def generate_modified_mask_ssim(
    ref_img: np.ndarray,
    aligned_target: np.ndarray,
    ssim_threshold: float = 0.8,
    exclude_unchanged: bool = True
) -> np.ndarray:
    """
    Generate BLUE mask for structurally modified areas using SSIM.
    
    This captures areas where content exists in both images but differs
    structurally (e.g., dimension changes, text modifications).
    
    Args:
        ref_img: Reference image (grayscale)
        aligned_target: Aligned target image (grayscale)
        ssim_threshold: Areas with SSIM below this are marked as modified
        exclude_unchanged: Exclude areas that are identical in both
        
    Returns:
        Binary mask (uint8, 0 or 255)
    """
    if ref_img.shape != aligned_target.shape:
        raise ValueError("Images must have the same dimensions")
    
    # Compute SSIM with local map
    # win_size must be odd and <= min dimension
    min_dim = min(ref_img.shape[0], ref_img.shape[1])
    win_size = min(7, min_dim if min_dim % 2 == 1 else min_dim - 1)
    
    if win_size < 3:
        # Image too small for SSIM, return empty mask
        return np.zeros_like(ref_img, dtype=np.uint8)
    
    score, ssim_map = ssim(
        ref_img, 
        aligned_target, 
        win_size=win_size,
        full=True,
        data_range=255
    )
    
    # Convert SSIM map to difference map (1 - SSIM)
    diff_map = 1.0 - ssim_map
    
    # Threshold to create binary mask
    mask = np.zeros_like(ref_img, dtype=np.uint8)
    mask[diff_map > (1.0 - ssim_threshold)] = 255
    
    if exclude_unchanged:
        # Exclude areas that are nearly identical (both white or both have same content)
        # Only keep areas where there's actual content in at least one image
        content_ref = ref_img < 250  # Not pure white
        content_target = aligned_target < 250
        content_mask = np.logical_or(content_ref, content_target).astype(np.uint8) * 255
        mask = cv2.bitwise_and(mask, content_mask)
    
    mask = apply_morphological_cleanup(mask, kernel_size=3)  # Reduced from 5 for finer precision
    
    return mask


def mask_to_colored_overlay(
    mask: np.ndarray,
    color: Tuple[int, int, int],
    alpha: int = 180
) -> np.ndarray:
    """
    Convert binary mask to colored RGBA overlay image.
    
    Args:
        mask: Binary mask (uint8, 0 or 255)
        color: RGB color tuple (R, G, B)
        alpha: Opacity (0-255)
        
    Returns:
        RGBA image (uint8) with colored mask on transparent background
    """
    h, w = mask.shape
    overlay = np.zeros((h, w, 4), dtype=np.uint8)
    
    # Set color where mask is active
    overlay[mask > 0, 0] = color[0]  # R
    overlay[mask > 0, 1] = color[1]  # G
    overlay[mask > 0, 2] = color[2]  # B
    overlay[mask > 0, 3] = alpha     # A
    
    return overlay


def generate_difference_masks(
    ref_img: np.ndarray,
    aligned_target: np.ndarray,
    threshold: int = 30,
    ssim_threshold: float = 0.85
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, dict]:
    """
    Generate all three difference mask overlays.
    
    Args:
        ref_img: Reference image (grayscale)
        aligned_target: Aligned target image (grayscale)
        threshold: Pixel difference threshold for red/green masks
        ssim_threshold: SSIM threshold for blue mask
        
    Returns:
        Tuple of (red_overlay, green_overlay, blue_overlay, stats)
        Each overlay is RGBA with colored differences on transparent background
    """
    # Generate binary masks
    mask_missing = generate_missing_mask(ref_img, aligned_target, threshold)
    mask_added = generate_added_mask(ref_img, aligned_target, threshold)
    mask_modified = generate_modified_mask_ssim(ref_img, aligned_target, ssim_threshold)
    
    # Remove overlaps: modified mask should exclude pure additions/deletions
    # Modified = areas that changed but aren't purely added or missing
    overlap_red_green = cv2.bitwise_or(mask_missing, mask_added)
    mask_modified = cv2.bitwise_and(mask_modified, cv2.bitwise_not(overlap_red_green))
    
    # Convert to colored overlays with BRIGHTER alpha (200 instead of 160)
    # Red (255, 60, 60) for Missing - A only content
    overlay_red = mask_to_colored_overlay(mask_missing, (255, 60, 60), alpha=200)
    
    # Green (34, 197, 94) for Added - B only content
    overlay_green = mask_to_colored_overlay(mask_added, (34, 197, 94), alpha=200)
    
    # Blue (59, 130, 246) for Modified - structural changes
    overlay_blue = mask_to_colored_overlay(mask_modified, (59, 130, 246), alpha=200)
    
    # Calculate statistics
    stats = {
        "missing_pixels": int(np.sum(mask_missing > 0)),
        "added_pixels": int(np.sum(mask_added > 0)),
        "modified_pixels": int(np.sum(mask_modified > 0)),
        "missing_regions": count_regions(mask_missing),
        "added_regions": count_regions(mask_added),
        "modified_regions": count_regions(mask_modified),
    }
    
    return overlay_red, overlay_green, overlay_blue, stats


def count_regions(mask: np.ndarray) -> int:
    """Count distinct connected regions in a binary mask."""
    num_labels, _ = cv2.connectedComponents(mask)
    return max(0, num_labels - 1)  # Subtract 1 for background


def save_overlay_as_png(overlay: np.ndarray, filepath: str) -> None:
    """
    Save RGBA overlay as transparent PNG.
    
    Args:
        overlay: RGBA image array
        filepath: Output file path
    """
    # OpenCV uses BGR(A), so convert from RGBA to BGRA
    bgra = cv2.cvtColor(overlay, cv2.COLOR_RGBA2BGRA)
    cv2.imwrite(filepath, bgra)
