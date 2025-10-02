# React Frontend Setup

This directory contains the React + TypeScript frontend for the LangGraph Playground.

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start dev server (runs on port 3000)
npm run dev

# Make sure FastAPI is running on port 2024
# In another terminal:
cd ..
uvicorn src.agent.webapp:app --port 2024 --reload
```

Access at: http://localhost:3000

### Production Build

```bash
# Build for production
npm run build

# The build will be in ./dist/
# FastAPI will automatically serve it from port 2024
```

## Architecture

### Base Path Strategy (BULLETPROOF! 🎯)

**Problem Solved:** No more `/langgraphplayground/assets/` 404 errors!

**How it works:**

1. **Vite builds with `base: '/'`** (simple, no complex paths)
2. **FastAPI serves everything** (React build + API)
3. **FastAPI uses `ROOT_PATH` env var** for nginx subpath handling
4. **Nginx just proxies** (no rewrites, no path confusion)

```
Browser: https://domain.com/langgraphplayground/assets/main.js
   ↓
Nginx: proxy_pass to http://localhost:2024/assets/main.js
   ↓
FastAPI: serves from frontend/dist/assets/main.js
   ↓
✅ WORKS! No path confusion!
```

### Development vs Production

| Environment | Vite | FastAPI | How it works |
|-------------|------|---------|--------------|
| **Development** | Port 3000 | Port 2024 | Vite proxies API calls to FastAPI |
| **Production** | N/A (built) | Port 2024 | FastAPI serves React build + API |

### API Client

The frontend uses a typed API client (`src/api/client.ts`) that automatically handles base paths:

- **Development:** Uses Vite proxy (empty base path)
- **Production:** Uses relative paths (FastAPI handles ROOT_PATH)

**No manual path configuration needed!** 🎉

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts         # Typed API client
│   ├── types/
│   │   └── api.ts            # TypeScript interfaces
│   ├── App.tsx               # Main React component
│   ├── main.tsx              # Entry point
│   ├── index.css             # Global styles
│   └── vite-env.d.ts         # Vite type definitions
├── index.html                # HTML template
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config
├── package.json              # Dependencies
└── README.md                 # This file
```

## Dependencies

### Production Dependencies
- `react` - UI library
- `react-dom` - React DOM renderer

### Development Dependencies
- `vite` - Build tool & dev server
- `@vitejs/plugin-react` - Vite React plugin
- `typescript` - Type checking
- `@types/react` - React type definitions
- `@types/react-dom` - React DOM type definitions
- `eslint` - Code linting

## Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

## Features

✅ **Full TypeScript** - Type-safe API calls and components  
✅ **Hot Module Replacement** - Instant updates during development  
✅ **Optimized Builds** - Code splitting and minification  
✅ **Zero Base Path Issues** - Bulletproof path handling  
✅ **Same UI as vanilla version** - Pixel-perfect recreation  
✅ **Better Developer Experience** - IntelliSense, refactoring, etc.

## Troubleshooting

### Port 3000 already in use
```bash
# Change port in vite.config.ts
server: {
  port: 3001,  # Or any other port
}
```

### API calls failing in development
Make sure FastAPI is running on port 2024:
```bash
uvicorn src.agent.webapp:app --port 2024 --reload
```

### Build not showing in production
1. Run `npm run build` in the frontend directory
2. Restart FastAPI
3. Check that `frontend/dist/` folder exists

### Type errors
```bash
npm install  # Make sure all dependencies are installed
```

## Deployment

The frontend is automatically deployed when you build and run FastAPI:

```bash
# 1. Build frontend
cd frontend
npm run build

# 2. Run FastAPI (serves frontend + API)
cd ..
uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024
```

For production with nginx, see the main GUIDE.md file.
