# Staging Environment

This directory contains the Kustomize overlay for the staging environment.

## Deployment

To deploy to staging:

```bash
# Apply the staging configuration
kubectl apply -k deploy/k8s/staging/

# Or preview what will be deployed
kubectl kustomize deploy/k8s/staging/

# Or using kustomize directly
kustomize build deploy/k8s/staging/ | kubectl apply -f -
```

## Staging Configuration

The staging environment has the following customizations:
- **Namespace**: `staging`
- **Environment**: DEBUG logging enabled
- **Replicas**: 1 (single instance)
- **Domain**: `staging.cervical-screening.pythonaisolutions.com`
- **PodDisruptionBudget**: Disabled (not needed for single replica)

## Verify Deployment

```bash
# Check all resources in staging namespace
kubectl get all -n staging

# Check deployment status
kubectl rollout status deployment/cervical-ai-viewer -n staging

# Check logs
kubectl logs -n staging -l app=cervical-ai-viewer --tail=100 -f

# Check configmap
kubectl get configmap cervical-ai-config -n staging -o yaml
```

## Update Image

To update the image version:

1. Edit the base deployment or add an image patch in this overlay
2. Apply the changes:
   ```bash
   kubectl apply -k deploy/k8s/staging/
   ```

## Rollback

If you need to rollback:

```bash
kubectl rollout undo deployment/cervical-ai-viewer -n staging
```

