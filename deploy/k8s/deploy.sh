#!/bin/bash

# Cervical Screener Kubernetes Deployment Script
set -e

echo "🚀 Starting Cervical Screener K8s Deployment..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

echo "📦 Building Docker images..."

# Build frontend image
echo "Building frontend image..."
docker build -t cervical-frontend:latest .

# Build backend image
echo "Building backend image..."
docker build -f backend-stub/Dockerfile -t cervical-backend:latest .

echo "✅ Images built successfully!"

# Check if we're deploying to a remote cluster
if [ "$1" = "--remote" ]; then
    echo "🌐 Deploying to remote cluster..."
    echo "Please ensure you have:"
    echo "1. kubectl configured for your remote cluster"
    echo "2. Images pushed to a registry accessible by your cluster"
    echo "3. Updated image names in deploy.yaml to use your registry"
    echo ""
    echo "Example:"
    echo "docker tag cervical-frontend:latest your-registry/cervical-frontend:latest"
    echo "docker push your-registry/cervical-frontend:latest"
    echo ""
    echo "Then update deploy.yaml and run:"
    echo "kubectl apply -f deploy/k8s/"
else
    echo "🏠 Deploying to local cluster (minikube/kind)..."

    # Check if we're in minikube context
    if kubectl config current-context | grep -q "minikube"; then
        echo "📱 Detected minikube context"
        # Load images into minikube
        echo "Loading images into minikube..."
        minikube image load cervical-frontend:latest
        minikube image load cervical-backend:latest
        echo "✅ Images loaded into minikube"
    elif kubectl config current-context | grep -q "kind"; then
        echo "🐳 Detected kind context"
        # Load images into kind
        echo "Loading images into kind..."
        kind load docker-image cervical-frontend:latest
        kind load docker-image cervical-backend:latest
        echo "✅ Images loaded into kind"
    else
        echo "⚠️  Warning: Not in minikube/kind context. Make sure your local cluster can access the images."
    fi

    echo "🚀 Applying Kubernetes manifests..."
    kubectl apply -f deploy/k8s/

    echo "⏳ Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/cervical-frontend
    kubectl wait --for=condition=available --timeout=300s deployment/cervical-backend

    echo "✅ Deployment completed!"

    # Show status
    echo ""
    echo "📊 Deployment Status:"
    kubectl get pods
    kubectl get services
    kubectl get ingress

    echo ""
    echo "🌐 Access your application:"
    if kubectl config current-context | grep -q "minikube"; then
        echo "Frontend: $(minikube service cervical-frontend --url)"
        echo "Backend: $(minikube service cervical-backend --url)"
    else
        echo "Check your ingress configuration for the external URL"
    fi
fi

echo ""
echo "🎉 Deployment script completed!"
