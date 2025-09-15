# Cervical AI Viewer (Classification-only Demo)

A web-based cervical screening tool that uses AI to classify and detect abnormal cells in cervical cytology images. The application combines a FastAPI backend with a modern web frontend for interactive image analysis.

## Features

- **AI-Powered Classification**: Uses YOLO model for detecting and classifying cervical cells
- **Interactive Viewer**: Built with NiiVue for smooth image navigation and visualization
- **Bounding Box Overlays**: Visual detection results with confidence scores
- **Multiple Demo Cases**: 4 pre-loaded test cases with different pathology types
- **ROI Navigation**: Navigate between regions of interest
- **Real-time Analysis**: Upload and analyze new images instantly
- **Layer Controls**: Toggle different overlay types and adjust visibility

## Tech Stack

- **Backend**: FastAPI with Python 3.11
- **Frontend**: Vanilla JavaScript with NiiVue viewer
- **AI Model**: PyTorch YOLO for cell detection and classification
- **Package Management**: Pixi (conda-forge ecosystem)

## Quick Start

### Prerequisites

- [Pixi](https://pixi.sh) package manager installed
- Python 3.11+ (managed by Pixi)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd agentic-cervical-screener
   ```

2. Install dependencies:
   ```bash
   pixi install
   ```

### Development

Start the development server:
```bash
pixi run dev
```

The application will be available at **http://localhost:8000**

The development server includes:
- Hot reload for Python code changes
- Automatic model loading
- CORS enabled for frontend development
- Static file serving for assets

### Usage

1. **Load Demo Cases**: Use the quick-load buttons in the sidebar to try different pathology cases
2. **Classify Images**: Click "Classify" to run AI analysis on the current image
3. **Navigate ROIs**: Use the ROI navigation buttons to move between regions of interest
4. **Upload Images**: Drag and drop new images for analysis
5. **Toggle Overlays**: Switch between ground truth and AI predictions

### API Endpoints

- `GET /` - Frontend application
- `GET /healthz` - Health check and model status
- `POST /v1/classify` - Classify image by slide ID or image URI
- `POST /v1/classify-upload` - Classify uploaded image file
- `GET /cases/{case_id}` - Get case data and metadata
- `GET /model-info` - Get loaded model information

### Demo Cases

- **Case 1 (DEMO-001)**: Original baseline case
- **Case 2 (DEMO-002)**: LSIL (Low-grade Squamous Intraepithelial Lesion)
- **Case 3 (DEMO-003)**: Mixed pathology
- **Case 4 (DEMO-004)**: High-risk abnormal cells

## Development Commands

```bash
pixi run dev          # Start development server
pixi run start        # Start production server
pixi run test         # Run tests
pixi run test-coverage # Run tests with coverage report
pixi run lint         # Run code linting
pixi run format       # Format code
```
