# Cervical Cancer Screening AI - Quick Overview

---

## 🎯 What Is This?

AI-powered cervical cancer screening tool using **YOLOv8** deep learning to detect and classify abnormal cells in cervical cytology images. Web-based interactive viewer with real-time inference and manual annotation capabilities.

**Current Stage**: Ready for clinical evaluation with Cervical Cancer Screening service (3-week timeline).

---

## 🏗️ Tech Stack

```
Frontend: Vanilla JS + NiiVue Viewer
Backend:  FastAPI (Python 3.12)
AI Model: YOLOv8 (PyTorch 2.3.1)
Infra:    Docker + Kubernetes + Pixi
```

**Deployment**: `https://104-198-164-116.nip.io/`

---

## 🚀 Quick Start

```bash
# Install & Run (one command each)
pixi install
pixi run dev

# Access at http://localhost:8000
```

**Requirements**: Pixi package manager + 8GB RAM

---

## ✨ Key Features

1. **AI Classification** - YOLO cell detection (<2s inference, 0.25 confidence threshold)
2. **Manual Annotation** - Draw ROIs, label with 6 cervical categories (Negative, ASC-US, ASC-H, LSIL, HSIL, SCC)
3. **Image Upload** - Drag & drop PNG/JPG images
4. **Export** - Download annotated images
5. **Responsive UI** - Desktop & mobile optimized

---

## 🧪 Testing

```bash
pixi run test              # All tests (79 test cases)
pixi run test-coverage     # With coverage report
pixi run lint              # Code quality
```

**Coverage**: API tests, model tests, integration tests

---

## 🐛 Critical Issues (Must Fix Before Evaluation)

| Priority | Issue | Impact |
|----------|-------|--------|
| 🔴 **Critical** | [#27](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/27) Get more training data | Model accuracy |
| 🔴 **Critical** | [#35](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/35) Define clinical cost matrix | Clinical validation |
| 🔴 **Critical** | [#23](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/23) Deploy with cancer cell slides | Test coverage |
| 🟡 **High** | [#26](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/26) Slide-level prediction strategy | Algorithm completeness |
| 🟡 **High** | [#31](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/31) Fix CI/CD pipeline | Deployment automation |
| 🟡 **High** | [#36](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/36) Switch to our k8s | Infrastructure |

**Other Issues**: [#37](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/37) Mobile UI, [#34](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/34) API enhancement, [#25](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/25) Algorithm improvements, [#24](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues/24) Threshold tuning

---

## 📊 Model Details

- **Architecture**: YOLOv8 (Ultralytics)
- **Classes**: 4 classes (healthy, rubbish, unhealthy, bothcells)
- **Inference**: <2s per image (CPU), auto-GPU if available
- **Weights**: `src/models/best.pt` (~6MB)
- **Limitations**: Limited training data, no slide-level aggregation

---

## 🎓 Clinical Evaluation Readiness

### ✅ Ready
- [x] Working AI pipeline
- [x] Interactive web UI
- [x] Manual annotation
- [x] Export functionality
- [x] Kubernetes deployment

### 🚧 Pre-Evaluation TODO (3 weeks)
- [ ] Collect more training data (#27) - **CRITICAL**
- [ ] Define clinical cost matrix (#35) - **CRITICAL**
- [ ] Add cancer cell test cases (#23) - **CRITICAL**
- [ ] Implement slide-level predictions (#26)
- [ ] Fix CI/CD pipeline (#31)
- [ ] Address UI bugs (#37)

### 📋 For Production Deployment
- [ ] Clinical validation dataset
- [ ] Accuracy/sensitivity analysis
- [ ] Cost-sensitive classification
- [ ] Authentication & authorization
- [ ] Audit logging
- [ ] Regulatory approvals

---

## 📁 Project Structure

```
agentic-cervical-screener/
├── src/
│   ├── main.py              # FastAPI app
│   ├── model_loader.py      # YOLO inference
│   ├── models/best.pt       # Model weights
│   ├── api/                 # API clients
│   └── viewer/              # Frontend JS
├── public/
│   ├── index.html           # Web UI
│   ├── images/              # Demo cases
│   └── mock/                # Case data
├── tests/                   # Test suite
├── deploy/k8s/              # Kubernetes configs
└── pyproject.toml           # Dependencies
```

---

## 🌐 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Web UI |
| `/healthz` | GET | Health check |
| `/v1/classify` | POST | Classify by slide ID |
| `/v1/classify-upload` | POST | Upload & classify |
| `/cases/{case_id}` | GET | Get case data |

---

## 🐳 Deployment

```bash
# Docker
docker build -t cervical-ai .
docker run -p 8000:8000 cervical-ai

# Kubernetes
kubectl apply -f deploy/k8s/base/
kubectl get pods -l app=cervical-ai-viewer
```

---

## 📈 3-Week Roadmap

### **Week 1: Data & Algorithm**
- Collect more training data (#27)
- Define clinical cost matrix (#35)
- Implement slide-level predictions (#26)

### **Week 2: Testing & Deployment**
- Add cancer cell test cases (#23)
- Fix CI/CD pipeline (#31)
- Kubernetes infrastructure (#36)

### **Week 3: Clinical Evaluation**
- Deploy to evaluation environment
- Integration with screening service
- Performance validation

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Model not loading | Check `src/models/best.pt` exists |
| Tests failing | Run `pixi install` again |
| Port 8000 in use | Use `--port 8001` flag |
| Deployment fails | Verify k8s context & registry access |

---

## 📚 Documentation

- **Full docs**: `PROJECT_OVERVIEW.md` (detailed, 500+ lines)
- **Testing**: `TESTING_GUIDE.md` (CI/CD procedures)
- **Setup**: `README.md` (installation & usage)
- **Config**: `pyproject.toml` (dependencies)

---

## 🎉 Quick Commands

```bash
# Development
pixi run dev              # Start server
pixi run test             # Run tests
pixi run lint             # Check code

# Deployment  
docker build -t cervical-ai .
kubectl apply -f deploy/k8s/base/
```

---

**GitHub**: [Python-AI-Solutions/agentic-cervical-screener](https://github.com/Python-AI-Solutions/agentic-cervical-screener)  
**Issues**: [View All Issues](https://github.com/Python-AI-Solutions/agentic-cervical-screener/issues)