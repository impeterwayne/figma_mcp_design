# Setup Guide

Complete guide to setting up **figma_mcp_design** for development or end-user usage.

---

## Table of Contents

- [Overview](#overview)
- [End-User Setup (NPM Package)](#end-user-setup-npm-package)
- [Developer Setup (From Source)](#developer-setup-from-source)
- [Figma Plugin Installation](#figma-plugin-installation)
- [Connecting Everything Together](#connecting-everything-together)
- [MCP Client Configuration](#mcp-client-configuration)
- [Troubleshooting](#troubleshooting)

---

## Overview

figma_mcp_design is a three-part system:

```
┌─────────────┐  stdio/JSON-RPC   ┌──────────────┐  WebSocket   ┌──────────────────┐
│  AI / LLM   │ ◀──────────────▶  │  Go MCP      │ ◀──────────▶ │  Figma Plugin    │
│  (Claude,   │                   │  Server      │   (JSON)     │  (Svelte UI +    │
│   Cursor…)  │                   │              │              │   Figma API)     │
└─────────────┘                   └──────────────┘              └──────────────────┘
```

| Part | Description |
|------|-------------|
| **Go MCP Server** | Backend that exposes 70+ tools via the Model Context Protocol |
| **Figma Plugin** | Svelte 5 companion plugin that executes commands inside Figma |
| **NPM Wrapper** | Cross-platform binary distribution for easy installation |

Currently, the project must be **built from source**. Follow the [Developer Setup](#developer-setup-from-source) instructions below.

> **Note:** An NPM package (`@impeterwayne/figma_mcp_design`) is planned for future distribution. Once published, it will allow installation via `npm install -g @impeterwayne/figma_mcp_design` without needing the Go toolchain. The NPM wrapper code exists under `npm/` but the package is **not yet published** to the npm registry.

---

## Developer Setup (From Source)

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Go** | 1.26.1+ | Building the MCP server backend |
| **Node.js** | >= 18.0.0 | NPM wrapper packaging |
| **Bun** | Latest | TypeScript execution, plugin build & test runner |
| **Figma Desktop App** | Latest | Running the plugin locally |
| **Make** *(optional)* | Any | Convenience build commands |

### Step 1: Clone the Repository

```bash
git clone https://github.com/impeterwayne/figma_mcp_design.git
cd figma_mcp_design
```

### Step 2: Build the Go Backend

```bash
# Download Go dependencies
go mod download

# Build the binary (outputs to bin/figma_mcp_design)
make build-go

# Or without Make:
go build -o bin/figma_mcp_design ./cmd/figma_mcp_design
```

> **Note:** The root of this repository does NOT have a `package.json`. Running `npm run build` from the root will fail. Use `make build` or build each component separately.

#### Setting a Version at Build Time

```bash
go build -ldflags "-X main.version=1.0.0" -o bin/figma_mcp_design ./cmd/figma_mcp_design
```

If no version is set, it defaults to `"dev"`.

### Step 3: Build the Figma Plugin

```bash
cd plugin
bun install       # Install TypeScript/Svelte dependencies
bun run build     # Build both UI (index.html) and sandbox (code.js)
```

The plugin has **two Vite build targets** that run sequentially:

| Config File | Input | Output | Description |
|---|---|---|---|
| `vite.config.ts` | `src/ui/` | `dist/index.html` | Svelte UI iframe (WebSocket bridge + settings) |
| `vite.config.main.ts` | `src/main.ts` | `dist/code.js` | Figma sandbox (IIFE, accesses `figma.*` API) |

### Step 4: Build Everything at Once

From the repository root:

```bash
make build    # Builds Go backend + plugin in one command
```

### Step 5: Load the Plugin in Figma

See [Figma Plugin Installation](#figma-plugin-installation) below.

---

## Figma Plugin Installation

### For Developers (Local Build)

1. Open the **Figma Desktop App**.
2. Open any Figma file.
3. Go to **Plugins → Development → Import plugin from manifest…**
4. Navigate to `plugin/manifest.json` in your cloned repository.
5. Click **Open**.

The plugin will appear under **Plugins → Development → Figma MCP Design**.

### For End Users (Published Plugin)

If the plugin is published to the Figma Community, install it directly from there. Check the [project repository](https://github.com/impeterwayne/figma_mcp_design) for the latest installation link.

---

## Connecting Everything Together

### Step 1: Start the Go MCP Server

```bash
# Default: listens on 127.0.0.1:1995
./bin/figma_mcp_design

# Custom IP and port
./bin/figma_mcp_design --ip 127.0.0.1 --port 3000
```

> **Security warning:** Binding to `0.0.0.0` exposes the server to the network with **no authentication**. Use only on trusted networks.

### Step 2: Launch the Figma Plugin

1. Open a Figma file.
2. Run the plugin: **Plugins → Development → Figma MCP Design** (or from the Community if published).
3. The plugin UI will appear showing a connection panel.

### Step 3: Connect the Plugin to the Server

1. In the plugin UI, verify the **Host** is `127.0.0.1` and **Port** is `1995` (or your custom values).
2. The plugin will automatically attempt to connect via WebSocket to `ws://127.0.0.1:1995/ws`.
3. When connected, the status indicator will turn green and show the file name, current page, and selection count.

> **Important:** The port configured in the plugin **must match** the port used when starting the Go server.

### Step 4: Connect Your AI Client

Configure your MCP-compatible AI client (Claude Desktop, Cursor, etc.) to use the server. See [MCP Client Configuration](#mcp-client-configuration).

### Verifying the Connection

Once all three parts are connected:

```
AI Client ←→ Go Server (stdio) ←→ Plugin (WebSocket) ←→ Figma
```

- The plugin UI shows **"Connected"** with file metadata.
- The AI client can see and use the 70+ Figma tools.
- Try a simple read operation like asking the AI to "describe what's on the current Figma page."

---

## MCP Client Configuration

### Claude Desktop

Add the following to your Claude Desktop MCP configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

#### Using Local Binary

```json
{
  "mcpServers": {
    "figma_mcp_design": {
      "command": "/absolute/path/to/bin/figma_mcp_design",
      "args": []
    }
  }
}
```

#### With Custom Port

```json
{
  "mcpServers": {
    "figma_mcp_design": {
      "command": "/absolute/path/to/bin/figma_mcp_design",
      "args": ["--port", "3000"]
    }
  }
}
```

#### Using NPM Package (Once Published)

Once the NPM package is published to the registry, you will be able to use:

```json
{
  "mcpServers": {
    "figma_mcp_design": {
      "command": "npx",
      "args": ["-y", "@impeterwayne/figma_mcp_design"]
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json` in your project or global settings):

```json
{
  "mcpServers": {
    "figma_mcp_design": {
      "command": "/absolute/path/to/bin/figma_mcp_design",
      "args": []
    }
  }
}
```

### Gemini CLI / Other MCP Clients

The server uses standard **MCP over stdio** transport. Configure your client to:

- **Command:** Path to the `figma_mcp_design` binary
- **Transport:** `stdio`
- **Arguments:** Optional `--ip` and `--port` flags

---

## Multi-Instance Support

Multiple AI agents can share a single Figma plugin connection through the **Leader/Follower** architecture:

1. The **first** server instance binds the port and becomes the **Leader**.
2. **Subsequent** instances detect the port is taken, verify the Leader is healthy, and become **Followers**.
3. Followers proxy all tool calls to the Leader via HTTP.
4. If the Leader dies, a Follower automatically takes over (3–5 second detection).

This means you can run Claude Desktop and Cursor simultaneously, both talking to the same Figma file through a single plugin instance.

---

## Troubleshooting

### `npm run build` fails at the repository root

**Error:** `ENOENT: no such file or directory, open 'package.json'`

The repository root is a Go project — there is no `package.json` at the root. Use:

```bash
# Build everything
make build

# Or build components separately
go build -o bin/figma_mcp_design ./cmd/figma_mcp_design   # Go backend
cd plugin && bun run build                          # Figma plugin
```

### Plugin cannot connect to the server

1. **Check the server is running:** Look for `Starting Figma MCP Design` in stderr output.
2. **Check the port matches:** The plugin UI settings and the `--port` flag must be the same (default: `1995`).
3. **Check you're using Figma Desktop:** The plugin requires network access that may not work in the Figma web app for localhost connections.
4. **Check firewall:** Ensure `127.0.0.1:1995` is not blocked.

### Server starts but AI client can't use tools

1. **Verify MCP config:** Ensure the `command` path is correct and the binary exists.
2. **Check stdio:** The server communicates via JSON-RPC over stdin/stdout. Ensure nothing else is consuming these streams.
3. **Restart the client:** Some MCP clients cache server connections and need a restart.

### Binary not found (NPM installation)

```
[figma_mcp_design] Binary not found. Try reinstalling: npm install @impeterwayne/figma_mcp_design
```

Your platform may not have a pre-built binary. Build from source instead:

```bash
git clone https://github.com/impeterwayne/figma_mcp_design.git
cd figma_mcp_design
go build -o bin/figma_mcp_design ./cmd/figma_mcp_design
```

### Plugin shows "AI is working…" but nothing happens

The Go server has a 30-second timeout (60 seconds for `get_document`). If the plugin is unresponsive:

1. Check the Figma console (**Plugins → Development → Open Console**) for errors.
2. Ensure the plugin sandbox (`code.js`) built successfully.
3. Try closing and reopening the plugin.

### WebSocket disconnects frequently

- The plugin auto-reconnects after 1.5 seconds on disconnect.
- If the server restarts, the plugin will reconnect automatically.
- Ensure no proxy or VPN is intercepting localhost WebSocket connections.

---

## Development Commands Reference

| Command | Directory | Description |
|---------|-----------|-------------|
| `make build` | root | Build Go backend + plugin |
| `make build-go` | root | Build Go backend only |
| `make build-ts` | root | Build plugin only (via `bun`) |
| `make test` | root | Run all tests (Go + TypeScript) |
| `make coverage` | root | Run tests with coverage reports |
| `go test ./...` | root | Go unit tests |
| `go test ./... -v` | root | Go unit tests (verbose) |
| `bun install` | plugin | Install plugin dependencies |
| `bun run build` | plugin | Build plugin (UI + sandbox) |
| `bun run dev` | plugin | Watch mode (live rebuild on save) |
| `bun test` | plugin | Plugin unit tests |
| `bun test --coverage` | plugin | Plugin tests with coverage |

---

## Project Structure Reference

```
figma_mcp_design/
├── cmd/figma_mcp_design/       # Go entry point (main.go)
│   └── main.go             # CLI flags, server bootstrap
├── internal/               # Go internal packages
│   ├── bridge.go           # WebSocket connection to plugin
│   ├── election.go         # Leader/Follower election
│   ├── leader.go           # Leader HTTP endpoints (/ws, /ping, /rpc)
│   ├── follower.go         # Follower RPC proxy
│   ├── node.go             # Request router (Leader vs Follower)
│   ├── schema.go           # MCP tool definitions (~30KB)
│   ├── tools*.go           # Tool implementations (read + write)
│   └── prompts/            # 12 MCP prompt strategies
├── plugin/                 # Figma plugin (TypeScript + Svelte)
│   ├── manifest.json       # Figma plugin manifest
│   ├── package.json        # Plugin dependencies
│   ├── vite.config.ts      # UI build (Svelte → index.html)
│   ├── vite.config.main.ts # Sandbox build (main.ts → code.js)
│   └── src/
│       ├── main.ts          # Sandbox entry point
│       ├── read-*.ts        # Read-only handlers
│       ├── write-*.ts       # Write/mutate handlers
│       ├── serializers.ts   # Figma → JSON conversion
│       └── ui/              # Svelte UI components
├── npm/                    # NPM wrapper package
│   ├── package.json        # @impeterwayne/figma_mcp_design
│   └── bin/
│       └── run.js          # Platform-detecting binary launcher
├── docs/                   # Project documentation
├── Makefile                # Build/test convenience targets
├── go.mod / go.sum         # Go module definition
└── server.json / glama.json # MCP server metadata
```
