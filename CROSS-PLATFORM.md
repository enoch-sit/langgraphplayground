# Cross-Platform Deployment Guide

This guide covers building on Windows and deploying to Linux (or vice versa).

## ✅ **YES - Cross-Platform Works!**

Vite builds are platform-independent (just HTML/JS/CSS). You can:
- Build on Windows → Deploy to Linux ✅
- Build on Linux → Deploy to Windows ✅
- Build locally → Deploy to Docker ✅

---

## Deployment Strategies

### **Strategy 1: Build on Windows, Deploy to Linux (Manual)**

**On Windows (Development Machine):**

```cmd
REM 1. Build React frontend
cd frontend
npm install
npm run build

REM 2. Verify build
dir dist
REM Should see: index.html, assets\

REM 3. Commit to Git
cd ..
git add frontend/dist/
git commit -m "Build React frontend for deployment"
git push
```

**On Linux Server:**

```bash
# 1. Pull latest code
git pull

# 2. Verify React build exists
ls frontend/dist/
# Should see: index.html, assets/

# 3. Start FastAPI (serves React + API)
uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024
```

**Pros:**
- ✅ Simple
- ✅ No Node.js on server needed
- ✅ Fast deployment

**Cons:**
- ⚠️ Must commit build files to Git
- ⚠️ Larger repo size

---

### **Strategy 2: Build on Linux Server (Recommended)**

**On Windows (Development):**

```cmd
REM 1. Develop and test locally
cd frontend
npm run dev

REM 2. Commit source code only (NOT dist/)
cd ..
git add frontend/src/ frontend/package.json frontend/vite.config.ts
git commit -m "Update React frontend"
git push
```

**On Linux Server:**

```bash
# 1. Pull latest code
git pull

# 2. Install Node.js (one-time setup)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Build React on server
cd frontend
npm install
npm run build

# 4. Start FastAPI
cd ..
uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024
```

**Pros:**
- ✅ Clean Git history (no build files)
- ✅ Smaller repo
- ✅ Reproducible builds

**Cons:**
- ⚠️ Requires Node.js on server
- ⚠️ Slightly slower deployment

---

### **Strategy 3: Docker Build (BEST for Production)**

**Dockerfile already updated** to build React automatically!

**On Any Platform:**

```bash
# Build Docker image (includes React build)
docker-compose build

# Run container
docker-compose up -d

# Access application
curl http://localhost:2024/health
```

**How it works:**
1. Docker installs Node.js
2. Copies `frontend/` source
3. Runs `npm install && npm run build`
4. Copies Python app
5. Serves React + API

**Pros:**
- ✅ **Platform-independent** (builds same everywhere)
- ✅ **Reproducible** (always same environment)
- ✅ **No manual build steps**
- ✅ **No Node.js on host needed**

**Cons:**
- ⚠️ Longer initial build time
- ⚠️ Requires Docker installed

---

### **Strategy 4: CI/CD Pipeline (GitHub Actions)**

**Auto-build on push to main branch:**

Create `.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build React
        run: |
          cd frontend
          npm install
          npm run build
      
      - name: Deploy to server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          source: "frontend/dist/,src/,requirements.txt"
          target: "/path/to/app"
```

**Pros:**
- ✅ **Fully automated**
- ✅ **Build on every push**
- ✅ **Consistent builds**

---

## Important Cross-Platform Considerations

### **1. Line Endings**

**Issue:** Git converts CRLF (Windows) ↔ LF (Linux)

**Solution:** `.gitattributes` file (already created!)

```gitattributes
* text=auto
*.ts text eol=lf
*.tsx text eol=lf
*.sh text eol=lf
*.bat text eol=crlf
```

### **2. Node.js Versions**

**Issue:** Different Node versions can produce different builds

**Solution:** Specify version in `package.json` (already added!)

```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

**Check versions:**

```bash
# Windows
node --version
npm --version

# Linux (should match)
node --version
npm --version
```

### **3. Path Separators**

**Issue:** Windows uses `\`, Linux uses `/`

**Solution:** Vite handles this automatically! ✅

Your config already uses `/` which works everywhere:

```typescript
// ✅ Works on Windows AND Linux
base: '/',
```

### **4. File Permissions**

**Issue:** Scripts lose execute permission on Windows

**Solution:** Fix on Linux after deployment:

```bash
# Make scripts executable
chmod +x setup.sh
chmod +x dockerSetup.sh
```

---

## Recommended Workflow

### **For Development:**

```bash
# Windows: Develop with React dev server
cd frontend
npm run dev

# Test with FastAPI
uvicorn src.agent.webapp:app --port 2024 --reload
```

### **For Production Deployment:**

**Option A: Docker (Recommended)**

```bash
# Build and run (works on Windows/Linux/Mac)
docker-compose up -d --build
```

**Option B: Manual Build**

```bash
# On Linux server
git pull
cd frontend
npm install
npm run build
cd ..
uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024
```

---

## Troubleshooting Cross-Platform Issues

### **Issue: Build works on Windows but fails on Linux**

```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Clear cache and rebuild
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### **Issue: Line ending errors**

```bash
# On Linux: Convert line endings
find . -type f -name "*.sh" -exec dos2unix {} \;

# Or use Git
git config core.autocrlf input
```

### **Issue: Permission denied on scripts**

```bash
# Fix permissions
chmod +x *.sh
chmod +x frontend/*.sh
```

### **Issue: Different build output**

```bash
# Use Docker to ensure consistent builds
docker-compose build --no-cache
```

---

## Testing Cross-Platform

### **Test Plan:**

1. **Build on Windows:**
   ```cmd
   cd frontend
   npm run build
   ```

2. **Check build output:**
   ```cmd
   dir dist
   dir dist\assets
   ```

3. **Copy to Linux:**
   ```bash
   scp -r frontend/dist/ user@server:/path/to/app/frontend/
   ```

4. **Test on Linux:**
   ```bash
   uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024
   curl http://localhost:2024/health
   curl http://localhost:2024/  # Should serve React
   ```

---

## Best Practices

### **1. Git Strategy**

**Don't commit build files:**

```gitignore
# .gitignore (already set up)
frontend/dist/
frontend/node_modules/
```

**Build on deployment target** (Linux server or Docker)

### **2. Version Control**

```bash
# Tag production releases
git tag -a v1.0.0 -m "Production release"
git push origin v1.0.0
```

### **3. Environment Variables**

**Same on all platforms:**

```env
# .env (works on Windows/Linux)
AWS_REGION=us-east-1
ROOT_PATH=/langgraphplayground
```

### **4. Documentation**

Keep platform-specific notes:

```markdown
## Build Commands

Windows:
  npm run build

Linux:
  npm run build

Docker:
  docker-compose build
```

---

## Summary

| Strategy | Pros | Cons | Best For |
|----------|------|------|----------|
| **Docker** | ✅ Platform-independent<br>✅ Reproducible | ⚠️ Requires Docker | Production |
| **Build on Server** | ✅ Clean Git<br>✅ No committed builds | ⚠️ Needs Node.js | CI/CD |
| **Build on Windows** | ✅ Simple<br>✅ No Node.js on server | ⚠️ Commit builds | Quick deploy |
| **CI/CD** | ✅ Automated<br>✅ Consistent | ⚠️ Setup required | Teams |

**Recommendation for your setup:**

1. **Development:** Build on Windows with `npm run dev`
2. **Production:** Use Docker (already configured!)

```bash
# Deploy anywhere (Windows/Linux/Mac)
docker-compose up -d --build
```

✅ **Cross-platform works perfectly!**
