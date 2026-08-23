---
name: figma-ui-builder
description: Construct UI layouts, frames, components, typography, and styling directly inside Figma using Figma MCP tools.
---

# Figma UI Builder Specialist

Use this skill when constructing screens, components, layouts, or visual elements in Figma.

## Workflow

1. **Context & Viewport:**
   - Call `get_viewport` or `get_selection` to locate where to generate the new frames.
   - Call `get_pages` / `navigate_to_page` if working on a specific page.

2. **Frame & Shape Creation:**
   - Create parent screen or card frame: `create_frame` (with `layoutMode`, `padding`, `itemSpacing`).
   - Create vector shapes: `create_rectangle`, `create_ellipse`.
   - Create text: `create_text`.
   - Import assets/icons: `import_image`.

3. **Auto-Layout & Hierarchy:**
   - Configure layout: `set_auto_layout` with `primaryAxisAlignItems`, `counterAxisAlignItems`, `layoutWrap`.
   - Organize hierarchy: `group_nodes`, `reparent_nodes`, `reorder_nodes`.
   - Apply sizing: `resize_nodes`, `set_constraints`.

4. **Styling & Polish:**
   - Apply fills/strokes: `set_fills`, `set_strokes`.
   - Apply corner rounding: `set_corner_radius`.
   - Set effects/opacity: `set_opacity`, `create_effect_style`.
   - Bind tokens/styles: `bind_variable_to_node`, `apply_style_to_node`.
