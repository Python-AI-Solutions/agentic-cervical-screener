# Production Environment

This directory contains the Kustomize overlay for the production environment.

## Deployment

To deploy to production:

```bash
# Apply the production configuration
kubectl apply -k deploy/k8s/production/

# Or preview what will be deployed
kubectl kustomize deploy/k8s/production/

# Or using kustomize directly
kustomize build deploy/k8s/production/ | kubectl apply -f -
```

## Production Configuration

The production environment has the following customizations:
- **Namespace**: `production`
- **Environment**: INFO logging
- **Replicas**: 2 (high availability)
- **Domain**: `cervical-screening.pythonaisolutions.com`
- **Resources**: Higher CPU/Memory limits
- **PodDisruptionBudget**: Enabled (ensures minimum availability)

## Verify Deployment

```bash
# Check all resources in production namespace
kubectl get all -n production

# Check deployment status
kubectl rollout status deployment/cervical-ai-viewer -n production

# Check logs
kubectl logs -n production -l app=cervical-ai-viewer --tail=100 -f

# Check configmap
kubectl get configmap cervical-ai-config -n production -o yaml

# Check pod distribution
kubectl get pods -n production -o wide
```

## Update Image

To update the image version:

1. Edit the production/kustomization.yaml to uncomment and set the image tag
2. Apply the changes:
   ```bash
   kubectl apply -k deploy/k8s/production/
   ```

## Rollback

If you need to rollback:

```bash
kubectl rollout undo deployment/cervical-ai-viewer -n production
```

## Health Checks

```bash
# Check service endpoints
kubectl get endpoints cervical-ai-viewer -n production

# Check ingress
kubectl get ingressroute cervical-ai-viewer -n production -o yaml
```

