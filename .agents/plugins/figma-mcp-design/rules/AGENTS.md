# Figma MCP Design Rules

When interacting with Figma via the Figma MCP Server:

1. **Connection Awareness**:
   - Ensure the Figma Desktop application is open and running the Figma MCP Design plugin (`Plugins -> Development -> Figma MCP Design`).
   - The Go MCP server communicates with the plugin over WebSocket (`ws://127.0.0.1:1995`).

2. **Query Optimization**:
   - Prefer targeted reads (`get_selection`, `get_node`, `get_design_context`, `search_nodes`) over reading the entire document (`get_document`) for large files to optimize performance.
   - When retrieving design context, use appropriate `maxDepth` and `detailLevel` settings.

3. **Design System & Styling**:
   - When creating or modifying UI, prefer binding variables (`bind_variable_to_node`) and applying named styles (`apply_style_to_node`) rather than hardcoding raw colors or dimensions.
   - Use Auto-Layout (`set_auto_layout`) with explicit padding, item spacing, and alignment for responsive frame compositions.
