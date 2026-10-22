---
name: figma-design-workflow
description: >-
  High-efficiency workflow for inspecting, building, and modifying Figma designs using Figma MCP tools.
  Combines surgical node traversal, auto-layout construction, design token binding from UI/UX Pro Max, and layout validation.
---

# Figma MCP Design Workflow

Use this skill when inspecting, modifying, or creating UI layouts, components, design tokens, and interactions in Figma via Figma MCP tools.

---

## 1. Token & Context Economy (Avoid Token Waste)

- **NEVER fetch the entire document tree** with `get_document` on large files.
- **Surgical Inspection:**
  - `get_selection`: Find what the user currently has selected in Figma.
  - `get_viewport`: Locate the user's current canvas viewport to position new frames nearby.
  - `get_node(node_id, depth=2)`: Query only the target node and its immediate children.
  - `search_nodes(query, type)`: Locate specific components (e.g., buttons, header, card) by name or type.
  - `get_design_context(node_id)`: Retrieve layout, constraints, and styling context in a compact format.

---

## 2. Standard Execution Pipeline

Follow this 5-stage pipeline for reliable, deterministic Figma MCP operations:

```
[1. Locate Context] ──► [2. Structure & Auto-Layout] ──► [3. Style & Shape] ──► [4. Token Binding] ──► [5. Validation]
```

### Stage 1: Context & Positioning
1. Query `get_viewport` or `get_selection` to determine `(x, y)` coordinates for new elements.
2. If working on a specific page, verify with `get_pages` or switch via `navigate_to_page`.

### Stage 2: Structure & Auto-Layout
1. **Container Frame:** Create parent container using `create_frame(name, x, y, width, height)`.
2. **Auto-Layout Configuration:**
   - Call `set_auto_layout` with:
     - `layoutMode`: `"HORIZONTAL"` | `"VERTICAL"` | `"NONE"`
     - `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`
     - `itemSpacing` (gap between elements)
     - `primaryAxisAlignItems`: `"MIN"` | `"CENTER"` | `"MAX"` | `"SPACE_BETWEEN"`
     - `counterAxisAlignItems`: `"MIN"` | `"CENTER"` | `"MAX"`
     - `layoutWrap`: `"NO_WRAP"` | `"WRAP"`
3. **Child Elements & Nesting:**
   - Create child elements (`create_rectangle`, `create_ellipse`, `create_text`, `create_frame`, `import_image`) **with `parentId` set to their auto-layout parent**. Never create a child without `parentId` and move it afterwards.
   - Reusable parts (buttons, inputs, cards) come from components: `create_instance(componentId, parentId, properties)`, then adjust with `set_instance_properties`. Do not redraw them from shapes.
   - Use `reparent_nodes` only to restructure nodes that already exist.

### Stage 3: Visual Styling & Typography
1. **Fills & Colors:** Use `set_fills` with a hex color: `#RRGGBB` or `#RRGGBBAA`. Prefer `bind_variable_to_node` / `apply_style_to_node` when tokens exist.
2. **Strokes & Borders:** Use `set_strokes` with weight, color, and alignment.
3. **Corner Radius:**
   - Cards/Panels: 8px - 16px.
   - Pills/Badges/Circular Buttons: `cornerRadius = 999` or `size / 2`.
4. **Typography:**
   - Call `create_text` with `parentId`, font family, style, and size from the type scale.
   - Adjust existing text with **one** `set_text_properties` call over all affected `nodeIds` (fontFamily, fontStyle, fontSize, lineHeight `24`/`"150%"`/`"AUTO"`, letterSpacing, textAlignHorizontal, textCase, textAutoResize). Never delete and recreate text to restyle it.
   - Change copy on many nodes with one `set_text` call using `items: [{nodeId, text}, ...]`.
5. **Images:** Put photos into existing placeholders with `set_image_fill(nodeIds, imageData, scaleMode)` instead of creating loose image nodes.

### Stage 4: Design System & Token Binding (UI/UX Pro Max Integration)
1. Query design tokens from `ui-ux-pro-max` (or local `foundation_tokens.json`):
   ```bash
   python .agents/skills/ui-ux-pro-max/scripts/search.py "<product/domain>" --design-system
   ```
2. Bind semantic variables or styles where available in the Figma document:
   - `bind_variable_to_node(node_id, variable_id, field)`
   - `apply_style_to_node(node_id, style_id, style_type)`

### Stage 5: Bounds & Visual Verification
1. Inspect modified nodes using `get_node(node_id)` to confirm sizing, positioning, and auto-layout bounds.
2. Ensure text nodes have appropriate resizing behavior via `set_text_properties` `textAutoResize`: `"WIDTH_AND_HEIGHT"`, `"HEIGHT"`, `"NONE"`, or `"TRUNCATE"`.

---

## 3. Common Component Recipes

### A. Circular Button (e.g. Numeric Keypad, Action Button)
- **Geometry:** Width == Height (e.g. 64x64 or 72x72).
- **Corner Radius:** `cornerRadius = width / 2` or `999`.
- **Auto-Layout:**
  - `layoutMode: "HORIZONTAL"`
  - `primaryAxisAlignItems: "CENTER"`
  - `counterAxisAlignItems: "CENTER"`
- **Content:** Centered text or vector icon.

### B. Responsive Card / Bento Grid
- **Geometry:** Full width with responsive constraints (`layoutAlign: "STRETCH"`).
- **Padding:** 16px - 24px consistent padding.
- **Corner Radius:** 12px - 20px with subtle border stroke (`#E2E8F0` or dark equivalent).
- **Shadow:** Elevation 1 or 2 soft drop shadow.

### C. Numeric Keypad Grid (e.g., Mental Math Calculator)
- **Container:** Vertical Auto-Layout with 12px - 16px gap.
- **Rows (4 rows):** Horizontal Auto-Layout frames with `primaryAxisAlignItems: "CENTER"`, `itemSpacing: 12px`.
- **Row 1:** [1] [2] [3]
- **Row 2:** [4] [5] [6]
- **Row 3:** [7] [8] [9]
- **Row 4:** [Clear] [0] [Submit/Delete]
- **Buttons:** Circular or uniform rounded squircle frames with centered typography.

---

## 4. MCP Error Prevention Checklist

- [ ] **Check coordinates:** Do not spawn frames at `(0, 0)` if existing designs exist elsewhere; use `get_viewport` or position relative to target frames.
- [ ] **Avoid layout collapse:** When setting auto-layout on existing children, reparent them cleanly instead of stacking coordinate offsets.
- [ ] **Verify color format:** MCP color parameters take hex strings (`#8B5CF6`, or `#8B5CF680` with alpha).
- [ ] **Always pass `parentId`:** every `create_*` and `create_instance` call inside a layout names its parent; nothing is created loose on the page and reparented later.
- [ ] **Batch over loops:** one `set_text_properties` / `set_text items` / `set_image_fill` call over many nodes instead of one call per node.
- [ ] **Ensure font availability:** Use standard web/Google fonts (e.g. Inter, Roboto, Plus Jakarta Sans, Atkinson Hyperlegible) to prevent font loading errors.
- [ ] **No Unicode for Icons:** Do NOT use Unicode characters/emojis for icons or visual symbols in text nodes; use dedicated vector icons/shapes.
