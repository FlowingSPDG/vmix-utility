# Code Style and Conventions

## TypeScript/React (Frontend)
- Uses TypeScript with strict typing
- React functional components with hooks pattern
- Material-UI components for consistent UI
- Camel case naming for JavaScript/TypeScript
- Component names in PascalCase
- Hook names prefixed with `use`

## Rust (Backend)
- Standard Rust formatting with `rustfmt`
- Snake case naming convention
- Async/await patterns with tokio
- Error handling with `anyhow` and `Result` types
- Modular structure with separate modules for different concerns

## Project Organization
- Frontend components in `src/components/`
- Frontend pages in `src/pages/`
- Frontend hooks in `src/hooks/`
- Rust modules in `src-tauri/src/`
- Configuration in JSON files (tauri.conf.json)

## Import/Export Patterns
- ES6 imports/exports in TypeScript
- Module system in Rust with `pub` visibility modifiers