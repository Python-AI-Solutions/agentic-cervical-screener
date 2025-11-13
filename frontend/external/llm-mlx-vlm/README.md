# llm-mlx-vlm

LLM plugin for running **Vision Language Models** using [MLX](https://github.com/ml-explore/mlx) on Apple Silicon.

This plugin integrates [mlx-vlm](https://github.com/Blaizzy/mlx-vlm) with [Simon Willison's LLM CLI](https://llm.datasette.io/), providing fast, local VLM inference optimized for Mac.

## Features

- **Fast**: MLX is optimized for Apple Silicon, providing 5-10x faster inference than Ollama
- **Small Models**: Includes SmolVLM-256M (~500MB), SmolVLM-500M (~1GB), and Qwen2-VL-2B (~2GB)
- **Low Memory**: Peak memory usage around 2GB for SmolVLM-500M
- **Easy Integration**: Works seamlessly with the `llm` CLI tool
- **Local**: No API keys or internet connection required

## Installation

### Prerequisites

- macOS with Apple Silicon (M1/M2/M3/M4)
- Python 3.10 or later
- [LLM CLI](https://llm.datasette.io/) installed

### Install via pip (once published)

```bash
llm install llm-mlx-vlm
```

### Development Installation (Local)

Using pixi (recommended):
```bash
cd llm-mlx-vlm
pixi install
pixi run install-dev
```

Or using pip:
```bash
cd llm-mlx-vlm
pip install -e .
```

## Usage

Once installed, the plugin registers three VLM models with the `llm` CLI:

- **SmolVLM-256M**: Smallest, fastest model (~500MB)
- **SmolVLM-500M**: Balanced speed/quality (~1GB) - **recommended**
- **Qwen2-VL-2B**: Best quality (~2GB)

### Basic Usage

```bash
llm -m SmolVLM-500M "What's in this image?" -a image.png
```

### UI Analysis Example

```bash
llm -m SmolVLM-500M "Analyze this UI screenshot for visual quality and layout issues. Respond with JSON: {\"severity\": \"low/medium/high\", \"notes\": \"brief description\"}." -a screenshot.png
```

### List Available Models

```bash
llm models
```

Look for models prefixed with `MLX-VLM:`.

## Integration with Testing Suite

This plugin was created to enable fast VLM-based aesthetic testing for the Agentic Cervical Screener project. You can use it in your own test suites:

```typescript
// In your test script
const { stdout } = await execa('llm', [
  '-m', 'SmolVLM-500M',
  '--no-stream',
  '--no-log',
  '-a', screenshotPath,
  uiAnalysisPrompt,
], { timeout: 30000 });
```

## Performance

Based on testing with SmolVLM-500M:

- **Prompt processing**: ~506 tokens/sec
- **Generation**: ~109 tokens/sec
- **Peak memory**: ~1.9GB
- **Typical response time**: 5-15 seconds (vs 30-60s for Ollama)

## Development

### Setup with Pixi (Recommended)

```bash
cd llm-mlx-vlm
pixi install
pixi run install-dev
```

### Testing

```bash
# List models
pixi run llm models

# Test with an image
pixi run llm -m SmolVLM-500M "Describe this image" -a test.png
```

### Project Structure

```
llm-mlx-vlm/
├── llm_mlx_vlm.py     # Plugin implementation
├── pyproject.toml      # Python package config
├── pixi.toml          # Pixi environment config
├── tests/             # Test suite
└── README.md          # This file
```

## How It Works

The plugin:

1. Registers MLX-VLM models with the LLM plugin system
2. Intercepts calls to registered models
3. Extracts image attachments from the prompt
4. Calls `mlx_vlm.generate` with the model, image, and prompt
5. Returns the generated text

## Limitations

- **Mac-only**: MLX requires Apple Silicon
- **Image-only**: Currently supports only image attachments (no video/audio yet)
- **Single image**: Only processes the first attached image
- **No streaming**: Responses are returned all at once

## Troubleshooting

### "MLX-VLM requires an image attachment"

Make sure you're using the `-a` flag to attach an image:
```bash
llm -m SmolVLM-500M "prompt" -a image.png
```

### "mlx-vlm is not installed"

Install mlx-vlm:
```bash
pip install mlx-vlm
```

### Model download is slow

First run will download the model from HuggingFace (~1-2GB). Subsequent runs are fast.

## Related Projects

- [LLM](https://github.com/simonw/llm) - Simon Willison's LLM CLI tool
- [mlx-vlm](https://github.com/Blaizzy/mlx-vlm) - VLM inference using MLX
- [MLX](https://github.com/ml-explore/mlx) - Apple's ML framework

## License

Apache 2.0
