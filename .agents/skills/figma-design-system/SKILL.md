---
name: figma-design-system
description: Manage Figma design systems, tokens, variables, component libraries, and style architectures using Figma MCP tools.
---

# Figma Design System Specialist

Use this skill when managing design tokens, variables, color/typography styles, and component architectures in Figma.

## Workflow

1. **Discover Existing Design Assets:**
   - Run `get_styles` to inspect existing paint, text, effect, and grid styles.
   - Run `get_variable_defs` to list existing variable collections, modes, and variable mappings.
   - Run `get_local_components` to review available local components and component sets.

2. **Manage Variables & Collections:**
   - Create collections: `create_variable_collection`
   - Add modes (e.g. Light, Dark, Tablet): `add_variable_mode`
   - Create variables: `create_variable` (types: `COLOR`, `FLOAT`, `STRING`, `BOOLEAN`)
   - Update variable values: `set_variable_value`
   - Bind variables to node properties: `bind_variable_to_node`

3. **Manage Styles:**
   - Create styles: `create_paint_style`, `create_text_style`, `create_effect_style`, `create_grid_style`
   - Update/recolor styles: `update_paint_style`, `rename_style`
   - Delete unused styles: `delete_style`

4. **Export Tokens:**
   - Export tokens to standard JSON: `export_tokens`
