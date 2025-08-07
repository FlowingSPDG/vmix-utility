# Essential Commands for vMix Utility Development

## Primary Development (Tauri Application)

### Setup and Dependencies
```bash
cd vmix-utility/
bun install                    # Install all dependencies
```

### Development
```bash
bun run dev                    # Start Vite development server (frontend only)
bun run tauri dev             # Start full Tauri development mode (recommended)
```

### Building
```bash
bun run build                 # Build frontend for production
bun run tauri build          # Build complete Tauri application
```

### Tauri Specific
```bash
bun run tauri                 # Access Tauri CLI commands
```

## Legacy Development (Go + Vue.js)

### Go Backend (from parent directory)
```bash
cd ..                         # Go to parent directory
make deps                     # Install all dependencies
make build                    # Build everything (web + server)
make build-web               # Build Vue.js frontend only
make build-server            # Build Go server only
make test                    # Run Go tests
make clean                   # Clean build artifacts

# Manual Go commands
go run main.go -vmix http://localhost:8088 -host 8080
go test -v ./...
```

### Vue.js Frontend (Legacy)
```bash
cd ../web/                   # Navigate to web directory
yarn install                # Install dependencies
yarn run serve              # Development server
yarn run build             # Build for production
yarn run lint               # Run ESLint
```

## Testing Commands

### Go Tests
```bash
make test                    # Run all Go tests
go test -v ./...            # Direct Go test execution
```

### TypeScript/React
No explicit test commands found in package.json. You may need to add testing framework.

## System Commands (Linux)

### File Operations
```bash
ls -la                      # List files with details
find . -name "*.tsx"        # Find TypeScript React files
find . -name "*.rs"         # Find Rust files
grep -r "pattern" src/      # Search in source files
```

### Git Operations
```bash
git status                  # Check repository status
git log --oneline -10       # View recent commits
git diff                    # View changes
```

### Process Management
```bash
ps aux | grep vmix          # Find vMix related processes
netstat -tlnp | grep 8088   # Check vMix default port
lsof -i :8080               # Check if development server port is in use
```

## Development Workflow

### Starting Development
1. `cd vmix-utility/`
2. `bun install` (if first time)
3. `bun run tauri dev`

### Before Committing
1. Check TypeScript compilation: `bun run build`
2. Run tests: `make test` (for Go backend)
3. Verify Tauri build: `bun run tauri build` (optional)

### vMix Connection Testing
Ensure vMix is running on default port 8088 or adjust connection settings accordingly.

## Port Information
- **Vite Dev Server**: 1420
- **Vite HMR**: 1421
- **vMix API**: 8088 (default)
- **Go Server**: 8080 (configurable)