"""
Image Alignment Module
Handles SIFT/ORB feature matching and homography-based image warping.
"""

from typing import Dict, Tuple, Optional
import cv2
import numpy as np


class AlignmentError(Exception):
    """Raised when image alignment fails."""
    pass


def detect_and_match_features(
    ref_img: np.ndarray, 
    target_img: np.ndarray,
    use_sift: bool = True
) -> Tuple[list, list, list]:
    """
    Detect features in both images and find matches.
    
    Args:
        ref_img: Reference image (grayscale)
        target_img: Target image to align (grayscale)
        use_sift: Use SIFT if available, otherwise ORB
        
    Returns:
        Tuple of (keypoints_ref, keypoints_target, good_matches)
    """
    # Try SIFT first (better for engineering drawings)
    if use_sift:
        try:
            detector = cv2.SIFT_create(nfeatures=5000)
            # FLANN parameters for SIFT
            index_params = dict(algorithm=1, trees=5)  # FLANN_INDEX_KDTREE
            search_params = dict(checks=50)
            matcher = cv2.FlannBasedMatcher(index_params, search_params)
        except cv2.error:
            # SIFT not available (OpenCV without contrib)
            use_sift = False
    
    if not use_sift:
        # Fallback to ORB
        detector = cv2.ORB_create(nfeatures=5000)
        # Brute force matcher for ORB (binary descriptors)
        matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    
    # Detect keypoints and compute descriptors
    kp_ref, desc_ref = detector.detectAndCompute(ref_img, None)
    kp_target, desc_target = detector.detectAndCompute(target_img, None)
    
    if desc_ref is None or desc_target is None:
        raise AlignmentError("Could not extract features from one or both images.")
    
    if len(kp_ref) < 10 or len(kp_target) < 10:
        raise AlignmentError(f"Insufficient features detected. Ref: {len(kp_ref)}, Target: {len(kp_target)}")
    
    # For SIFT with FLANN, descriptors need to be float32
    if use_sift:
        desc_ref = desc_ref.astype(np.float32)
        desc_target = desc_target.astype(np.float32)
    
    # Match features using KNN
    matches = matcher.knnMatch(desc_ref, desc_target, k=2)
    
    # Apply Lowe's ratio test to filter good matches
    good_matches = []
    for match_pair in matches:
        if len(match_pair) == 2:
            m, n = match_pair
            if m.distance < 0.75 * n.distance:
                good_matches.append(m)
    
    return kp_ref, kp_target, good_matches


def compute_homography(
    kp_ref: list,
    kp_target: list,
    matches: list,
    min_matches: int = 10,
    ransac_threshold: float = 5.0
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute homography matrix using RANSAC.
    
    Args:
        kp_ref: Keypoints from reference image
        kp_target: Keypoints from target image
        matches: List of DMatch objects
        min_matches: Minimum matches required for valid homography
        ransac_threshold: RANSAC reprojection error threshold
        
    Returns:
        Tuple of (homography_matrix, inlier_mask)
    """
    if len(matches) < min_matches:
        raise AlignmentError(
            f"Insufficient matches for alignment: {len(matches)} found, {min_matches} required."
        )
    
    # Extract matched point coordinates
    pts_ref = np.float32([kp_ref[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
    pts_target = np.float32([kp_target[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)
    
    # Compute homography with RANSAC
    H, mask = cv2.findHomography(pts_target, pts_ref, cv2.RANSAC, ransac_threshold)
    
    if H is None:
        raise AlignmentError("Homography computation failed. Images may not have enough overlap.")
    
    return H, mask


def warp_image(
    target_img: np.ndarray,
    homography: np.ndarray,
    output_shape: Tuple[int, int]
) -> np.ndarray:
    """
    Warp target image to align with reference using homography.
    
    Args:
        target_img: Image to warp
        homography: 3x3 homography matrix
        output_shape: (height, width) of output image
        
    Returns:
        Warped image with same dimensions as reference
    """
    h, w = output_shape
    warped = cv2.warpPerspective(
        target_img, 
        homography, 
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=255  # White border for engineering drawings
    )
    return warped


def align_images(
    ref_img: np.ndarray, 
    target_img: np.ndarray,
    use_sift: bool = True
) -> Tuple[np.ndarray, Dict]:
    """
    Main alignment function: Align target image to reference.
    
    This function:
    1. Detects SIFT/ORB features in both images
    2. Matches features using FLANN/BF matcher
    3. Computes homography using RANSAC
    4. Warps target image to align with reference
    
    Args:
        ref_img: Reference image (grayscale, the "anchor")
        target_img: Target image to align (grayscale)
        use_sift: Prefer SIFT over ORB
        
    Returns:
        Tuple of (aligned_image, stats_dict)
        - aligned_image: Target warped to match reference dimensions
        - stats_dict: Contains match count, inlier ratio, etc.
    """
    # Detect and match features
    kp_ref, kp_target, matches = detect_and_match_features(ref_img, target_img, use_sift)
    
    # Compute homography
    H, inlier_mask = compute_homography(kp_ref, kp_target, matches)
    
    # Warp target to align with reference
    aligned = warp_image(target_img, H, ref_img.shape[:2])
    
    # Compute alignment statistics
    inliers = np.sum(inlier_mask) if inlier_mask is not None else 0
    stats = {
        "total_matches": len(matches),
        "inliers": int(inliers),
        "inlier_ratio": float(inliers / len(matches)) if matches else 0,
        "keypoints_ref": len(kp_ref),
        "keypoints_target": len(kp_target),
        "method": "SIFT" if use_sift else "ORB"
    }
    
    return aligned, stats


def align_color_image(
    ref_gray: np.ndarray,
    target_color: np.ndarray,
    use_sift: bool = True
) -> Tuple[np.ndarray, Dict]:
    """
    Align a color target image using grayscale reference for feature matching.
    
    Args:
        ref_gray: Reference image (grayscale)
        target_color: Target image (BGR color)
        use_sift: Prefer SIFT over ORB
        
    Returns:
        Tuple of (aligned_color_image, stats_dict)
    """
    # Convert target to grayscale for matching
    target_gray = cv2.cvtColor(target_color, cv2.COLOR_BGR2GRAY)
    
    # Get alignment parameters from grayscale
    kp_ref, kp_target, matches = detect_and_match_features(ref_gray, target_gray, use_sift)
    H, inlier_mask = compute_homography(kp_ref, kp_target, matches)
    
    # Apply homography to color image
    aligned = warp_image(target_color, H, ref_gray.shape[:2])
    
    inliers = np.sum(inlier_mask) if inlier_mask is not None else 0
    stats = {
        "total_matches": len(matches),
        "inliers": int(inliers),
        "inlier_ratio": float(inliers / len(matches)) if matches else 0,
        "method": "SIFT" if use_sift else "ORB"
    }
    
    return aligned, stats
