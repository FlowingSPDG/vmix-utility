# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **vmix-utility** project that provides a desktop application for managing vMix connections and operations. The project consists of two main frontend implementations:

1. **Tauri Frontend** (app/) - Modern React-based desktop app using Tauri for native functionality
2. **Legacy Web Frontend** (web/) - Vue.js web application served by Go backend
3. **Go Backend Server** - HTTP API server that interfaces with vMix instances

## Architecture

### Tauri Application (Primary Frontend)
- **Frontend**: React + TypeScript + Material-UI + Vite
- **Backend**: Rust using Tauri framework with vmix-rs integration
- **Location**: `app/` directory
- **Build Tool**: Uses `bun` as package manager, Tauri CLI for builds


### Backend Services
- **Rust Backend**: Tauri backend provides native desktop integration and vMix API calls
- **vMix Integration**: Uses vmix-rs (Rust) library

## Key Commands

### Tauri Development (Primary)
```bash
cd app/
bun install           # Install dependencies
bun run tauri dev    # Start Tauri development mode
bun run tauri build  # Build Tauri application
```


## Code Structure

### Tauri Frontend (`app/src/`)
- `App.tsx` - Root component with Material-UI theme
- `components/Layout.tsx` - Main navigation layout with drawer
- `pages/` - Individual page components (Connections, Settings, etc.)
- Navigation uses Material-UI components with responsive drawer

### Tauri Backend (`app/src-tauri/src/`)
- `main.rs` - Entry point
- `lib.rs` - Core Tauri commands and vMix integration
- Key commands: `connect_vmix`, `disconnect_vmix`, `get_vmix_status`
- Uses `vmix_rs` crate for vMix API communication

## Dependencies

### Tauri Stack
- `@tauri-apps/api` - Tauri JavaScript API
- `@mui/material` - Material-UI components
- `vmix_rs` - Rust vMix integration (custom branch)


## Development Notes

- Tauri configuration includes security settings and window dimensions (1280x720)