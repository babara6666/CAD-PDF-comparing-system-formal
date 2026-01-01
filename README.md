# Engineering Drawing Comparison System

A web-based system for comparing PDF engineering drawings with automatic alignment, difference detection, and interactive visualization.

## Features

- **Multi-page PDF Support**: Compare drawings across multiple pages
- **Automatic Alignment**: SIFT/ORB feature matching with RANSAC homography
- **3-Color Difference Visualization**:
  - 🔴 **Red**: Elements present in Reference but missing in Target
  - 🟢 **Green**: Elements added in Target
  - 🔵 **Blue**: Elements that have been modified (structural differences)
- **Interactive Viewer**: Zoom, pan, and click-to-locate coordinates
- **Mini-Map Navigation**: Quick overview and navigation
- **Coordinate System**: Convert screen positions to original PDF coordinates

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **PyMuPDF** - PDF rendering at 300 DPI
- **OpenCV** - Image processing and alignment
- **scikit-image** - SSIM-based difference detection

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **react-zoom-pan-pinch** - Interactive viewer

## Project Structure

```
PDF_DIFF/
├── backend/
│   ├── app.py                    # FastAPI entry point
│   ├── requirements.txt          # Python dependencies
│   └── modules/
│       ├── pdf_loader.py         # PDF to image conversion
│       ├── alignment.py          # SIFT/ORB + Homography
│       ├── diff_engine.py        # 3-color mask generation
│       └── utils.py              # Security & session management
│
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── UploadPage.jsx
│   │   │   ├── ComparisonViewer.jsx
│   │   │   ├── Controls.jsx
│   │   │   ├── MiniMap.jsx
│   │   │   └── CoordinateDisplay.jsx
│   │   └── api/
│   │       └── client.js
│   └── ...
│
└── html_form.html                # UI reference mockups
```

## Installation

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
python -m uvicorn app:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

The UI will be available at `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload two PDF files |
| GET | `/process/{session_id}?page=0` | Process a specific page |
| GET | `/session/{session_id}` | Get session information |
| POST | `/cleanup/{session_id}` | Delete session files |
| GET | `/health` | Health check |

## Usage

1. Open `http://localhost:5173` in your browser
2. Upload Reference PDF (Drawing A) and Target PDF (Drawing B)
3. Click "Generate Comparison"
4. Use the interactive viewer to inspect differences:
   - Toggle layers (Red/Green/Blue) to focus on specific change types
   - Adjust overlay opacity
   - Click on the drawing to see PDF coordinates
   - Use the mini-map for quick navigation
   - Navigate between pages for multi-page PDFs

## Algorithm Details

### Image Alignment
1. Extract SIFT features from both images
2. Match features using FLANN-based matcher
3. Filter matches with Lowe's ratio test
4. Compute homography matrix using RANSAC
5. Warp target image to align with reference

### Difference Detection
- **Red Mask**: `(Target - Reference) > threshold` - Lighter areas in target
- **Green Mask**: `(Reference - Target) > threshold` - Darker areas in target
- **Blue Mask**: SSIM-based structural differences after excluding pure add/delete areas

## Security Features

- PDF file validation (extension + magic bytes)
- Path traversal prevention with secure filenames
- Session-based temporary storage
- Automatic cleanup of old sessions

## License

MIT
