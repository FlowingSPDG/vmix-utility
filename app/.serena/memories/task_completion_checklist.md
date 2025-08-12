# Task Completion Checklist

## After Code Changes

### Testing
- Manual testing with `bun run tauri dev`
- Verify both frontend and backend functionality
- Test on different platforms if needed

### Code Quality
- Ensure TypeScript compiles without errors (`bun run build`)
- Rust code compiles without warnings
- Follow existing code patterns and conventions

### Build Verification
- Test production build with `bun run tauri build`
- Verify application functionality in built version
- Check for any runtime errors

### Documentation
- Update comments if functionality changes
- Update README.md if user-facing features change
- Document any new configuration options

### Git Workflow
- Stage appropriate changes with `git add`
- Write descriptive commit messages
- Push to appropriate branch