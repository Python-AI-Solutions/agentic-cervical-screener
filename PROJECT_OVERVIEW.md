# Cervical Cancer Screening AI - Project Overview

---

## 🎯 **Executive Summary**

AI-powered cervical cancer screening application that uses YOLO deep learning model to detect and classify abnormal cells in cervical cytology images. Built for clinical evaluation with real-time interactive web viewer.

**Key Capabilities**:
- Automated cell detection and classification
- Interactive image annotation and ROI drawing
- Support for standard cervical cytology labels (Negative, ASC-US, ASC-H, LSIL, HSIL, SCC)
- Real-time AI inference with confidence scoring
- Mobile and desktop responsive interface

---

## 🏗️ **Architecture Overview**

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Web Frontend  │─────▶│  FastAPI Backend │─────▶│  YOLO ML Model  │
│  (Vanilla JS)   │      │    (Python 3.12) │      │   (PyTorch)     │
└─────────────────┘      └──────────────────┘      └─────────────────┘
        │                         │                          │
        │                         │                          │
    NiiVue Viewer          Static Files               best.pt model
    Canvas Overlay         Case Data (JSON)           Cell Detection
    ROI Navigation         Image Serving              Classification
```

### **Technology Stack**

| Component | Technology | Version |
|-----------|-----------|---------|
| Backend | FastAPI | 0.116.0+ |
| Frontend | Vanilla JavaScript | ES6+ |
| Viewer | NiiVue | Latest |
| AI Model | Ultralytics YOLO | 8.3.188 |
| ML Framework | PyTorch | 2.3.1 |
| Package Manager | Pixi | Latest |
| Python | CPython | 3.12 |
| Deployment | Docker + Kubernetes | - |

---

## 📂 **Project Structure**

```
agentic-cervical-screener/
├── src/
│   ├── main.py                  # FastAPI application & API endpoints
│   ├── model_loader.py          # YOLO model initialization & inference
│   ├── models/
│   │   └── best.pt             # Trained YOLO model weights
│   ├── api/
│   │   ├── classifyClient.js   # Classification API client
│   │   └── cqaiClient.js       # Case data API client
│   └── viewer/
│       ├── index.js            # Main viewer logic & UI
│       ├── overlayAdapters.js  # Canvas overlay rendering
│       └── roiNav.js           # ROI navigation utilities
├── public/
│   ├── index.html              # Web application UI
│   ├── images/                 # Demo case images
│   ├── mock/                   # Case metadata (JSON)
│   └── niivue/                 # NiiVue library files
├── tests/
│   ├── test_api.py            # API endpoint tests
│   ├── test_model.py          # Model loading tests
│   └── test_integration.py    # End-to-end tests
├── deploy/
│   └── k8s/                   # Kubernetes deployment configs
├── pyproject.toml             # Dependencies & project config
├── Dockerfile                 # Container build
├── TESTING_GUIDE.md          # CI/CD testing instructions
└── README.md                 # Setup & usage documentation
```

---

## 🚀 **Quick Start (Development)**

### **Prerequisites**
- [Pixi](https://pixi.sh) package manager
- Python 3.12+ (managed by Pixi)
- 8GB RAM minimum

### **Installation & Running**

```bash
# 1. Clone repository
git clone <repository-url>
cd agentic-cervical-screener

# 2. Install dependencies (one command!)
pixi install

# 3. Start development server
pixi run dev

# 4. Access application
open http://localhost:8000
```

**That's it!** Pixi handles all dependencies, Python version, and environment setup.

---

## 🔬 **Features & Functionality**

### **Core Features**
1. **AI Classification**
   - YOLO-based cell detection
   - Real-time inference (<2s per image)
   - Adjustable confidence threshold (default: 0.25)
   - Bounding box visualization with labels

2. **Interactive Annotation**
   - Manual ROI drawing (click & drag)
   - Label selection (6 cervical cytology categories)
   - Delete/edit ROIs with hover controls
   - Export annotated images (PNG)

3. **Image Management**
   - Drag & drop image upload
   - Support for PNG, JPG, JPEG
   - 4 pre-loaded demo cases
   - Zoom (0.5x-5x) and pan controls

4. **Layer Controls**
   - Toggle AI detections on/off
   - Toggle user-drawn ROIs
   - Toggle ground truth annotations
   - Mobile-responsive layer menu

5. **Responsive Design**
   - Desktop (>1024px): Full sidebar + viewer
   - Tablet (768-1024px): Collapsible sidebar
   - Mobile (<768px): Optimized touch interface

---

## 🧪 **Testing & Quality Assurance**

### **Test Coverage**
- **API Tests**: 79 test cases (health, classify, upload, cases)
- **Model Tests**: Initialization, fallback handling, graceful degradation
- **Integration Tests**: End-to-end workflows

### **Running Tests**

```bash
# Run all tests
pixi run test

