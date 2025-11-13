# Integration Strategy Comparison: Strategy 4 vs Frontend Pixi

## Strategy 4: Hybrid npm + Post-install Hook

Keep npm as primary frontend tool, add post-install automation.

### Implementation

```json
// package.json
{
  "scripts": {
    "postinstall": "cd external/llm-mlx-vlm && (pixi install || echo 'Pixi not found, skipping VLM setup') && (pixi run install-dev || true)",
    "pretest:vlm": "test -d external/llm-mlx-vlm/.pixi || npm run setup:vlm",
    "setup:vlm": "cd external/llm-mlx-vlm && pixi install && pixi run install-dev",
    "vlm:viewer": "node scripts/docs-overview-vlm.ts --suite viewer",
    "vlm:docs": "node scripts/docs-overview-vlm.ts --suite docs-overview",
    "test:vlm": "npm run vlm:docs && npm run vlm:viewer"
  }
}
```

```typescript
// scripts/docs-overview-vlm.ts
const llmBin = process.env.LLM_BIN ??
  'pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm';
```

### Workflow

```bash
# First time setup
npm install                # Automatically sets up VLM plugin
npx playwright install     # Install browsers

# Daily usage
npm run dev                # Start dev server
npm run test:e2e          # Run E2E tests
npm run test:vlm          # Run VLM tests (auto-setup if needed)
```

### Pros
✅ **npm-centric**: Frontend devs use familiar npm commands
✅ **Automatic setup**: `npm install` handles VLM plugin
✅ **Graceful degradation**: Works without pixi (prints warning)
✅ **Lazy loading**: VLM plugin only sets up when needed
✅ **Cross-platform**: npm works everywhere
✅ **Isolated**: Plugin has own environment

### Cons
❌ **Requires pixi**: Devs must install pixi separately
❌ **Slower npm install**: Post-install adds ~30-60s first time
❌ **Hidden complexity**: Setup happens automatically
❌ **Two package managers**: npm + pixi
❌ **Platform detection**: Need logic to handle Mac vs Linux

---

## Frontend Pixi Environment (Your Idea)

Frontend gets its own pixi environment that wraps npm.

### Implementation

```toml
# frontend/pixi.toml
[project]
name = "agentic-cervical-screener-frontend"
channels = ["conda-forge"]
platforms = ["osx-arm64", "osx-64", "linux-64"]

[dependencies]
nodejs = "20.*"
npm = "*"
python = "3.12.*"

[target.osx-arm64.pypi-dependencies]
llm = "*"
llm-mlx-vlm = { path = "external/llm-mlx-vlm", editable = true }

[target.osx-64.pypi-dependencies]
llm = "*"
llm-ollama = "*"

[target.linux-64.pypi-dependencies]
llm = "*"
llm-ollama = "*"

[tasks]
# npm passthrough
dev = "npm run dev"
build = "npm run build"
test = "npm test"
test-e2e = "npm run test:e2e"
test-vlm = "npm run test:vlm"
test-all = "npm run test:all"

# Setup
setup = "npm install"
install-browsers = "npx playwright install"
```

```json
// package.json (simplified - no post-install needed)
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test:vlm": "node scripts/docs-overview-vlm.ts"
  }
}
```

### Workflow

```bash
# First time setup
pixi install              # Sets up Node.js, npm, Python, llm, plugin
pixi run setup            # Runs npm install
pixi run install-browsers # Install Playwright browsers

# Daily usage
pixi run dev              # Start dev server
pixi run test-e2e         # Run E2E tests
pixi run test-vlm         # Run VLM tests
```

### Pros
✅ **Single tool**: Only pixi, npm is managed dependency
✅ **Unified environment**: Node + Python in one place
✅ **Platform-specific**: Automatic MLX on Mac, Ollama elsewhere
✅ **Fast**: No subprocess overhead
✅ **Reproducible**: pixi.lock ensures same versions
✅ **Clean PATH**: llm automatically available
✅ **Explicit**: `pixi run` makes it clear what's happening

### Cons
❌ **Pixi required**: All devs must use pixi
❌ **Learning curve**: Devs must learn pixi commands
❌ **npm habits**: Frontend devs expect `npm run dev`
❌ **Two configs**: pixi.toml + package.json
❌ **Lock file churn**: pixi.lock + package-lock.json

---

## Side-by-Side Comparison

| Aspect | Strategy 4 (npm + hook) | Frontend Pixi |
|--------|-------------------------|---------------|
| **Primary tool** | npm | pixi |
| **Setup command** | `npm install` | `pixi install && pixi run setup` |
| **Dev command** | `npm run dev` | `pixi run dev` |
| **Test command** | `npm run test:vlm` | `pixi run test-vlm` |
| **llm binary** | Subprocess to plugin pixi | In pixi PATH |
| **Performance** | Slower (subprocess) | Fast (direct) |
| **Frontend dev UX** | Familiar npm | New pixi commands |
| **Python deps** | Isolated in plugin | Shared in frontend env |
| **Platform handling** | Manual env vars | Automatic via targets |
| **Graceful fallback** | Can skip VLM setup | Must have pixi |
| **Lock files** | package-lock.json | package-lock.json + pixi.lock |
| **CI/CD** | npm commands | pixi commands |

