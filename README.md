# vmix-utility

[![Test Build](https://github.com/FlowingSPDG/vmix-utility/actions/workflows/test-build.yml/badge.svg)](https://github.com/FlowingSPDG/vmix-utility/actions/workflows/test-build.yml)
[![Publish Release](https://github.com/FlowingSPDG/vmix-utility/actions/workflows/release.yml/badge.svg)](https://github.com/FlowingSPDG/vmix-utility/actions/workflows/release.yml)

日本語 → [REAMDE_ja.md](README_ja.md)

A modern desktop application for managing vMix connections and operations. Built with Tauri (Rust + React) for high performance and native desktop integration.

## ✨ Features

- **🔗 Multiple vMix Connections**: Connect to and manage multiple vMix instances simultaneously
- **📊 Real-time Status Monitoring**: Live monitoring of connection status, active/preview inputs
- **🎮 vMix Function Control**: Execute vMix functions with customizable parameters
- **⚡ Auto-refresh**: Configurable automatic status updates with retry logic
- **🎯 Input Management**: Browse and manage vMix inputs with detailed information
- **⚙️ Shortcut Generator**: Create custom vMix function shortcuts with parameters
- **📝 Blank Generator**: Generate blank/color inputs for vMix
- **🔄 Auto-Update**: Automatic application updates via GitHub releases
- **💾 Persistent Settings**: Save and restore connection configurations
- **📱 System Tray Integration**: Minimize to system tray with quick access menu
- **🎨 Modern UI**: Clean Material-UI based interface with responsive design

![Connections Screenshot](./docs/screenshot-connections.png)
*Connection management interface*

## 🚀 Installation

### Download Pre-built Releases

Download the latest version for your platform:

- **Windows**: Download the `.msi` installer from [Releases](https://github.com/FlowingSPDG/vmix-utility/releases)
- **macOS**: Download the `.dmg` file (supports both Intel and Apple Silicon)
- **Linux**: Download the `.AppImage` file

### System Requirements

- **Windows**: Windows 10 version 1903 or later
- **macOS**: macOS 10.15 or later
- **Linux**: Modern Linux distribution with GTK 3.24 or later

## 📖 Usage

### Getting Started

1. **Launch the application** - The app will start with a default localhost connection
2. **Add vMix Connections** - Go to Connections tab to add your vMix instances
3. **Monitor Status** - View real-time connection status and input information
4. **Execute Functions** - Use the function interface to control vMix operations

![Settings Screenshot](./docs/screenshot-settings.png)
*Application settings and configuration*

### Adding vMix Connections

1. Navigate to the **Connections** tab
2. Click **Add Connection** 
3. Enter the vMix host IP address (e.g., `192.168.1.100`)
4. Optionally set a custom label for easy identification
5. Configure auto-refresh settings as needed

### Using vMix Functions

The application supports all vMix functions as documented in the [vMix Web Scripting Reference](https://www.vmix.com/help28/index.htm?WebScripting.html).

#### Function Parameters

- **Function**: Select from available vMix functions (Cut, Fade, SetText, etc.)
- **Value**: Additional value parameter when supported by the function
- **Input**: Target input specified by input key or number
- **Custom Queries**: Add additional URL parameters as needed

#### Example Functions

- `Cut` - Switch program output to specified input
- `Fade` - Fade to specified input over time
- `SetText` - Update text in title inputs
- `StartRecording` - Start recording
- `StopRecording` - Stop recording

![Developer Screenshot](./docs/screenshot-developer.png)
*Developer tools and function testing*

### Shortcut Generator

Create reusable shortcuts for common vMix operations:

1. Go to **Shortcut Generator** tab
2. Configure your function parameters
3. Save shortcuts with custom names
4. Export shortcuts for sharing or backup

### System Tray

The application minimizes to the system tray for easy access:

- **Left-click**: Restore main window
- **Right-click**: Access context menu
  - Show: Restore main window
  - Check Update: Manually check for updates
  - Quit: Exit application

## 🔄 Auto-Update

The application automatically checks for updates on startup and can be manually triggered from the system tray menu. When updates are available:

1. A notification will appear
2. Click to download and install the update
3. The application will restart with the new version

Updates are signed and verified for security.

## ⚙️ Configuration

### Connection Settings

- **Host**: vMix server IP address
- **Label**: Custom display name for the connection
- **Auto-refresh**: Enable/disable automatic status updates
- **Refresh Interval**: Time between status checks (seconds)

### Application Settings

- **Startup Launch**: Launch application on system startup
- **Default vMix Settings**: Default IP and port for new connections
- **Theme**: Light/dark theme selection
- **Auto-reconnect**: Automatically retry failed connections
- **Logging**: Configure log level and file output

## 🛠️ Development

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version)
- [Rust](https://rustup.rs/) (latest stable)
- [Bun](https://bun.sh/) package manager

### Setup

```bash
git clone https://github.com/FlowingSPDG/vmix-utility.git
cd vmix-utility/app
bun install
```

### Development Commands

```bash
# Start development server
bun run tauri dev

# Build for production
bun run tauri build

# Run frontend only
bun run dev

# Build frontend
bun run build
```

### Project Structure

```
vmix-utility/
├── app/                    # Tauri application
│   ├── src/               # React frontend
│   ├── src-tauri/         # Rust backend
│   └── package.json
├── .github/workflows/     # CI/CD workflows
└── README.md
```

### Architecture

- **Frontend**: React + TypeScript + Material-UI + Vite
- **Backend**: Rust + Tauri framework
- **vMix Integration**: HTTP API communication
- **Build System**: Tauri CLI with Bun package manager

## 📋 vMix Function Reference

Common vMix functions supported by the application:

### Video Switching
- `Cut` - Hard cut to input
- `Fade` - Fade transition to input
- `PreviewInput` - Set preview input

### Recording & Streaming
- `StartRecording` / `StopRecording`
- `StartStreaming` / `StopStreaming`
- `PauseRecording` / `UnpauseRecording`

### Text & Graphics
- `SetText` - Update text overlays
- `OverlayInput1On` / `OverlayInput1Off` - Control overlays

### Audio
- `SetMasterVolume` - Adjust master volume
- `AudioMute` / `AudioUnMute` - Mute/unmute audio

For complete function reference, see [vMix Web Scripting Documentation](https://www.vmix.com/help28/index.htm?WebScripting.html).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Developer

**Shugo Kawamura**
- GitHub: [@FlowingSPDG](https://github.com/FlowingSPDG)
- X (Twitter): [@FlowingSPDG](https://twitter.com/FlowingSPDG)

## 🔗 Links

- [Download Latest Release](https://github.com/FlowingSPDG/vmix-utility/releases/latest)
- [Report Issues](https://github.com/FlowingSPDG/vmix-utility/issues)
- [vMix Official Website](https://www.vmix.com/)
- [vMix Web Scripting Reference](https://www.vmix.com/help28/index.htm?WebScripting.html)

---

⭐ If you find this application useful, please consider giving it a star on GitHub!