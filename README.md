# Figma MCP Design

***English** · [Tiếng Việt](README.vi.md)*

A Go stdio MCP server that connects AI clients to a local Figma Desktop plugin over WebSocket, with no Figma API token required and no rate limits. It provides full read and write access to live Figma documents — covering design inspection, node creation and modification, auto-layout, styles, variables (design tokens), components, prototyping, and image/PDF exports — alongside a curated suite of AI agent design skills.

This repo contains three cooperating pieces:

- an MCP server exposing 85 tools and 18 design-system prompts over stdio
- a Figma Desktop plugin that talks to the server on `ws://127.0.0.1:1995` by default
- a suite of agent skills (`.agents/skills/`) for UI/UX design, design systems, branding, banners, slides, and Figma workflows

## Highlights

- Full read/write bridge from AI clients to live Figma documents
- No Figma REST API key required and no rate limits
- Local plugin connection over WebSocket (`ws://127.0.0.1:1995`) with automatic Leader/Follower multi-instance support
- 85 exposed tools for document inspection, node creation, layout & property editing, styles, variables, components, pages, prototypes, and exports
- 18 built-in MCP prompts for design strategy, token naming standards, accessibility audits (WCAG), and design-system refactoring
- Design token export support (JSON and CSS custom properties)
- Screenshot and multi-page PDF export helpers, including direct file saves
- Bundled AI agent skills (`figma-design-workflow`, `ui-ux-pro-max`, `design-system`, `ui-styling`, `brand`, `design`, `banner-design`, `slides`)
- Go server with a bundled cross-platform npm launcher package for MCP clients

## Requirements

- Node.js `>=18`
- Figma Desktop
- Go `1.26.1+` for server development
- Bun for plugin development

## Installation and setup

### 1. Configure your AI client

#### Claude Code / Claude Desktop / VS Code / Cursor / Antigravity

Same server entry for all of them; only the file differs:

- Claude Code - `.mcp.json` in your project root
- Claude Desktop - `claude_desktop_config.json`
- Cursor - `.cursor/mcp.json`
- VS Code - `.vscode/mcp.json` (VS Code names the top-level key `servers`, not `mcpServers`)
- Antigravity - MCP settings panel (MCP Store -> **View raw config**), backed by `~/.gemini/config/mcp_config.json`, or `.agents/mcp_config.json` for a single workspace

```json
{
  "mcpServers": {
    "figma_mcp_design": {
      "command": "npx",
      "args": ["-y", "@impeterwayne/figma_mcp_design@latest"]
    }
  }
}
```

#### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.figma_mcp_design]
command = "npx"
args = ["-y", "@impeterwayne/figma_mcp_design@latest"]
```

#### OpenCode
`opencode.json`
```json
{
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
        "figma_mcp_design": {
            "type": "local",
            "command": [
                "npx",
                "-y",
                "@impeterwayne/figma_mcp_design@latest"
            ],
            "enabled": true
        }
    }
}
```

### 2. Load the Figma plugin in Figma Desktop

This server depends on the local plugin bridge.

1. Download the latest `figma_design_plugin.zip` from the [releases](https://github.com/impeterwayne/figma_mcp_design/releases) page.
2. Extract the downloaded ZIP file to a local directory on your machine.
3. Open Figma Desktop.
4. Go to **Plugins** -> **Development** -> **Import plugin from manifest...**.
5. Select the `manifest.json` file inside the extracted directory.
6. Run the plugin in the file you want to inspect or edit.
7. Start your MCP client and connect through the configured `figma_mcp_design` server.

### 3. Install Agent Skills (optional)

1. Download the latest `figma_design_skills.zip` from the [releases](https://github.com/impeterwayne/figma_mcp_design/releases) page (or copy `.agents/skills/` from this repository).
2. Extract it into your workspace `.agents/skills/` directory to give your coding agent built-in skills for Figma auto-layout workflows, UI/UX design intelligence, design token architecture, brand guidelines, banner generation, and HTML slide decks.

## Tool profiles

Every tool schema is loaded into the AI client's context each session. Pick the smallest profile that fits the task with `--profile`:

| Profile | Tools | Schema size | Use for |
|---------|-------|-------------|---------|
| `full` (default) | 85 | ~66 KB | Everything, including prototyping, PDF export and bulk renaming |
| `design` | 62 | ~50 KB | Building and editing UI, design systems and components |
| `read` | 22 | ~14 KB | Inspecting, reviewing and exporting; no write tools |

```json
"args": ["--profile", "design"]
```

## Available tools

85 tools — 21 read/export tools and 64 write/automation tools against your live Figma document.

### Document and node inspection

| Tool | What it does |
|------|--------------|
| `get_design_context` | Depth-limited, token-efficient tree of the selection or page with optional component deduplication. **Start here** when exploring a large file. |
| `get_document` | Full node tree of the *current page* (not the whole file). Recursive and potentially very large. |
| `get_pages` | Lists every page with ID and name - the lightweight alternative to `get_document`. |
| `get_metadata` | File name, page list, and current page. |
| `get_selection` | Nodes currently selected in Figma; empty array when nothing is selected. |
| `get_node` | One node by ID. IDs use colon format (`4029:12345`), never hyphens. |
| `get_nodes_info` | Several nodes by ID in one round-trip - prefer over repeated `get_node` calls. |
| `search_nodes` | Finds nodes by name substring and/or type within a subtree. |
| `scan_nodes_by_types` | Finds every node of the given types in a subtree, regardless of name. |
| `scan_text_nodes` | Returns the copy from all TEXT nodes in a subtree. |
| `get_reactions` | Prototype reactions on a node - trigger plus actions. |
| `get_viewport` | Scroll center, zoom level, and visible bounds. |
| `get_fonts` | Fonts used on the current page, sorted by usage frequency. |

### Styles, variables, components, annotations, tokens

| Tool | What it does |
|------|--------------|
| `get_styles` | Local paint, text, effect, and grid styles with IDs and properties. |
| `get_variable_defs` | Local variable definitions - collections, modes, values (Figma's design tokens). |
| `get_local_components` | Components and component sets defined in the current file. |
| `get_annotations` | Dev-mode annotations, document-wide or scoped to a node. |
| `export_tokens` | Exports variables and paint styles as JSON or CSS custom properties. |

### Exports

| Tool | What it does |
|------|--------------|
| `get_screenshot` | Exports nodes as base64 image data held in memory (`PNG`, `SVG`, `JPG`, `PDF`). |
| `save_screenshots` | Exports nodes straight to disk, returning path, size, and dimensions - no base64 in the response. |
| `export_frames_to_pdf` | Exports multiple frames in order and merges them into a single multi-page PDF file on disk. |

### Node creation

| Tool | What it does |
|------|--------------|
| `create_frame` | Creates a frame on the current page or inside a parent node, with optional auto-layout and fill. |
| `create_section` | Creates a Figma Section node on the current page to organize frames and groups. |
| `create_rectangle` | Creates a rectangle with optional fill color and corner radius. |
| `create_ellipse` | Creates an ellipse or circle with optional fill color. |
| `create_text` | Creates a text node, automatically loading the requested font family and style. |
| `import_image` | Imports a base64-encoded PNG or JPG image into Figma as an image-filled node. |
| `create_instance` | Creates an instance of a component (or a component set's default variant) inside a parent, optionally setting its properties. |
| `create_component` | Converts an existing FRAME node into a reusable COMPONENT in place. |

### Node modification and layout

| Tool | What it does |
|------|--------------|
| `set_text` | Updates the text copy of a TEXT node, or of many nodes in one call via `items`. |
| `set_text_properties` | Changes typography on one or more TEXT nodes: font family/style, size, line height, letter spacing, alignment, case, decoration, auto-resize. |
| `set_image_fill` | Fills one or more existing nodes with a base64 image (`FILL`, `FIT`, `CROP`, `TILE`). |
| `find_replace_text` | Finds and replaces text (plain string or regex) across all TEXT nodes in a subtree or page. |
| `set_fills` | Sets or appends a solid fill color (`#RRGGBB` or `#RRGGBBAA`) and opacity on a node. |
| `set_strokes` | Sets or appends a stroke color and stroke weight on a node. |
| `set_opacity` | Sets opacity (`0` to `1`) on one or more nodes. |
| `set_corner_radius` | Sets uniform or per-corner radius on one or more nodes. |
| `set_auto_layout` | Configures or updates auto-layout direction, padding, spacing, sizing, alignment, and wrap on a frame. |
| `set_constraints` | Sets horizontal and vertical layout constraints (pinning/stretching) relative to the parent. |
| `set_blend_mode` | Sets the layer blend mode (e.g. `MULTIPLY`, `SCREEN`, `OVERLAY`) on one or more nodes. |
| `set_visible` | Shows or hides one or more nodes. |
| `move_nodes` | Moves one or more nodes to an absolute `x`/`y` position. |
| `resize_nodes` | Resizes one or more nodes by `width` and/or `height`. |
| `rotate_nodes` | Rotates one or more nodes to an absolute angle in degrees. |
| `reorder_nodes` | Changes layer z-order (`bringToFront`, `sendToBack`, `bringForward`, `sendBackward`). |
| `reparent_nodes` | Moves one or more nodes into a different parent frame, group, or section. |
| `rename_node` | Renames a single node by ID. |
| `batch_rename_nodes` | Renames multiple nodes at once using find/replace, regex, prefix, or suffix rules. |
| `clone_node` | Duplicates an existing node with optional repositioning or reparenting. |
| `lock_nodes` | Locks one or more nodes to prevent accidental manual edits. |
| `unlock_nodes` | Unlocks one or more nodes. |
| `delete_nodes` | Permanently deletes one or more nodes from the document. |

