/**
 * API Client for Engineering Drawing Comparison Backend
 */

const API_BASE = 'http://localhost:8000';

/**
 * Upload two PDF files for comparison
 * @param {File} refPdf - Reference PDF file
 * @param {File} targetPdf - Target PDF file
 * @returns {Promise<Object>} Upload response with session_id
 */
export async function uploadPdfs(refPdf, targetPdf) {
  const formData = new FormData();
  formData.append('ref_pdf', refPdf);
  formData.append('target_pdf', targetPdf);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Upload failed');
  }

  return response.json();
}

/**
 * Process a specific page and get difference masks
 * @param {string} sessionId - Session ID from upload
 * @param {number} page - Page number (0-indexed)
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results with image URLs
 */
export async function processPage(sessionId, page = 0, options = {}) {
  const params = new URLSearchParams({
    page: page.toString(),
    dpi: (options.dpi || 300).toString(),
    threshold: (options.threshold || 30).toString(),
  });

  const response = await fetch(`${API_BASE}/process/${sessionId}?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Processing failed');
  }

  return response.json();
}

/**
 * Get session information
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Session info
 */
export async function getSessionInfo(sessionId) {
  const response = await fetch(`${API_BASE}/session/${sessionId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get session info');
  }

  return response.json();
}

/**
 * Clean up session files
 * @param {string} sessionId - Session ID to clean up
 * @returns {Promise<Object>} Cleanup response
 */
export async function cleanupSession(sessionId) {
  const response = await fetch(`${API_BASE}/cleanup/${sessionId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Cleanup failed');
  }

  return response.json();
}

/**
 * Get full image URL
 * @param {string} imagePath - Relative image path from API
 * @returns {string} Full URL
 */
export function getImageUrl(imagePath) {
  return `${API_BASE}${imagePath}`;
}

/**
 * Health check
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}
