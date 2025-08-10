# Task Completion Checklist

## When Completing Development Tasks

### TypeScript/React Code Changes
1. **Type Check**: Ensure TypeScript compilation passes
   ```bash
   bun run build
   ```

2. **Runtime Verification**: Test in development mode
   ```bash
   bun run tauri dev
   ```

3. **Build Verification**: Ensure production build succeeds
   ```bash
   bun run tauri build  # Full application build
   ```

### Rust/Tauri Backend Changes
1. **Compilation**: Check Rust compilation
   ```bash
   cd src-tauri/
   cargo check
   cargo build
   ```

2. **Tauri Integration**: Verify commands work with frontend
   ```bash
   bun run tauri dev
   ```

### Go Backend Changes (Legacy)
1. **Tests**: Run all Go tests
   ```bash
   make test
   # or
   go test -v ./...
   ```

2. **Build**: Verify Go server builds
   ```bash
   make build-server
   ```

3. **Integration**: Test with embedded web assets
   ```bash
   make build
   go run main.go -vmix http://localhost:8088 -host 8080
   ```

## Code Quality Checks

### TypeScript Quality
- **Strict Mode**: All TypeScript strict mode rules must pass
- **Unused Code**: No unused locals or parameters (enforced by tsconfig)
- **Type Safety**: Proper typing for all function parameters and returns

### Rust Quality
- **Clippy**: Run Rust linter (if available)
   ```bash
   cargo clippy
   ```
- **Format**: Ensure proper formatting
   ```bash
   cargo fmt
   ```

### Go Quality
- **Go Vet**: Static analysis
   ```bash
   go vet ./...
   ```
- **Go Format**: Code formatting
   ```bash
   go fmt ./...
   ```

## Integration Testing

### vMix Integration
1. **Connection Test**: Verify vMix API connectivity
   - Start vMix software
   - Ensure API is accessible on port 8088
   - Test connection from application

2. **Function Test**: Verify vMix commands work
   - Test basic operations (connect, status, inputs)
   - Verify shortcut generation
   - Test multi-function operations

### Cross-Platform Considerations
1. **Tauri Build**: Test on target platforms
   ```bash
   bun run tauri build --target all
   ```

2. **Path Handling**: Verify file paths work across platforms
3. **Window Behavior**: Test desktop app window management

## Documentation Updates

### Code Documentation
- Update inline comments for complex logic
- Ensure public APIs have proper documentation
- Update type definitions if interfaces change

### Configuration Updates
- Update CLAUDE.md if architecture changes
- Verify package.json scripts remain accurate
- Update Tauri configuration if needed

## Final Verification

### Functionality Test
1. Launch application: `bun run tauri dev`
2. Test all main features:
   - Connection management
   - Input/output controls
   - Shortcut generation
   - Settings functionality
3. Verify error handling works properly

### Performance Check
- Ensure application starts within reasonable time
- Verify memory usage is acceptable
- Check for console errors or warnings

### Security Review
- No hardcoded credentials or sensitive data
- Proper error message handling (no internal details exposed)
- Secure vMix communication protocols