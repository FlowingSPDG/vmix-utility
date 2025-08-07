# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **vmix-utility** project that provides a desktop application for managing vMix connections and operations. The project consists of two main frontend implementations:

1. **Tauri Frontend** (vmix-utility/) - Modern React-based desktop app using Tauri for native functionality
2. **Legacy Web Frontend** (web/) - Vue.js web application served by Go backend
3. **Go Backend Server** - HTTP API server that interfaces with vMix instances

## Architecture

### Tauri Application (Primary Frontend)
- **Frontend**: React + TypeScript + Material-UI + Vite
- **Backend**: Rust using Tauri framework with vmix-rs integration
- **Location**: `vmix-utility/` directory
- **Build Tool**: Uses `bun` as package manager, Tauri CLI for builds

### Legacy Web Application
- **Frontend**: Vue.js 2 + TypeScript + Element UI
- **Backend**: Go server with Gin framework
- **Location**: `web/` and root directory
- **Build Tool**: Vue CLI with Yarn

### Backend Services
- **Go Server**: Located in root directory, serves embedded web frontend and API endpoints
- **Rust Backend**: Tauri backend provides native desktop integration and vMix API calls
- **vMix Integration**: Uses vmix-rs (Rust) and vmix-go (Go) libraries

## Key Commands

### Tauri Development (Primary)
```bash
cd vmix-utility/
bun install           # Install dependencies
bun run dev          # Start development server
bun run build        # Build for production
bun run tauri dev    # Start Tauri development mode
bun run tauri build  # Build Tauri application
```

### Legacy Go/Web Development
```bash
# Web frontend
cd web/
yarn install         # Install dependencies  
yarn run build      # Build web assets
yarn run serve      # Development server

# Go backend
make deps           # Install all dependencies
make build-web      # Build web frontend
make build-server   # Build Go server
make build          # Build everything
go run main.go -vmix http://localhost:8088 -host 8080
```

### Testing
```bash
# Go backend tests
make test           # Run Go tests
go test -v ./...    # Direct Go test command

# Tauri/React (no explicit test commands found in package.json)
```

## Code Structure

### Tauri Frontend (`vmix-utility/src/`)
- `App.tsx` - Root component with Material-UI theme
- `components/Layout.tsx` - Main navigation layout with drawer
- `pages/` - Individual page components (Connections, Settings, etc.)
- Navigation uses Material-UI components with responsive drawer

### Tauri Backend (`vmix-utility/src-tauri/src/`)
- `main.rs` - Entry point
- `lib.rs` - Core Tauri commands and vMix integration
- Key commands: `connect_vmix`, `disconnect_vmix`, `get_vmix_status`
- Uses `vmix_rs` crate for vMix API communication

### Go Backend (`server/`)
- `vmix_utility.go` - Main server implementation with Gin routes
- `scraper/` - vMix shortcuts scraping functionality
- Embeds web frontend files for serving
- API endpoints: `/api/shortcuts`, `/api/inputs`, `/api/multiple`

### Legacy Web Frontend (`web/src/`)
- Vue.js 2 application with TypeScript
- Uses Element UI for components
- Views: BlankGen, Developer, Home, Tree

## Dependencies

### Tauri Stack
- `@tauri-apps/api` - Tauri JavaScript API
- `@mui/material` - Material-UI components
- `vmix_rs` - Rust vMix integration (custom branch)

### Go Stack  
- `github.com/gin-gonic/gin` - Web framework
- `github.com/FlowingSPDG/vmix-go` - vMix API client
- `github.com/gocolly/colly/v2` - Web scraping

### Web Stack
- Vue.js 2 with TypeScript
- Element UI components
- Vue Router and Vuex

## Development Notes

- The project is transitioning from Go/Vue.js to Tauri/React architecture
- Both frontends can interface with vMix instances on port 8088
- Tauri configuration includes security settings and window dimensions (800x600)
- Go server auto-opens browser on Windows platforms
- Build process includes static file embedding for Go server