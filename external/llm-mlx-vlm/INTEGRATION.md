# Integration with Agentic Cervical Screener

This document describes how to use the `llm-mlx-vlm` plugin with the repository's screenshot + VLM audit workflow.

## Quick Start

### 1. Install the plugin

From the repo root:

```bash
pixi install --manifest-path external/llm-mlx-vlm/pixi.toml
pixi run --manifest-path external/llm-mlx-vlm/pixi.toml install-dev
```

### 2. Capture screenshots

Install Playwright browsers (once), then capture screenshots:

```bash
pixi run install-browsers
pixi run vlm-capture
```

### 3. Run the audit (using MLX-VLM via `llm`)

```bash
LLM_BIN="pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm"  # Use plugin's pixi env
VLM_MODEL=pixtral-12b-4bit \
VLM_TIMEOUT_MS=45000 \
pixi run vlm-audit
```

## Environment Variables

```bash
# Model selection (registered by the plugin)
VLM_MODEL=SmolVLM-256M
VLM_MODEL=SmolVLM-500M
VLM_MODEL=pixtral-12b-4bit
VLM_MODEL=Qwen2-VL-2B

# LLM CLI binary (supports full commands, not just an executable path)
LLM_BIN=llm
LLM_BIN="pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm"

# Timeouts / retries
VLM_TIMEOUT_MS=45000
VLM_MAX_ATTEMPTS=3
VLM_ARGS="--temperature 0.0 --max-tokens 400"
```

## Troubleshooting

### Plugin not found

```bash
pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm models | rg MLX-VLM
```

Should show models prefixed with `MLX-VLM:`.
