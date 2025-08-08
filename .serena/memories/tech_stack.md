# Technology Stack

## Primary Tauri Application

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) v6
- **Build Tool**: Vite
- **Package Manager**: Bun
- **Styling**: Emotion (via MUI), CSS modules

### Backend (Rust)
- **Framework**: Tauri v2
- **Language**: Rust
- **vMix Integration**: `vmix_rs` (custom fork from GitHub)
- **Async**: `async-trait`, futures
- **Serialization**: `serde`, `serde_json`
- **Error Handling**: `anyhow`

### Development Tools
- **TypeScript**: v5.6.2
- **Tauri CLI**: v2.2.7
- **Vite**: v6.0.3

## Legacy Stack (Parent Directory)

### Go Backend
- **Language**: Go 1.23
- **Framework**: Gin (HTTP router)
- **vMix Library**: `vmix-go`
- **Web Scraping**: Colly v2
- **Build**: Make with cross-platform support

### Vue.js Frontend
- **Framework**: Vue.js 2.6
- **Language**: TypeScript 3.7
- **UI Library**: Element UI
- **Build Tool**: Vue CLI 4.2
- **Package Manager**: Yarn
- **State Management**: Vuex
- **Routing**: Vue Router

## Key Dependencies

### Tauri Specific
- `@tauri-apps/api` - JavaScript bridge to Rust backend
- `@tauri-apps/plugin-opener` - System integration

### UI Components
- `@mui/material`, `@mui/icons-material` - Material Design components
- `@emotion/react`, `@emotion/styled` - CSS-in-JS styling

### Development
- Strict TypeScript configuration
- ES2020 target with DOM libraries
- React JSX transform