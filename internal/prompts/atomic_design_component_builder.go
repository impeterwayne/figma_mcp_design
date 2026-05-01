package prompts

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func addAtomicDesignComponentBuilder(s *server.MCPServer) {
	s.AddPrompt(mcp.NewPrompt("atomic_design_component_builder",
		mcp.WithPromptDescription("Build Figma components following Atomic Design methodology — atoms, molecules, organisms with proper variable bindings"),
	), func(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		return mcp.NewGetPromptResult(
			"Build Figma components following Atomic Design methodology",
			[]mcp.PromptMessage{
				mcp.NewPromptMessage(
					mcp.RoleUser,
					mcp.NewTextContent(`# Atomic Design Component Builder

Build Figma components following Brad Frost's Atomic Design methodology.
Components are structured from atoms → molecules → organisms, each bound to design tokens.

## Atomic Design Reference

### Atoms
The smallest, indivisible UI elements. They cannot be broken down further without losing meaning.
Examples: button, text input, label, icon, avatar, badge, divider, checkbox, radio, toggle

Atom requirements:
- Must use design token variables for all visual properties (fill, stroke, radius, spacing)
- Must have auto-layout for proper resizing
- Must include all necessary states as variants (default, hover, active, disabled, focus)

### Molecules
Groups of atoms that function together as a unit.
Examples: search bar (input + button), form field (label + input + helper text),
  card header (avatar + name text + subtitle), nav item (icon + label)

Molecule requirements:
- Composed of atom instances (not raw shapes)
- Auto-layout with proper spacing tokens
- Should resize gracefully (hug content or fill container)

### Organisms
Complex UI components composed of molecules and/or atoms.
Examples: navigation bar, card, form, header, data table row, modal dialog

Organism requirements:
- Composed of molecule and atom instances
- Defines the layout structure (vertical/horizontal, spacing, alignment)
- May include variants for different content configurations

## Component Building Workflow

### 1. Determine component level
Ask the user what they want to build. Classify it:
- If it's a single, indivisible element → **Atom**
- If it combines 2–4 atoms into a functional unit → **Molecule**
- If it combines molecules/atoms into a complex section → **Organism**

### 2. Check existing tokens
- Call get_variable_defs() to find available color, spacing, and radius tokens
- Call get_styles() to find text and effect styles
- If needed tokens don't exist, suggest creating them first

### 3. Build bottom-up

**For Atoms:**
1. create_frame() with name="ComponentName" and auto-layout
2. Add child elements: create_rectangle() for backgrounds, create_text() for labels
3. set_fills() using design token colors (or bind_variable_to_node for fillColor)
4. set_corner_radius() using radius tokens
5. set_auto_layout() with spacing from spacing tokens
6. bind_variable_to_node() to connect visual properties to variables
7. create_component() to convert the frame into a reusable component

**For Molecules:**
1. Build required atoms first (if they don't exist as components)
2. create_frame() for the molecule container with auto-layout
3. Use clone_node() or reference existing atom components
4. Arrange with set_auto_layout() and spacing tokens
5. create_component() to make it reusable

**For Organisms:**
1. Ensure required molecules and atoms exist
2. create_frame() for the organism container
3. Compose from molecule/atom instances
4. Apply layout structure
5. create_component()

### 4. Name components properly
Use slash notation for the Figma component panel:
- Atoms: "Atom/Button", "Atom/Input", "Atom/Badge"
- Molecules: "Molecule/SearchBar", "Molecule/FormField"
- Organisms: "Organism/NavBar", "Organism/Card", "Organism/Modal"

### 5. Add descriptions
Use set_description() on each component to document:
- What level it is (atom/molecule/organism)
- What it's composed of
- Usage guidelines

## Common Component Blueprints

### Button (Atom)
Structure: Frame (auto-layout horizontal, padding 12/24, gap 8)
  ├── Icon placeholder (optional, 20×20)
  └── Label (text, "Button", 14px medium)
Fill: Color/Primary/Default
Text: Color/Text/OnPrimary
Radius: Radius/MD (8px)
Min height: 40px (touch target)

### Form Field (Molecule)
Structure: Frame (auto-layout vertical, gap 4)
  ├── Label (atom: text, 14px medium, Color/Text/Default)
  ├── Input (atom: frame 40px height, border Color/Border/Default, radius Radius/SM)
  └── Helper text (atom: text, 12px, Color/Text/Subtle)

### Card (Organism)
Structure: Frame (auto-layout vertical, padding 16, gap 12, radius Radius/LG)
  ├── Card Header (molecule: avatar + title + subtitle)
  ├── Card Body (frame: content area)
  └── Card Footer (molecule: action buttons)
Fill: Color/BG/Surface
Border: Color/Border/Default, 1px
Shadow: Shadow/Card

## Rules
- Always check for existing components before creating duplicates — call get_local_components() first.
- Always bind visual properties to design token variables, never use raw hex values.
- Use auto-layout on every container — no absolute positioning within components.
- Name components using slash notation for proper panel organization.
- Build atoms first, then molecules, then organisms — never skip levels.
- Show the user a plan of what will be created before executing.
`),
				),
			},
		), nil
	})
}
