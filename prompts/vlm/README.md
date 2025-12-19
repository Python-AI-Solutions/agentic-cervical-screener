# VLM Audit Prompts

Prompt templates for VLM-based visual quality audits.

## Files

- `viewer-audit.txt` - Prompt for auditing the static viewer UI screenshots
- `docs-audit.txt` - Prompt for auditing documentation/workflow screenshots

## Usage

Generate screenshots:

```bash
pixi run vlm-capture
```

Run the audit (requires `llm` CLI):

```bash
pixi run vlm-audit
```

## Where The Model Runs

- Remote providers (e.g. OpenAI via `llm` default models) require the appropriate API key (e.g. `OPENAI_API_KEY`) and network access; nothing is downloaded locally beyond normal CLI caches.
- Local providers (e.g. MLX-VLM on Apple Silicon) download model weights on first use (HuggingFace cache) and run fully on-device; no separate server process is required.

Useful environment variables:

- `VLM_MODEL` - model name passed to `llm -m` (default: use `llm`'s configured default model)
- `LLM_BIN` - `llm` command to run (default: `llm`, supports full commands like `pixi run ... llm`)
- `VLM_ARGS` - extra args appended to the `llm` command
- `VLM_TIMEOUT_MS` - per-screenshot timeout (default: `180000`)
- `VLM_MAX_ATTEMPTS` - retries when JSON parsing fails (default: `3`)

## Local MLX-VLM on macOS (optional)

If you're on Apple Silicon, you can run audits locally via `external/llm-mlx-vlm`:

```bash
pixi install --manifest-path external/llm-mlx-vlm/pixi.toml
pixi run --manifest-path external/llm-mlx-vlm/pixi.toml install-dev

LLM_BIN="pixi run --manifest-path external/llm-mlx-vlm/pixi.toml llm" \
VLM_MODEL=pixtral-12b-4bit \
pixi run vlm
```

If `LLM_BIN` points at `external/llm-mlx-vlm`, the audit defaults `VLM_MODEL=pixtral-12b-4bit` unless you override it.
