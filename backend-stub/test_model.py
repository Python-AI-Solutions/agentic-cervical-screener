import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

try:
    from .model_loader import initialize_model
    print("Import successful")
    
    # Try to initialize model
    model_path = "models/best.pt"
    print(f"Looking for model at: {os.path.abspath(model_path)}")
    print(f"File exists: {os.path.exists(model_path)}")
    
    if os.path.exists(model_path):
        print("Model file found, trying to load...")
        model = initialize_model(model_path)
        print("Model loaded successfully!")
    else:
        print("Model file not found!")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()