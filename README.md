# Activity Tracker & WebUI Dashboard

A lightweight user activity background tracker for Windows written in pure Win32 API (C++17), paired with a local HTTP server (Winsock2) for data visualization in a web interface.

## Project Architecture

The project is split into two independent modules:
* **Tracker** — a background application (`ActivityTracker.exe`) that gathers OS metrics (active window, process name, session type, idle time) without creating an interactive GUI. It integrates into the system tray and is protected against multiple instances via a single-instance lock file (`.lock`).
* **WebUI** — a lightweight HTTP server (`ActivityTrackerWebUI.exe`) that parses accumulated logs, serves a JSON REST API, and deploys an interactive monitoring dashboard (HTML5/CSS3/JS) at `http://localhost:port`.

## Quick Start & Build

The project contains automated scripts inside the `Tracker` directory for building and cleaning project artifacts using the MSBuild compiler (requires Visual Studio or Build Tools installed).

### Building the Project
Run the batch script from the `Tracker` directory or trigger the built-in VS Code build task:
```bash
Tracker/Tracker.Build.bat
```
This script initializes the Visual Studio developer environment, verifies project paths, and builds the solution in `Release / x64` configuration. The compiled binaries will be located in the `Tracker/bin/x64/Release/` directory.

### Cleaning Build Artifacts
To delete temporary files, object files (`obj/`), and binaries (`bin/`) before committing code, run:
```bash
Tracker/Tracker.Clean.bat
```
