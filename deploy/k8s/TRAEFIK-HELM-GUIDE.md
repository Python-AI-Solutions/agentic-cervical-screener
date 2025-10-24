# Traefik ACME Persistent Storage - Helm Guide

## Problem

Traefik loses Let's Encrypt certificates on pod restart because of ephemeral storage (emptyDir), causing:
- ❌ Certificate loss on restart
- ❌ Let's Encrypt rate limits
- ❌ Self-signed certificate warnings

## Solution

Deploy/upgrade Traefik with Helm using persistent storage for ACME certificates.

## 🚀 Quick Start

### Prerequisites

```bash
# Install Helm if not already installed
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add Traefik Helm repository
helm repo add traefik https://traefik.github.io/charts
helm repo update

# Find your Traefik namespace
kubectl get deployments -A | grep traefik
# Look for the namespace column (usually 'traefik', 'traefik-system', or 'kube-system')

# Or find the Helm release
helm list -A | grep traefik
```

### Step 1: Verify Email Configuration

The email is already configured as `johnlee@pythonaisolutions.com`. If you need to change it, update both places in `traefik-values.yaml`:
- Line ~17: `email: johnlee@pythonaisolutions.com`
- Line ~30: `--certificatesresolvers.letsencrypt.acme.email=johnlee@pythonaisolutions.com`

### Step 2: Deploy Traefik

**Important:** Replace `traefik` with your actual namespace if different (check with `kubectl get deployments -A | grep traefik`)

**For new installation:**
```bash
helm install traefik traefik/traefik \
  --namespace traefik \
  --values traefik-values.yaml \
  --create-namespace
```

**For existing installation (upgrade):**
```bash
helm upgrade traefik traefik/traefik \
  --namespace traefik \
  --values traefik-values.yaml
```

**Note:** 
- Don't use `--reuse-values` if you want a clean configuration with only values from the file
- Use `--reuse-values` if you want to keep existing custom configurations

### Step 3: Verify

```bash
# Replace 'traefik' with your actual namespace if different

# Check deployment
kubectl get deployments -n traefik

# Check PVC is created and bound
kubectl get pvc -n traefik

# Check pods are running
kubectl get pods -n traefik -l app.kubernetes.io/name=traefik

# Verify volume mount
kubectl describe pod -n traefik -l app.kubernetes.io/name=traefik | grep -A 5 "Mounts:"

# Check ACME storage
kubectl exec -n traefik deployment/traefik -- ls -la /data/
```

## 📋 Configuration Details

### Persistent Storage

The `traefik-values.yaml` configures:
- **Size**: 1Gi (sufficient for certificates)
- **Access Mode**: ReadWriteOnce
- **Mount Path**: `/data`
- **ACME File**: `/data/acme.json`

### Let's Encrypt Setup

**Default**: Uses staging environment (safe for testing)
- No impact on production rate limits
- Issues test certificates (browser warnings expected)

**Production**: After successful testing
1. Edit `traefik-values.yaml`
2. Comment out staging lines (lines 19, 32)
3. Uncomment production lines (lines 22, 35)
4. Upgrade: `helm upgrade traefik traefik/traefik --namespace kube-system --values traefik-values.yaml`

### Storage Class

If your cluster requires a specific StorageClass:

```yaml
# In traefik-values.yaml
persistence:
  storageClass: "standard"  # or "local-path", "hostpath", etc.
```

Find available storage classes:
```bash
kubectl get storageclass
```

## ✅ Testing Certificate Persistence

```bash
# Replace 'traefik' with your actual namespace if different

# 1. Check current certificate
kubectl exec -n traefik deployment/traefik -- cat /data/acme.json

# 2. Delete pod (will be recreated)
kubectl delete pod -n traefik -l app.kubernetes.io/name=traefik

# 3. Wait for new pod
kubectl wait --for=condition=Ready pod -n traefik -l app.kubernetes.io/name=traefik --timeout=60s

# 4. Verify certificate persisted
kubectl exec -n traefik deployment/traefik -- cat /data/acme.json

# Certificate should still be there!
```

## 🔍 Troubleshooting

### PVC Not Bound

```bash
# Check PVC status (replace 'traefik' with your namespace)
kubectl get pvc -n traefik
kubectl describe pvc -n traefik

# Check available storage classes
kubectl get storageclass

# If needed, specify storage class in traefik-values.yaml
```

### Certificate Not Acquiring

