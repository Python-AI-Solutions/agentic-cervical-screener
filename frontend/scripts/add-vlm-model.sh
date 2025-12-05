#!/bin/bash
# Helper script to add and test a new VLM model

set -e

MODEL_NAME="$1"
HF_PATH="$2"

if [ -z "$MODEL_NAME" ] || [ -z "$HF_PATH" ]; then
    echo "Usage: ./scripts/add-vlm-model.sh <model-name> <huggingface-path>"
    echo ""
    echo "Examples:"
    echo "  # Recommended models (tested and working):"
    echo "  ./scripts/add-vlm-model.sh pixtral-12b mlx-community/pixtral-12b-4bit"
    echo "  ./scripts/add-vlm-model.sh paligemma2-3b mlx-community/paligemma2-3b-mix-448-4bit"
    echo "  ./scripts/add-vlm-model.sh InternVL3-1B mlx-community/InternVL3-1B-4bit"
    echo ""
    echo "  # Other models:"
    echo "  ./scripts/add-vlm-model.sh Qwen3-VL-4B mlx-community/Qwen3-VL-4B-Instruct-4bit"
    echo ""
    echo "This will:"
    echo "  1. Add the model to external/llm-mlx-vlm/llm_mlx_vlm.py"
    echo "  2. Download the model"
    echo "  3. Test it on a sample image"
    exit 1
fi

PLUGIN_FILE="external/llm-mlx-vlm/llm_mlx_vlm.py"

echo "==> Adding model '$MODEL_NAME' to plugin..."

# Check if model already exists
if grep -q "\"$MODEL_NAME\"" "$PLUGIN_FILE"; then
    echo "Model already registered in plugin"
else
    # Add before the comment line about unsupported models using Python (more portable)
    python3 -c "
import sys
with open('$PLUGIN_FILE', 'r') as f:
    lines = f.readlines()

with open('$PLUGIN_FILE', 'w') as f:
    for line in lines:
        if line.strip().startswith('# Note: LLaVA'):
            f.write('    register(MlxVlmModel(\"$MODEL_NAME\", \"$HF_PATH\"))\n')
        f.write(line)
"
    echo "✓ Model added to plugin"
fi

echo ""
echo "==> Checking if model is available..."
if pixi run llm models | grep -q "$MODEL_NAME"; then
    echo "✓ Model registered with llm CLI"
else
    echo "✗ Model not found. Plugin may need to be reloaded."
    echo "  Try: cd external/llm-mlx-vlm && pixi run install-dev"
    exit 1
fi

echo ""
echo "==> Downloading model (this may take a few minutes)..."
echo "Running: pixi run llm -m $MODEL_NAME 'test'"
pixi run llm -m "$MODEL_NAME" "test" --no-log || true

echo ""
echo "==> Testing model on sample image..."
TEST_IMAGE="playwright-artifacts/viewer/viewer-desktop-viewer-context.png"
if [ ! -f "$TEST_IMAGE" ]; then
    echo "✗ Test image not found: $TEST_IMAGE"
    echo "  Generate test images first: pixi run test-e2e"
    exit 1
fi

echo "Running: pixi run llm -m $MODEL_NAME 'What do you see?' -a $TEST_IMAGE"
pixi run llm -m "$MODEL_NAME" "What do you see?" -a "$TEST_IMAGE"

echo ""
echo "==> ✓ Model '$MODEL_NAME' is ready to use!"
echo ""
echo "Next steps:"
echo "  - Test with audit prompt: pixi run llm -m $MODEL_NAME \"\$(cat prompts/vlm/viewer-audit.txt)\" -a $TEST_IMAGE"
echo "  - Run full audit: pixi run vlm-viewer --model $MODEL_NAME"
