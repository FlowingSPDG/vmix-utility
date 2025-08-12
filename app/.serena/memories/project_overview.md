# vMix Utility Project Overview

## Purpose
A modern desktop application for managing vMix connections and operations, built with Tauri (Rust + React) for high performance and native desktop integration.

## Architecture
- **Frontend**: React + TypeScript + Material-UI + Vite
- **Backend**: Rust + Tauri framework
- **vMix Integration**: HTTP API communication using vmix_rs library
- **Build System**: Tauri CLI with Bun package manager

## Project Structure
```
vmix-utility/
├── app/                    # Tauri application
│   ├── src/               # React frontend
│   ├── src-tauri/         # Rust backend
│   └── package.json
├── .github/workflows/     # CI/CD workflows
└── README.md
```

## Tech Stack
- **Frontend**: React 18, TypeScript, Material-UI v6, Vite
- **Backend**: Rust with Tauri v2, tokio for async operations
- **HTTP Client**: reqwest for API calls
- **Logging**: log + env_logger for Rust, console for frontend
- **vMix Integration**: vmix_rs custom library
- **Package Manager**: Bun for frontend dependencies