### Styles and effects management

| Tool | What it does |
|------|--------------|
| `create_paint_style` | Creates a named local solid color paint style. |
| `create_text_style` | Creates a named local typography style (font family, weight, size, line-height, letter-spacing). |
| `create_effect_style` | Creates a named local effect style (drop shadow, inner shadow, layer blur, or background blur). |
| `create_grid_style` | Creates a named local layout grid style (`GRID`, `COLUMNS`, or `ROWS`). |
| `update_paint_style` | Updates an existing paint style's name, color, or description. |
| `rename_style` | Renames any local style (paint, text, effect, or grid) in place while preserving node linkages. |
| `delete_style` | Deletes a local style by ID. |
| `apply_style_to_node` | Links an existing paint, text, effect, or grid style to a node. |
| `set_effects` | Applies drop shadow, inner shadow, or blur effects directly to a node. |
| `replace_colors` | Recolours a whole subtree in one call: maps hex colours (fills, strokes, gradient stops, shadows, per-range text colours) to variables or new hex values. `dryRun` lists colours in use; `nodeTypes` limits it to e.g. TEXT. |
| `snap_to_tokens` | Binds auto-layout padding/gap and corner radii in a subtree to the nearest spacing/radius variables (pills use the full radius). `dryRun` reports value changes. |
| `bind_variable_to_node` | Binds a local variable (`COLOR`, `FLOAT`, `BOOLEAN`) to a node property (fills, strokes, spacing, radius, etc.). |
| `set_description` | Sets or clears documentation text on a component, component set, style, or variable. |

### Variables and collections management

| Tool | What it does |
|------|--------------|
| `create_variable_collection` | Creates a new local variable collection with an optional initial mode name. |
| `rename_variable_collection` | Renames an existing variable collection. |
| `add_variable_mode` | Adds a mode (e.g. `Light`/`Dark`) to a variable collection. |
| `rename_mode` | Renames a mode within a variable collection. |
| `create_variable` | Creates a `COLOR`, `FLOAT`, `STRING`, or `BOOLEAN` variable inside a collection. |
| `set_variable_value` | Sets a variable's value for a specific mode. |
| `rename_variable` | Renames a variable in place while preserving all node bindings. |
| `batch_rename_variables` | Renames up to 100 variables in a single round-trip. |
| `delete_variable` | Deletes a single variable or an entire variable collection. |

### Components, groups, and pages

| Tool | What it does |
|------|--------------|
| `group_nodes` | Groups two or more sibling nodes into a `GROUP`. |
| `ungroup_nodes` | Ungroups one or more `GROUP` nodes, moving their children into the parent. |
| `swap_component` | Swaps the main component of an `INSTANCE` node while preserving position and bounds. |
| `set_instance_properties` | Sets variant, boolean, and text properties on an instance by display name (e.g. `Size`, `Label`). |
| `detach_instance` | Detaches one or more component instances into plain frames. |
| `navigate_to_page` | Switches the active Figma page by `pageId` or `pageName`. |
| `add_page` | Adds a new page to the Figma document at an optional index. |
| `rename_page` | Renames an existing page by ID or current name. |
| `delete_page` | Deletes a page from the document (as long as at least one page remains). |

### Prototyping and reactions

| Tool | What it does |
|------|--------------|
| `set_reactions` | Sets or appends prototype reactions (triggers, navigation actions, transitions) on a node. |
| `remove_reactions` | Removes all or specific prototype reactions from a node by index. |

## License

MIT. See [LICENSE](LICENSE).
