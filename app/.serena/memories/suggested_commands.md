# Suggested Commands

## Development Commands

### Tauri Development (Primary)
```bash
cd app/
bun install           # Install dependencies
bun run tauri dev    # Start Tauri development mode
bun run tauri build  # Build Tauri application
```

### Frontend Development
```bash
cd app/
bun run dev          # Start frontend development server only
bun run build        # Build frontend only
bun run preview      # Preview built frontend
```

### System Commands (Linux)
- `ls` - List directory contents
- `cd` - Change directory
- `grep` - Search text patterns
- `find` - Find files
- `git` - Git version control
- `cat` - Display file contents
- `nano` or `vim` - Edit files

### Git Workflow
```bash
git status           # Check working tree status
git add .            # Stage all changes
git commit -m "..."  # Commit changes
git push origin      # Push to remote
```

## Project Entrypoints
- Development: `bun run tauri dev` (main application)
- Production Build: `bun run tauri build`
- Frontend Only: `bun run dev` (for UI development)