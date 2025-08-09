# Code Style and Conventions

## TypeScript/React Conventions

### TypeScript Configuration
- **Strict mode enabled**: `"strict": true`
- **Target**: ES2020
- **Module**: ESNext with bundler resolution
- **JSX**: react-jsx transform
- **Linting**: Strict unused locals and parameters checking
- **No fallthrough cases** in switch statements

### React Patterns
- **Functional Components**: All components use function declarations with hooks
- **Import Style**: Named imports from Material-UI, grouped logically
- **State Management**: `useState` and `useEffect` hooks for local state

### File Organization
- **Components**: Located in `src/components/`
- **Pages**: Located in `src/pages/`
- **Types**: Inline interface definitions near usage
- **File Extensions**: `.tsx` for React components, `.ts` for utilities

### Naming Conventions
- **Components**: PascalCase (e.g., `Layout`, `BlankGenerator`)
- **Files**: PascalCase matching component names
- **Variables**: camelCase
- **Interfaces**: PascalCase (e.g., `Connection`, `NavItem`)
- **Props**: camelCase with descriptive names

### Component Structure Example
```typescript
import { useState } from 'react';
import { Box, Typography } from '@mui/material';

interface ComponentProps {
  prop: string;
}

const ComponentName = ({ prop }: ComponentProps) => {
  const [state, setState] = useState(initialValue);
  
  return (
    <Box>
      <Typography>{prop}</Typography>
    </Box>
  );
};

export default ComponentName;
```

## Rust Conventions

### Code Style
- Standard Rust formatting with `rustfmt`
- Snake_case for variables and functions
- PascalCase for structs and enums
- Async functions with proper error handling

### Tauri Patterns
- Commands decorated with `#[tauri::command]`
- State management using `tauri::State`
- Error handling with `Result<T, String>` for command returns

### Error Handling
- Use of `anyhow::Error` for internal errors
- Convert to `String` for Tauri command returns
- Proper async error propagation

## Material-UI Usage

### Component Patterns
- Consistent use of `sx` prop for styling
- Responsive design with `useMediaQuery` and theme breakpoints
- Drawer navigation with mobile-responsive behavior

### Theme Usage
- Light theme with custom primary colors
- Consistent spacing using theme values
- Typography variants for consistent text styling

### Layout Patterns
- Fixed sidebar navigation (240px width)
- AppBar with mobile hamburger menu
- Main content area with proper margins

## Import Organization
1. React/framework imports
2. Third-party library imports (Material-UI, etc.)
3. Local component/utility imports
4. Type-only imports (when applicable)

## No ESLint/Prettier Configuration Found
The project doesn't appear to have explicit ESLint or Prettier configuration files, relying on TypeScript compiler settings for code quality.