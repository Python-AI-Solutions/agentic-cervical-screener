# Environment Integration - Quick Summary

## Current Setup (3 Environments)

```
┌─────────────────────────────────────────────────────────────┐
│  ROOT: agentic-cervical-screener/                          │
│  Tool: Pixi (Python 3.12)                                  │
│  Purpose: Backend API + ML models + Testing                │
│  ├─ FastAPI                                                 │
│  ├─ PyTorch + YOLO                                          │
│  ├─ pytest                                                  │
│  ├─ llm (CLI)                                               │
│  └─ llm-ollama                                              │
└─────────────────────────────────────────────────────────────┘
                        │
                        ├─ frontend/
                        │
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: frontend/                                        │
│  Tool: npm (Node.js)                                        │
│  Purpose: UI development + E2E tests                        │
│  ├─ Vite (dev server)                                       │
│  ├─ Playwright (E2E)                                        │
│  ├─ Vitest (unit tests)                                     │
│  ├─ TypeScript                                              │
│  └─ execa (subprocess → calls llm CLI)                      │
└─────────────────────────────────────────────────────────────┘
                        │
                        └─ external/llm-mlx-vlm/
                           │
┌─────────────────────────────────────────────────────────────┐
│  PLUGIN: external/llm-mlx-vlm/                              │
│  Tool: Pixi (Python 3.12, isolated)                        │
│  Purpose: VLM aesthetic testing (Mac only)                  │
│  Platform: osx-arm64 only                                   │
│  ├─ llm (CLI)                                               │
│  ├─ mlx-vlm                                                 │
│  ├─ mlx (Apple Silicon optimized)                           │
│  └─ transformers                                            │
└─────────────────────────────────────────────────────────────┘
```

## The Problem

Frontend (npm) needs to call Python tool (llm CLI) → Plugin discovery

```
npm test:vlm
   └─> node scripts/docs-overview-vlm.ts
       └─> execa('llm', [...])
           └─> WHERE IS LLM? 🤔
```

## Solution Options

### 🎯 RECOMMENDED: Unified Root Environment

**Move plugin into root pixi environment**

```toml
# Add to pyproject.toml
[tool.pixi.pypi-dependencies]
llm-mlx-vlm = { path = "frontend/external/llm-mlx-vlm", editable = true }

[tool.pixi.tasks]
vlm-viewer = "npm --prefix frontend run vlm:viewer"
```

**Usage:**
```bash
pixi install              # Sets up everything
pixi run vlm-viewer       # Just works! 🎉
```

**Flow:**
```
pixi run vlm-viewer
   └─> npm --prefix frontend run vlm:viewer
       └─> node scripts/docs-overview-vlm.ts
           └─> llm (from pixi environment PATH) ✅
               └─> llm-mlx-vlm plugin (auto-discovered) ✅
```

### Alternative: Keep Separate (More Explicit)

```json
// frontend/package.json
{
  "scripts": {
    "vlm:viewer": "LLM_BIN='pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm' node scripts/docs-overview-vlm.ts --suite viewer"
  }
}
```

**Usage:**
```bash
npm run vlm:viewer
```

**Flow:**
```
npm run vlm:viewer
   └─> node scripts/docs-overview-vlm.ts
       └─> process.env.LLM_BIN || 'llm'
           └─> pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm ✅
```

## Quick Decision Guide

| Your Situation | Choose | Command |
|----------------|--------|---------|
| Mac dev, use pixi for everything | **Unified** | `pixi run vlm-viewer` |
| Mac dev, prefer npm | Keep separate | `npm run vlm:viewer` |
| CI/CD Mac runner | Keep separate | `LLM_BIN="pixi run ..." npm run vlm:viewer` |
| CI/CD Linux | Use cloud API | `VLM_MODEL=claude-3-haiku npm run vlm:viewer` |
| Quick test, have pip | System install | `pip install -e frontend/external/llm-mlx-vlm && npm run vlm:viewer` |

## My Recommendation

**Go with Unified Root Environment** because:

1. ✅ You already use pixi for backend
2. ✅ Single command: `pixi run test-all` runs backend + frontend + VLM
3. ✅ Faster: no subprocess pixi overhead
4. ✅ Simpler: one environment to manage
5. ✅ Consistent: same Python/deps everywhere

**Trade-off:** MLX only works on Mac, but you can:
- Use Ollama fallback for Linux: `VLM_MODEL=llava`
- Use cloud API: `VLM_MODEL=claude-3-haiku`
- Add platform-specific pixi features (coming in pixi 0.40)

## Implementation

See `ENVIRONMENT_ARCHITECTURE.md` for full implementation details.

**TL;DR:**
```bash
# 1. Edit root pyproject.toml - add plugin to [tool.pixi.pypi-dependencies]
# 2. Run: pixi install
# 3. Test: pixi run llm models | grep MLX-VLM
# 4. Use: pixi run npm --prefix frontend run vlm:viewer
```