---

## Platform-Specific Behavior Comparison

### Strategy 4 (npm + hook)

**Mac (Apple Silicon):**
```bash
npm install  # Sets up external/llm-mlx-vlm (MLX)
npm run test:vlm  # Uses MLX-VLM
```

**Mac (Intel) or Linux:**
```bash
npm install  # Sets up external/llm-mlx-vlm (fails on non-ARM)
npm run test:vlm  # Falls back to system llm + Ollama
# OR: VLM_MODEL=claude-3-haiku npm run test:vlm  # Use cloud API
```

### Frontend Pixi

**Mac (Apple Silicon):**
```bash
pixi install  # Installs llm + llm-mlx-vlm (via target.osx-arm64)
pixi run test-vlm  # Uses MLX-VLM
```

**Mac (Intel):**
```bash
pixi install  # Installs llm + llm-ollama (via target.osx-64)
pixi run test-vlm  # Uses Ollama
```

**Linux:**
```bash
pixi install  # Installs llm + llm-ollama (via target.linux-64)
pixi run test-vlm  # Uses Ollama
```

---

## Developer Experience

### Strategy 4: npm Developer

```bash
# First day
git clone repo
cd frontend
npm install        # ✅ Familiar, automatic VLM setup
npm run dev        # ✅ Just works

# Daily work
npm run test:e2e   # ✅ Familiar npm workflow
npm run test:vlm   # ✅ VLM tests (uses pixi under the hood)

# Troubleshooting
# ❌ "Where is pixi?" - needs separate install
# ❌ Post-install failures are confusing
# ❌ Subprocess overhead is slow
```

### Frontend Pixi: pixi Developer

```bash
# First day
git clone repo
cd frontend
pixi install       # ⚡ Fast, reproducible
pixi run setup     # Install npm deps
pixi run dev       # ✅ Fast, clean environment

# Daily work
pixi run test-e2e  # ⚡ Fast, integrated
pixi run test-vlm  # ⚡ No subprocess overhead

# Troubleshooting
# ✅ Everything in one place
# ✅ Platform-specific setup automatic
# ❌ Must learn pixi commands
# ❌ Breaks npm muscle memory
```

---

## Recommended Choice: **Frontend Pixi** (Your Idea)

### Why Frontend Pixi Wins:

1. **🎯 Unified Stack**: You already use pixi for backend - extend to frontend
2. **⚡ Performance**: No subprocess overhead calling `llm`
3. **🎨 Platform-aware**: Automatic Mac/Linux handling via targets
4. **📦 Reproducible**: Single `pixi install` sets up everything
5. **🔧 Maintainable**: One tool to learn, not npm + pixi hybrid
6. **🚀 Future-proof**: As project grows, pixi handles complexity better

### Migration Path:

```bash
# 1. Create frontend/pixi.toml (done! ✅)
# 2. Install dependencies
cd frontend
pixi install

# 3. Verify llm is available
pixi run llm models | grep MLX-VLM  # Mac ARM
pixi run llm models | grep ollama   # Mac Intel / Linux

# 4. Test npm passthrough
pixi run dev        # Should start Vite
pixi run test-vlm   # Should run VLM tests

# 5. Update docs to use pixi
```

### For npm-loving Developers:

Add aliases to make it feel like npm:

```bash
# In ~/.bashrc or ~/.zshrc
alias pnpm='pixi run'
alias pnpm-install='pixi install && pixi run setup'

# Then use:
pnpm dev           # Same as: pixi run dev
pnpm test          # Same as: pixi run test
```

Or create a Makefile:

```makefile
# Makefile
.PHONY: dev test install

install:
	pixi install && pixi run setup

dev:
	pixi run dev

test:
	pixi run test-all

test-vlm:
	pixi run test-vlm
```

Then devs can use:
```bash
make install
make dev
make test
```

---

## Implementation Checklist

- [x] Create `frontend/pixi.toml` with platform targets
- [ ] Test on Mac ARM64: `pixi install` → verify MLX-VLM
- [ ] Test on Mac x86_64: `pixi install` → verify Ollama fallback
- [ ] Test on Linux: `pixi install` → verify Ollama fallback
- [ ] Update `README.md` with pixi instructions
- [ ] Update `READY_TO_TEST.md` to use pixi commands
- [ ] Add pixi tasks for common operations
- [ ] (Optional) Add Makefile wrapper for npm fans

---

## Final Verdict

**Go with Frontend Pixi Environment** ✅

Your instinct was right - having frontend with its own pixi environment that wraps npm is the cleanest solution:

- Single tool philosophy (pixi everywhere)
- Platform-specific behavior built-in
- Better performance
- More maintainable long-term

The `frontend/pixi.toml` is already created and ready to test!

**Next step:** Run `pixi install` in frontend/ and verify everything works! 🚀
