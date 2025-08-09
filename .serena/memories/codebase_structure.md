# Codebase Structure

## Repository Layout

```
app/                 # Main Tauri application directory
├── src/                      # React frontend source
│   ├── components/           # Reusable React components
│   ├── pages/               # Application pages/views
│   ├── App.tsx              # Root React component
│   └── main.tsx             # React entry point
├── src-tauri/               # Tauri Rust backend
│   ├── src/
│   │   ├── lib.rs           # Main Tauri commands and logic
│   │   └── main.rs          # Application entry point
│   ├── Cargo.toml           # Rust dependencies
│   └── tauri.conf.json      # Tauri configuration
├── public/                  # Static assets
├── package.json             # Frontend dependencies
├── vite.config.ts          # Vite bundler configuration
├── tsconfig.json           # TypeScript configuration
└── CLAUDE.md               # Development documentation
```

## Frontend Structure (React/TypeScript)

### Pages (`src/pages/`)
- `Connections.tsx` - vMix connection management interface
- `ShortcutGenerator.tsx` - Tool for generating vMix shortcuts
- `BlankGenerator.tsx` - Blank content generation utilities
- `InputManager.tsx` - vMix input/output management
- `Settings.tsx` - Application settings and configuration

### Components (`src/components/`)
- `Layout.tsx` - Main application layout with navigation drawer
  - Responsive design with mobile/desktop variants
  - Material-UI drawer navigation
  - Page routing and state management

### Core Files
- `App.tsx` - Root component with Material-UI theme provider
- `main.tsx` - React application entry point with DOM rendering
- `vite-env.d.ts` - Vite environment type definitions

## Backend Structure (Rust/Tauri)

### Core Implementation (`src-tauri/src/`)
- `main.rs` - Application entry point, calls library run function
- `lib.rs` - Main implementation containing:
  - Tauri command definitions
  - vMix API integration
  - State management (AppState struct)
  - Connection handling logic

### Key Rust Components
```rust
// State Management
struct AppState {
    connections: Mutex<Vec<VmixApi>>
}

// Tauri Commands
#[tauri::command]
async fn connect_vmix() -> Result<VmixConnection, String>
#[tauri::command] 
async fn get_vmix_status() -> Result<VmixConnection, String>
```

### Configuration
- `Cargo.toml` - Rust dependencies and build configuration
- `tauri.conf.json` - Tauri-specific settings:
  - Window dimensions (800x600)
  - Build commands using Bun
  - Security policies
  - Bundle configuration

## Legacy Structure (Parent Directory)

### Go Backend
```
../
├── main.go                   # Go server entry point
├── server/
│   ├── vmix_utility.go      # Main server logic and API routes
│   └── scraper/             # vMix shortcuts scraping
├── go.mod                   # Go module definition
└── makefile                 # Build automation
```

### Vue.js Frontend
```
../web/
├── src/
│   ├── views/               # Vue.js pages
│   ├── components/          # Vue.js components
│   ├── router/              # Vue Router configuration
│   └── store/               # Vuex state management
├── package.json             # Vue.js dependencies
└── vue.config.js           # Vue CLI configuration
```

## Key Architectural Patterns

### Tauri Architecture
- **Frontend-Backend Communication**: Uses Tauri's `invoke()` function
- **State Management**: Rust backend manages vMix connections
- **Error Handling**: Results converted to strings for JavaScript bridge
- **Async Operations**: Full async support for vMix API calls

### Material-UI Integration
- **Responsive Design**: Mobile-first with breakpoint-based layouts
- **Theme System**: Centralized theme configuration in App.tsx
- **Component Composition**: Extensive use of MUI component library

### Navigation Pattern
- **Single-Page App**: All navigation handled in Layout component
- **State-Driven**: Selected page determined by component state
- **Responsive Menu**: Drawer collapses on mobile devices

## Build System

### Tauri Build Process
1. Frontend built with Vite (TypeScript → JavaScript)
2. Assets bundled and optimized
3. Rust backend compiled with embedded frontend
4. Native executable generated for target platform

### Development Workflow
- `bun run tauri dev` - Hot reload for both frontend and backend
- Vite dev server on port 1420
- HMR (Hot Module Replacement) on port 1421
- Automatic Rust recompilation on backend changes