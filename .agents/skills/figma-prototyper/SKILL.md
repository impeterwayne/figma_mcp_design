---
name: figma-prototyper
description: Configure interactive prototype transitions, triggers, and navigation flows in Figma using Figma MCP tools.
---

# Figma Prototyper Specialist

Use this skill when connecting interactive prototypes, setting reaction triggers, and testing Figma flows.

## Workflow

1. **Inspect Existing Interactions:**
   - Read prototype reactions on a node: `get_reactions`
   - List pages: `get_pages`

2. **Wire Reactions & Interactions:**
   - Configure reactions: `set_reactions`
     - **Triggers**: `ON_CLICK`, `ON_HOVER`, `ON_PRESS`, `ON_DRAG`, `AFTER_TIMEOUT`
     - **Actions**: `NAVIGATE_TO`, `OPEN_OVERLAY`, `SCROLL_TO`, `BACK`, `CLOSE_OVERLAY`
     - **Transitions**: `SMART_ANIMATE`, `DISSOLVE`, `MOVE_IN`, `SLIDE_IN`, `PUSH`

3. **Modify / Clear Reactions:**
   - Append to existing reactions or replace: `set_reactions` (mode: `append` | `replace`)
   - Remove specific or all reactions: `remove_reactions`