```bash
# Check Traefik logs (replace 'traefik' with your namespace)
kubectl logs -n traefik deployment/traefik -f | grep -i "certificate\|acme"

# Common issues:
# 1. Domain not accessible via HTTP - check DNS and firewall
# 2. Rate limit hit - wait or use staging
# 3. Wrong email format - check email in values
# 4. Firewall blocking Let's Encrypt - see FIX-FIREWALL-FOR-ACME.md
```

**If you see "Timeout during connect (likely firewall problem)":**

This means Let's Encrypt cannot reach your HTTP endpoint. **See [FIX-FIREWALL-FOR-ACME.md](./FIX-FIREWALL-FOR-ACME.md)** for detailed fix.

Quick fix for GKE:
```bash
# Allow HTTP from anywhere (required for Let's Encrypt)
gcloud compute firewall-rules create k8s-allow-lb-http \
  --allow=tcp:80 \
  --source-ranges=0.0.0.0/0 \
  --description="Allow HTTP for Let's Encrypt"
```

### Check Helm Release

```bash
# Find your Traefik namespace first
helm list -A | grep traefik

# List Traefik releases (replace 'traefik' with your namespace)
helm list -n traefik

# Get current values
helm get values traefik -n traefik

# Check release history
helm history traefik -n traefik

# Rollback if needed
helm rollback traefik -n traefik
```

## 🔄 Switching from Staging to Production

After testing with staging certificates:

```bash
# Replace 'traefik' with your actual namespace if different

# 1. Backup current state (optional)
kubectl cp traefik/$(kubectl get pod -n traefik -l app.kubernetes.io/name=traefik -o jsonpath='{.items[0].metadata.name}'):/data/acme.json ./acme-staging-backup.json

# 2. Edit traefik-values.yaml
# - Comment out staging caServer lines (lines ~19, ~32)
# - Uncomment production caServer lines (lines ~22, ~35)

# 3. Remove existing staging certificates
kubectl exec -n traefik deployment/traefik -- rm -f /data/acme.json

# 4. Upgrade with production config
helm upgrade traefik traefik/traefik \
  --namespace traefik \
  --values traefik-values.yaml

# 5. Monitor certificate acquisition
kubectl logs -n traefik deployment/traefik -f | grep -i acme
```

## 🎯 Success Indicators

You'll know it's working when:

1. ✅ PVC shows "Bound": `kubectl get pvc -n traefik`
2. ✅ Volume mounted at `/data`: `kubectl describe pod -n traefik -l app.kubernetes.io/name=traefik`
3. ✅ `acme.json` file exists: `kubectl exec -n traefik deployment/traefik -- ls /data/`
4. ✅ Certificate persists after pod deletion
5. ✅ Browser shows valid certificate (after switching to production)

## 📚 Additional Commands

```bash
# Replace 'traefik' with your actual namespace if different

# Uninstall Traefik (careful!)
helm uninstall traefik -n traefik

# Upgrade to latest Traefik version
helm repo update
helm upgrade traefik traefik/traefik \
  --namespace traefik \
  --values traefik-values.yaml

# Export current config
helm get values traefik -n traefik > current-values.yaml

# View all Traefik resources
kubectl get all -n traefik -l app.kubernetes.io/name=traefik
```

## 🔐 Security Notes

1. **Email Required**: Let's Encrypt requires valid email for certificate notifications
2. **Backup Certificates**: Store `acme.json` securely
3. **Rate Limits**: Use staging first to avoid production rate limits
4. **Storage**: PVC data persists even if Traefik is uninstalled

## 📊 Monitoring

```bash
# Replace 'traefik' with your actual namespace if different

# Watch pod status
kubectl get pods -n traefik -l app.kubernetes.io/name=traefik -w

# Stream logs
kubectl logs -n traefik deployment/traefik -f

# Check certificate expiration
kubectl logs -n traefik deployment/traefik | grep -i "renew\|expire"
```

## ⚠️ Important Notes

- **Staging First**: Always test with staging CA before production
- **Rate Limits**: Let's Encrypt has strict rate limits (50 certs/domain/week)
- **Public Access**: Domain must be publicly accessible for HTTP challenge
- **DNS Required**: DNS must resolve to your cluster's external IP
- **Wait Time**: If rate limited, you may need to wait 7 days

## 🌐 Resources

- **Traefik Helm Chart**: https://github.com/traefik/traefik-helm-chart
- **Let's Encrypt Docs**: https://letsencrypt.org/docs/
- **Traefik ACME**: https://doc.traefik.io/traefik/https/acme/
- **Rate Limits**: https://letsencrypt.org/docs/rate-limits/

---

**Need Help?** Check logs first: `kubectl logs -n kube-system deployment/traefik -f`

