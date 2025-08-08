# vMix Utility Project Overview

## Purpose
The vMix Utility is a desktop application designed for managing vMix streaming software connections and operations. It provides a user interface for connecting to vMix instances, managing inputs, generating shortcuts, and performing various vMix-related tasks.

## Project Structure
This is a **multi-architecture project** with several components:

1. **Primary Tauri Application** (`vmix-utility/`) - Modern React-based desktop app
2. **Legacy Go Backend** (parent directory) - HTTP server with embedded web interface  
3. **Legacy Vue.js Frontend** (`../web/`) - Older web-based interface

The project appears to be transitioning from a Go/Vue.js web application to a modern Tauri/React desktop application.

## Key Features
- vMix connection management
- Input/output monitoring and control
- Shortcut generation for vMix operations
- Blank generator functionality
- Settings management
- Multi-view support

## Target Platform
- Primary: Desktop application (Windows, macOS, Linux via Tauri)
- Secondary: Web interface via Go server

## Current Focus
The active development is on the Tauri/React application in the `vmix-utility/` directory, which provides native desktop integration and modern UI components using Material-UI.