# Run with coverage report
pixi run test-coverage

# Run only integration tests
pixi run test-integration

# Run CI tests (verbose output)
pixi run test-ci
```

### **Code Quality Tools**

```bash
# Lint code
pixi run lint

# Format code
pixi run format

# Pre-commit checks
pixi run check-all
```

---

## 🌐 **API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web application frontend |
| `/healthz` | GET | Health check + model status |
| `/model-info` | GET | Model metadata & class names |
| `/v1/classify` | POST | Classify by slide ID or image URI |
| `/v1/classify-upload` | POST | Classify uploaded image file |
| `/cases/{case_id}` | GET | Get case data & metadata |

### **Classification Request Example**

```bash
# Classify by slide ID
curl -X POST http://localhost:8000/v1/classify \
  -H "Content-Type: application/json" \
  -d '{"slide_id": "SLIDE-001", "conf_threshold": 0.25}'

# Upload and classify
curl -X POST http://localhost:8000/v1/classify-upload \
  -F "file=@image.png" \
  -F "conf_threshold=0.25"
```

### **Response Format**

```json
{
  "slide_id": "SLIDE-001",
  "boxes": [
    {
      "x": 120,
      "y": 120,
      "w": 100,
      "h": 100,
      "label": "LSIL",
      "score": 0.92,
      "class_id": 3
    }
  ],
  "total_detections": 5,
  "class_summary": {
    "Negative": 2,
    "LSIL": 3
  }
}
```

---

## 🐳 **Deployment**

### **Docker**

```bash
# Build image
docker build -t cervical-ai .

# Run container
docker run -p 8000:8000 cervical-ai
```

### **Kubernetes**

```bash
# Deploy to cluster
kubectl apply -f deploy/k8s/base/

# Check status
kubectl get pods -l app=cervical-ai-viewer

# Access logs
kubectl logs -f <pod-name>
```

**Current Deployment**: `https://104-198-164-116.nip.io/`

---

## 📊 **Model Information**

### **YOLO Model Details**
- **Architecture**: YOLOv8 (Ultralytics)
- **Task**: Object detection + classification
- **Classes**: 4 classes (healthy, rubbish, unhealthy, bothcells)
- **Input**: RGB images (any size, auto-resized)
- **Output**: Bounding boxes with class labels & confidence scores
- **Inference Device**: Auto-detect (CUDA if available, else CPU)

### **Model File**
- **Path**: `src/models/best.pt`
- **Size**: ~6MB (model weights)
- **Format**: PyTorch checkpoint

### **Performance**
- **Inference Time**: <2 seconds per image (CPU)
- **Confidence Threshold**: 0.25 (adjustable)
- **Batch Processing**: Not currently supported

---

## 🔧 **Configuration**

### **Environment Variables**

```bash
# Python unbuffered output (for Docker logs)
PYTHONUNBUFFERED=1

# Server port
PORT=8000

# Model path (optional, defaults to src/models/best.pt)
MODEL_PATH=/app/models/best.pt
```

### **Resource Requirements**

| Environment | CPU | Memory | Storage |
|-------------|-----|--------|---------|
| Development | 2 cores | 4GB | 2GB |
| Production | 4 cores | 8GB | 5GB |
| Kubernetes | 250m-500m | 512Mi-1Gi | 5Gi |

---

## 🐛 **Known Issues & Limitations**

### **Active Issues** (as of Nov 27, 2025)

