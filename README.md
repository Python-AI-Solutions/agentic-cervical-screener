# Agentic Cervical Screener

A web-based cervical screening tool that uses AI to classify and detect abnormal cells in cervical cytology images. The application combines a FastAPI backend with a modern web frontend for interactive image analysis.

## Features

- **AI-Powered Classification**: Uses YOLO model for detecting and classifying cervical cells
- **Interactive Viewer**: Built with NiiVue for smooth image navigation and visualization
- **Bounding Box Overlays**: Visual detection results with confidence scores
- **Multiple Demo Cases**: 4 pre-loaded test cases with different pathology types
- **ROI Navigation**: Navigate between regions of interest
- **Real-time Analysis**: Upload and analyze new images instantly
- **Layer Controls**: Toggle different overlay types and adjust visibility
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Backend**: FastAPI with Python 3.11
- **Frontend**: TypeScript/Vite with Tailwind CSS Plus, NiiVue viewer
- **AI Model**: PyTorch YOLO for cell detection and classification
- **Package Management**: Pixi (conda-forge ecosystem) for Python, npm for frontend
- **Testing**: Vitest (unit/integration), Playwright (E2E)

## Quick Start

### Prerequisites

- [Pixi](https://pixi.sh) package manager installed
- Python 3.11+ (managed by Pixi)
- Node.js 18+ and npm (for frontend development)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd agentic-cervical-screener
   ```

2. Install Python dependencies:
   ```bash
   pixi install
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### Development

Start the development server (backend + frontend):
```bash
pixi run dev
```

The application will be available at **http://localhost:8000**

The development server includes:
- Hot reload for Python code changes
- Vite dev server for frontend (with HMR)
- Automatic model loading
- CORS enabled for frontend development
- Static file serving for assets

**Frontend-only development** (if backend is running separately):
```bash
cd frontend
npm run dev
```

Frontend will be available at **http://localhost:5173** (proxies API calls to backend)

### Production Build

Build the frontend:
```bash
cd frontend
npm run build
```

Start production server:
```bash
pixi run start
```

### Usage

1. **Load Demo Cases**: Use the quick-load buttons in the sidebar to try different pathology cases
2. **Classify Images**: Click "Classify" to run AI analysis on the current image
3. **Navigate ROIs**: Use the ROI navigation buttons to move between regions of interest
4. **Upload Images**: Drag and drop new images for analysis
5. **Toggle Overlays**: Switch between ground truth and AI predictions
6. **Zoom/Pan**: Use mouse wheel to zoom, drag to pan
7. **Draw ROIs**: Click and drag on the canvas to create regions of interest

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

### Backend (Python)

```bash
pixi run dev          # Start development server
pixi run start        # Start production server
pixi run test         # Run Python tests
pixi run test-coverage # Run tests with coverage report
pixi run lint         # Run code linting (ruff)
pixi run format       # Format code (ruff format)
```

### Frontend (Node.js)

```bash
cd frontend

npm run dev           # Start Vite dev server
npm run build         # Build for production
npm run preview       # Preview production build
npm test              # Run unit/integration tests
npm run test:watch    # Run tests in watch mode
npm run test:e2e      # Run E2E tests (Playwright)
npm run test:e2e:ui   # Run E2E tests with UI
npm run test:all      # Run all tests (unit + E2E)
```

## Project Structure

```
agentic-cervical-screener/
├── agentic_cervical_screener/  # Python package (backend)
│   ├── main.py                 # FastAPI application
│   ├── model_loader.py          # Model initialization
│   └── models/                  # PyTorch model files
├── frontend/                    # Frontend application
│   ├── src/                     # TypeScript source code
│   │   ├── viewer/             # Image viewer modules
│   │   ├── services/           # API clients
│   │   ├── components/         # UI components
│   │   └── styles/             # CSS/Tailwind styles
│   ├── e2e/                    # Playwright E2E tests
│   └── dist/                   # Build output (gitignored)
├── public/                      # Static assets
│   ├── images/                 # Demo images
│   └── mock/                   # Mock API responses
├── tests/                       # Python backend tests
├── deploy/                      # Kubernetes deployment configs
└── pyproject.toml              # Python project configuration
```

## Testing

The project uses a two-tier testing approach:

- **Unit/Integration Tests (Vitest)**: Fast, mocked tests for logic (`frontend/src/**/*.test.ts`, `frontend/src/**/*.integration.test.ts`)
- **E2E Tests (Playwright)**: Real browser tests for actual functionality (`frontend/e2e/**/*.spec.ts`)

See `docs/TESTING.md` for detailed testing documentation.

## Contributing

1. Follow the code style conventions (Python: PEP 8, TypeScript: strict mode)
2. Write tests for new features
3. Run tests before committing (`npm test` and `pixi run test`)
4. Update documentation as needed

See `docs/AGENT_GUIDE.md` for detailed development guidelines (especially useful for AI coding assistants).

## License

[Add your license here]

## Support

For issues and questions, please open an issue on the repository.
