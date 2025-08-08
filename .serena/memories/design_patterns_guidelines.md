# Design Patterns and Guidelines

## Tauri Application Architecture

### Frontend-Backend Communication Pattern
- **Tauri Commands**: All backend operations exposed as Tauri commands
- **Invoke Pattern**: Frontend uses `invoke('command_name', params)` for backend calls
- **Error Handling**: Backend returns `Result<T, String>` for consistent error propagation
- **Async Operations**: All vMix operations are async with proper error handling

### State Management Strategy
- **Backend State**: Rust manages connection state using `Mutex<Vec<VmixApi>>`
- **Frontend State**: React hooks for UI state, backend for business logic
- **Single Source of Truth**: vMix connection state managed in Rust backend

## React/TypeScript Patterns

### Component Architecture
- **Functional Components**: Exclusively use function components with hooks
- **Custom Hooks**: Extract complex logic into custom hooks when needed
- **Props Interface**: Every component has typed props interface
- **Default Export**: Components use default exports with matching file names

### Material-UI Integration
- **Responsive Design**: Consistent use of theme breakpoints and `useMediaQuery`
- **Consistent Styling**: Use `sx` prop for component-specific styling
- **Theme Integration**: All colors, spacing, and typography from theme system
- **Accessibility**: Proper ARIA labels and semantic HTML structure

### Error Handling Patterns
```typescript
// Async operation with error handling
const handleConnect = async (host: string) => {
  try {
    const result = await invoke('connect_vmix', { host });
    setConnections(prev => [...prev, result]);
  } catch (error) {
    console.error('Connection failed:', error);
    // Handle error appropriately
  }
};
```

## Rust/Tauri Patterns

### Command Structure
```rust
#[tauri::command]
async fn command_name(
    state: tauri::State<'_, AppState>, 
    param: String
) -> Result<ResponseType, String> {
    // Implementation with proper error handling
    operation().await.map_err(|e| e.to_string())
}
```

### State Management
- **Thread Safety**: Use `Mutex` for shared state
- **State Access**: Commands receive state via dependency injection
- **Error Conversion**: Convert internal errors to strings for frontend

### Async Error Handling
- **Result Types**: Use `Result<T, E>` for all fallible operations
- **Error Conversion**: `anyhow::Error` internally, `String` for Tauri commands
- **Graceful Degradation**: Provide meaningful error messages

## vMix Integration Guidelines

### Connection Management
- **Connection Pooling**: Maintain active connections in backend state
- **Health Checking**: Regular status checks for connection validity
- **Timeout Handling**: Configurable timeouts for vMix operations
- **Error Recovery**: Automatic reconnection attempts with backoff

### API Usage Patterns
```rust
// Standard vMix operation pattern
let socket_addr = SocketAddr::new(host.parse().unwrap(), 8088);
let mut vmix = VmixApi::new(socket_addr, Duration::from_secs(10))
    .await
    .map_err(|e| e.to_string())?;
```

## UI/UX Design Patterns

### Navigation Structure
- **Sidebar Navigation**: Fixed drawer with page links
- **Mobile Responsive**: Collapsible drawer for mobile devices
- **Active State**: Visual indication of current page
- **Consistent Layout**: All pages use same layout wrapper

### Form Handling
- **Controlled Components**: All form inputs controlled via React state
- **Validation**: Client-side validation before backend submission
- **Loading States**: UI feedback during async operations
- **Error Display**: User-friendly error messages

### Data Display
- **Tables**: Material-UI Table components for structured data
- **Status Indicators**: Color-coded status displays
- **Real-time Updates**: State updates trigger UI refreshes

## Security Guidelines

### Input Validation
- **Frontend Validation**: Basic validation for user experience
- **Backend Validation**: Comprehensive validation in Rust commands
- **Sanitization**: Proper input sanitization for network operations

### Error Information
- **User-Facing Errors**: Generic, helpful messages for users
- **Debug Information**: Detailed errors in development logs only
- **Security Disclosure**: No internal system details in error messages

## Performance Considerations

### Frontend Optimization
- **Component Memoization**: Use `React.memo` for expensive components
- **Lazy Loading**: Dynamic imports for large components
- **Efficient Re-renders**: Minimize unnecessary component updates

### Backend Efficiency
- **Connection Reuse**: Maintain persistent vMix connections
- **Async Operations**: Non-blocking async operations throughout
- **Resource Management**: Proper cleanup of resources and connections

## Code Organization Principles

### File Structure
- **Feature-Based**: Group related components and logic together
- **Clear Naming**: Descriptive names for files and directories
- **Consistent Imports**: Organized import statements with clear grouping

### Separation of Concerns
- **UI Logic**: React components handle presentation
- **Business Logic**: Rust backend handles vMix operations
- **State Management**: Clear boundaries between frontend and backend state

### Maintainability
- **Type Safety**: Comprehensive TypeScript and Rust typing
- **Documentation**: Inline comments for complex operations
- **Consistent Style**: Follow established patterns throughout codebase