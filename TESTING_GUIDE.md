# Testing Guide - GitHub Actions & Docker Build

## 🧪 **How to Test Everything is Working**

### **Step 1: Pre-Test Checklist**

Before testing, ensure:
- [ ] Admin has added `GCP_SA_KEY` secret to GitHub repository
- [ ] Service Account has `Artifact Registry Writer` role
- [ ] Artifact Registry repository `docker-builds` exists in `us-central1`
- [ ] You have push access to the repository

### **Step 2: Test Methods**

#### **Method 1: Manual Trigger (Recommended for Testing)**

1. **Go to GitHub Repository**
   - Navigate to **Actions** tab
   - Find **"Build and Push to GCP Artifact Registry"** workflow
   - Click **"Run workflow"** button
   - Select branch (usually `main` or `master`)
   - Click **"Run workflow"**

2. **Monitor the Build**
   - Click on the running workflow
   - Watch each step complete
   - Check for any errors

#### **Method 2: Push to Main Branch**

1. **Make a small change** to any file (e.g., add a comment)
2. **Commit and push** to main branch:
   ```bash
   git add .
   git commit -m "Test GitHub Actions workflow"
   git push origin main
   ```
3. **Check GitHub Actions** tab for automatic trigger

#### **Method 3: Create a Tag (Version Release)**

1. **Create and push a tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. **Check GitHub Actions** for tag-triggered build

### **Step 3: Verify Success**

#### **✅ GitHub Actions Success Indicators**

1. **All steps show green checkmarks** ✅
2. **No red X marks** ❌
3. **Build completes successfully**
4. **"Update deployment with new image"** step runs (for main branch)

#### **✅ GCP Artifact Registry Verification**

1. **Go to GCP Console** → Artifact Registry
2. **Navigate to**: `us-central1` → `docker-builds`
3. **Look for**: `agentic-cervical-screener` image
4. **Check tags**: Should show `latest` (for main branch) or version tag

#### **✅ Deployment File Update**

1. **Check `deploy/k8s/deploy.yaml`**
2. **Look for updated image tag**:
   ```yaml
   image: us-central1-docker.pkg.dev/midyear-pattern-470017-b8/docker-builds/agentic-cervical-screener:latest
   ```

### **Step 4: Test Kubernetes Deployment**

#### **Deploy Updated Image to Kubernetes**

1. **Apply the updated deployment**:
   ```bash
   kubectl apply -f deploy/k8s/deploy.yaml
   ```

2. **Check if pod restarts with new image**:
   ```bash
   kubectl get pods -w
   ```

3. **Verify new image is being used**:
   ```bash
   kubectl describe pod <pod-name>
   ```

4. **Test the application**:
   ```bash
   curl -k https://104-198-164-116.nip.io/
   ```

### **Step 5: Troubleshooting Common Issues**

#### **❌ Authentication Failed**
```
Error: failed to solve: failed to push to us-central1-docker.pkg.dev
```
**Solution**: Check that `GCP_SA_KEY` secret is correctly set

#### **❌ Permission Denied**
```
Error: denied: Permission "artifactregistry.repositories.downloadArtifacts" denied
```
**Solution**: Admin needs to add `Artifact Registry Writer` role to Service Account

#### **❌ Repository Not Found**
```
Error: repository docker-builds not found
```
**Solution**: Admin needs to create the Artifact Registry repository

#### **❌ Build Failed**
```
Error: failed to solve: failed to build
```
**Solution**: Check Dockerfile and build context

### **Step 6: Success Verification Checklist**

- [ ] **GitHub Action runs successfully** ✅
- [ ] **Docker image appears in GCP Artifact Registry** ✅
- [ ] **Image has correct tag** (`latest` or version) ✅
- [ ] **deploy.yaml updated** with new image ✅
- [ ] **Kubernetes deployment works** with new image ✅
- [ ] **Application accessible** via HTTPS ✅

### **Step 7: Clean Up (Optional)**

After testing, you can:
1. **Delete test images** from Artifact Registry (if needed)
2. **Revert deployment** to previous image (if needed)
3. **Remove test commits** (if needed)

## 🎯 **Expected Results**

### **Successful Test Should Show:**

1. **GitHub Actions**: ✅ All green checkmarks
2. **GCP Console**: New Docker image with correct tag
3. **Kubernetes**: Pod restarts with new image
4. **Application**: Still accessible at `https://104-198-164-116.nip.io/`

### **Image Tags by Trigger:**

- **Main branch push**: `latest`
- **Tag push**: `v1.0.0` (or whatever tag you used)
- **Other branches**: `abc12345` (commit SHA)

## 🚀 **Next Steps After Successful Test**

1. **Set up automatic deployments** (if desired)
2. **Create version tags** for releases
3. **Monitor builds** for any issues
4. **Set up notifications** for build failures

---

**🎉 If all tests pass, your GitHub Actions setup is working perfectly!**
