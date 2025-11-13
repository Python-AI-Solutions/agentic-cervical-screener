#!/bin/bash
set -e

echo "========================================"
echo "Testing MLX-VLM Plugin Integration"
echo "========================================"
echo ""

# Check if plugin is installed
echo "[1/4] Checking if llm-mlx-vlm plugin is installed..."
cd external/llm-mlx-vlm
if pixi run llm models | grep -q "MLX-VLM"; then
    echo "✅ Plugin is installed and registered"
    echo ""
    pixi run llm models | grep "MLX-VLM"
else
    echo "❌ Plugin not found. Installing..."
    pixi install
    pixi run install-dev
    echo "✅ Plugin installed"
fi
echo ""

# Test with a sample image
cd ../..
echo "[2/4] Looking for test screenshots..."
if [ -f "playwright-artifacts/viewer/viewer-desktop-viewer-context.png" ]; then
    TEST_IMAGE="playwright-artifacts/viewer/viewer-desktop-viewer-context.png"
    echo "✅ Found test image: $TEST_IMAGE"
else
    echo "⚠️  No test screenshots found. Run Playwright tests first:"
    echo "   npm run test:e2e"
    exit 1
fi
echo ""

# Test the plugin directly
echo "[3/4] Testing MLX-VLM plugin directly..."
cd external/llm-mlx-vlm
pixi run llm -m SmolVLM-500M \
    "Analyze this image briefly. Respond with JSON: {\"type\":\"detected\", \"notes\":\"brief description\"}" \
    -a "../../$TEST_IMAGE"
echo ""
echo "✅ Direct plugin test successful"
echo ""

# Test via the VLM script
cd ../..
echo "[4/4] Testing via docs-overview-vlm.ts script..."
echo "Running: VLM_MODEL=SmolVLM-500M npm run vlm:viewer"
echo ""

VLM_MODEL=SmolVLM-500M VLM_TIMEOUT_MS=45000 npm run vlm:viewer

echo ""
echo "========================================"
echo "✅ All tests passed!"
echo "========================================"
echo ""
echo "Usage:"
echo "  npm run vlm:viewer                    # Uses SmolVLM-500M (default)"
echo "  VLM_MODEL=SmolVLM-256M npm run vlm:viewer  # Faster"
echo "  VLM_MODEL=Qwen2-VL-2B npm run vlm:viewer   # Better quality"
echo ""
