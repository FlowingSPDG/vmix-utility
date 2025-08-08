# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

vmix-utility is a web-based control interface for vMix video mixing software. It provides a Go backend API gateway that communicates with vMix's HTTP API, and a Vue.js frontend for managing inputs, executing functions, and viewing multiviews.

## Architecture

**Backend**: Go application using Gin framework that serves as an API gateway to vMix
- Main entry point: `main.go`
- Core logic: `server/vmix_utility.go` 
- Uses `vmix-go` library for vMix communication
- Embeds static files from `web/dist/` and `vMixMultiview/`

**Frontend**: Vue.js 2 application with Element UI components
- Located in `web/` directory
- Main views: `Home.vue` (function execution), `Tree.vue` (input management), `BlankGen.vue`, `Developer.vue`
- API utilities centralized in `web/src/utils/api.vue` (mixed into all components)
- Uses axios for HTTP requests

**Key Integration Pattern**: All vMix operations should go through the Go backend API rather than direct frontend-to-vMix calls for consistency, error handling, and maintainability.

## Development Commands

**Frontend (in web/ directory)**:
- `yarn` - Install dependencies
- `yarn run serve` - Development server
- `yarn run build` - Build for production (outputs to web/dist/)
- `yarn run lint` - Lint Vue/TypeScript code

**Backend**:
- `go run .` - Run development server
- `go test -v ./...` - Run tests

**Full Build Process (using Task)**:
- `task` or `task build` - Full build (frontend + backend)
- `task build-web` - Build frontend only
- `task build-server` - Build backend only  
- `task deps` - Install all dependencies
- `task clean` - Clean build artifacts
- `task test` - Run Go tests

**Running the Application**:
```bash
# Method 1: After full build
./build/vmix_gen_windows_amd64.exe -vmix "http://localhost:8088" -host 8080

# Method 2: Development mode
task build-web  # Build frontend first
go run . -vmix "http://localhost:8088" -host 8080
```

## API Endpoints

All endpoints are under `/api`:
- `GET /api/inputs` - Get vMix inputs
- `GET /api/shortcuts` - Get vMix function shortcuts
- `GET /api/raw` - Get raw vMix XML
- `POST /api/refresh` - Refresh input data
- `POST /api/multiple` - Execute multiple vMix functions
- `POST /api/setinputname` - Set input name

## Important Notes

- Frontend must be built before running Go application (web/dist/ is embedded)
- The application expects vMix to be running on port 8088 by default
- All Vue components have access to API methods via the global mixin from `api.vue`
- vMixMultiview is a git submodule for multiview functionality
- Node version pinned to 20.13.1 via Volta in package.json