| # | Issue | Priority | Status |
|---|-------|----------|--------|
| [#37](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/37) | Mobile UI showing on desktop | Medium | Open |
| [#36](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/36) | Switch to our k8s | High | Open |
| [#35](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/35) | Define Clinical Cost Matrix | Critical | Open |
| [#34](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/34) | API Enhancement for Algorithm Improvements | Medium | Open |
| [#31](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/31) | Continuous deployment not working | High | Open |
| [#27](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/27) | Get more data | Critical | Open |
| [#26](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/26) | Establish slide level strategy | High | Open |
| [#25](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/25) | Add basic algorithm improvements | Medium | Open |
| [#24](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/24) | Decrease object detection threshold | Low | Open |
| [#23](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/23) | Deploy with more cancer cell slides | Critical | Open |

### **Current Limitations**

1. **Model Performance**
   - Trained on limited dataset (needs more data #27)
   - No slide-level prediction aggregation yet (#26)
   - Detection threshold may need tuning (#24)

2. **Deployment**
   - CI/CD pipeline incomplete (#31)
   - Manual deployment required currently

3. **Clinical Readiness**
   - No cost-sensitive classification matrix (#35)
   - Missing clinical validation data
   - No regulatory approval (prototype only)

4. **UI/UX**
   - Mobile layout issues on some desktop browsers (#37)
   - Limited batch processing support

---

## 🔐 **Security & Compliance**

### **Important Disclaimers**
⚠️ **NOT FOR CLINICAL USE** - This is a research prototype  
⚠️ **NO REGULATORY APPROVAL** - Not FDA/CE approved  
⚠️ **RESEARCH ONLY** - For evaluation and research purposes

### **Data Handling**
- Images processed in-memory (not permanently stored)
- No patient data collection
- No PHI/PII storage
- Session-based processing only

### **Authentication**
- Currently: No authentication (prototype)
- For production: Implement RBAC + OAuth2

---

## 👥 **Team & Contributions**

### **Core Team**
- **Sumit**: Backend, Frontend, Integration
- **Jeevan**: Model Training, Algorithm Development
- **John**: Project Management, Architecture
- **Peter**: Clinical Liaison

### **Development Workflow**

```bash
# 1. Create feature branch
git checkout -b feature/your-feature

# 2. Make changes
# 3. Run tests
pixi run test

# 4. Format & lint
pixi run format
pixi run lint

# 5. Commit & push
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature

# 6. Create pull request
```

---

## 📚 **Documentation & Resources**

### **Key Documents**
- `README.md` - Setup & usage guide
- `TESTING_GUIDE.md` - CI/CD & testing procedures
- `pyproject.toml` - Dependencies & configuration
- `deploy/k8s/` - Deployment manifests

### **External Resources**
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Ultralytics YOLO](https://docs.ultralytics.com/)
- [NiiVue Viewer](https://github.com/niivue/niivue)
- [Pixi Package Manager](https://pixi.sh/)

---

## 🎓 **Clinical Evaluation Readiness**

### **Ready for Evaluation ✅**
- [x] Working AI inference pipeline
- [x] Interactive web interface
- [x] Manual annotation capability
- [x] Export functionality
- [x] Basic test coverage
- [x] Deployment infrastructure

### **Pre-Evaluation TODO 🚧**
- [ ] Collect more training data (#27)
- [ ] Implement slide-level predictions (#26)
- [ ] Define clinical cost matrix (#35)
- [ ] Add cancer cell test cases (#23)
- [ ] Fix deployment pipeline (#31)
- [ ] Address UI issues (#37)
- [ ] Tune detection threshold (#24)

### **For Clinical Deployment 📋**
- [ ] Obtain clinical validation dataset
- [ ] Conduct accuracy/sensitivity analysis
- [ ] Implement cost-sensitive classification
- [ ] Add audit logging
- [ ] Implement authentication/authorization
- [ ] Obtain regulatory approvals
- [ ] Conduct user training
- [ ] Establish monitoring/alerting

---

## 🆘 **Support & Contact**

### **Quick Troubleshooting**

**Problem**: Model not loading  
**Solution**: Check `src/models/best.pt` exists, verify PyTorch installation

**Problem**: Tests failing  
**Solution**: Run `pixi install` again, check Python 3.12

**Problem**: Port 8000 in use  
**Solution**: Change port: `uvicorn src.main:app --port 8001`

**Problem**: Deployment fails  
**Solution**: Check Kubernetes context, verify image registry access

---

## 📈 **Roadmap & Next Steps**

### **Phase 1: Pre-Clinical (Current)**
- Fix critical bugs (#31, #37)
- Gather more training data (#27)
- Implement cost-sensitive loss (#35)

### **Phase 2: Clinical Evaluation (3 weeks)**
- Deploy to evaluation environment
- Integrate with Cervical Cancer Screening service
- Collect validation data
- Performance benchmarking

### **Phase 3: Clinical Deployment (Future)**
- Regulatory approval process
- Production hardening
- User training & documentation
- Continuous monitoring

---

## 📝 **Version History**

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | Nov 2025 | Responsive UI, YOLO model, ROI drawing |
| 1.0.0 | Oct 2025 | Initial prototype, basic classification |

---

**Last Updated**: November 27, 2025  
**Document Version**: 1.0  
**Project Repository**: [GitHub](https://github.com/Python-AI-Solutions/agentic-cervical-screener)

---

## 🎉 **Quick Command Reference**

```bash
# Development
pixi run dev              # Start dev server
pixi run start            # Start production server

# Testing
pixi run test             # Run all tests
pixi run test-coverage    # Run with coverage
pixi run lint             # Lint code
pixi run format           # Format code

# Deployment
docker build -t cervical-ai .
kubectl apply -f deploy/k8s/base/
```

