# Release Guide

## GitHub Secrets Setup

For the auto-updater to work properly, you need to set up the following GitHub repository secrets:

### Required Secrets

1. **TAURI_PRIVATE_KEY**: The private key for signing updates
   - Copy the content of your `~/.tauri/vmix-utility.key` file
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Add new repository secret with name `TAURI_PRIVATE_KEY`

2. **TAURI_KEY_PASSWORD**: The password for the private key
   - Use the password you entered when generating the key pair
   - Add as repository secret with name `TAURI_KEY_PASSWORD`

### How to Create a Release

1. **Tag your release**:
   ```bash
   git tag v2.0.1
   git push origin v2.0.1
   ```

2. **GitHub Actions will automatically**:
   - Build for Windows, macOS (Intel + ARM), and Linux
   - Create installers for each platform
   - Generate update signatures
   - Create `latest.json` for auto-updater
   - Publish GitHub release with all assets

3. **Auto-updater will**:
   - Check for updates on app startup (after 3 seconds)
   - Allow manual checking via system tray "Check Update" menu
   - Download and install updates automatically when available

## File Structure After Release

```
GitHub Release Assets:
├── vmix-utility_2.0.1_x64-setup.nsis.zip     # Windows installer
├── vmix-utility_2.0.1_x64-setup.nsis.zip.sig # Windows signature
├── vmix-utility_2.0.1_aarch64.app.tar.gz     # macOS ARM installer  
├── vmix-utility_2.0.1_aarch64.app.tar.gz.sig # macOS ARM signature
├── vmix-utility_2.0.1_x64.app.tar.gz         # macOS Intel installer
├── vmix-utility_2.0.1_x64.app.tar.gz.sig     # macOS Intel signature
├── vmix-utility_2.0.1_amd64.AppImage.tar.gz  # Linux installer
├── vmix-utility_2.0.1_amd64.AppImage.tar.gz.sig # Linux signature
└── latest.json                                # Auto-updater manifest
```

## Troubleshooting

- If builds fail, check the Actions tab for error logs
- Ensure all secrets are properly set
- Verify that the public key in `tauri.conf.json` matches your private key
- Check that version numbers are properly incremented in `package.json` and `Cargo.toml`