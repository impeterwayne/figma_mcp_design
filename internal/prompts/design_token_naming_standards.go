package prompts

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func addDesignTokenNamingStandards(s *server.MCPServer) {
	s.AddPrompt(mcp.NewPrompt("design_token_naming_standards",
		mcp.WithPromptDescription("Apply W3C Design Tokens Community Group (DTCG) naming standards and token tier architecture to your Figma variables"),
	), func(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		return mcp.NewGetPromptResult(
			"Apply W3C DTCG naming standards and token tier architecture",
			[]mcp.PromptMessage{
				mcp.NewPromptMessage(
					mcp.RoleUser,
					mcp.NewTextContent(`# Design Token Naming Standards (W3C DTCG)

Apply the W3C Design Tokens Community Group specification and industry best practices
to organize your Figma variables into a well-structured, scalable token system.

## W3C DTCG Specification Reference

### Token Types (per W3C spec)
The DTCG specification defines these token types:
- **color**: sRGB hex or color function values
- **dimension**: numeric value with unit (px, rem, em)
- **fontFamily**: font family name string
- **fontWeight**: numeric weight or keyword
- **duration**: time value (ms, s) for animations
- **cubicBezier**: easing function [x1, y1, x2, y2]
- **number**: raw numeric value (no unit)
- **strokeStyle**: border style (solid, dashed, etc.)
- **border**: composite {color, width, style}
- **transition**: composite {duration, delay, timingFunction}
- **shadow**: composite {color, offsetX, offsetY, blur, spread}
- **gradient**: composite with color stops
- **typography**: composite {fontFamily, fontSize, fontWeight, lineHeight, letterSpacing}

### Token Naming Convention (DTCG recommended)
Format: {category}/{concept}/{property}/{variant}/{state}

Examples:
- color/brand/primary/default
- color/brand/primary/hover
- color/feedback/success/default
- spacing/component/padding/sm
- typography/heading/lg/font-size
- shadow/elevation/md

### Three-Tier Token Architecture

**Tier 1 — Global / Reference Tokens (Primitives)**
Raw design values with no semantic meaning.
- Color scales: Blue/50, Blue/100, ..., Blue/900
- Spacing scale: 0, 2, 4, 8, 12, 16, 24, 32, 48, 64
- Font sizes: 10, 12, 14, 16, 18, 20, 24, 30, 36, 48
- Radii: 0, 2, 4, 8, 12, 16, 9999
- Opacity: 0, 0.04, 0.08, 0.12, 0.16, 0.38, 0.6, 0.87, 1.0

Figma mapping: Variable collection "Primitives" with groups like Blue/, Gray/, Green/, Spacing/

**Tier 2 — Semantic / Alias Tokens**
Contextual meaning — what the value is used for (not what it looks like).
- Color/BG/Default → references Primitives/White (light) or Primitives/Gray-900 (dark)
- Color/BG/Surface → references Primitives/Gray-50 (light) or Primitives/Gray-800 (dark)
- Color/Text/Default → references Primitives/Gray-900 (light) or Primitives/Gray-50 (dark)
- Color/Text/Subtle → references Primitives/Gray-500 (light) or Primitives/Gray-400 (dark)
- Color/Brand/Primary → references Primitives/Blue-600
- Color/Border/Default → references Primitives/Gray-200 (light) or Primitives/Gray-700 (dark)
- Spacing/Component/SM → references Primitives/8
- Spacing/Component/MD → references Primitives/16
- Radius/Component/SM → references Primitives/4
- Radius/Component/MD → references Primitives/8

Figma mapping: Variable collection "Semantic" with Light/Dark modes

**Tier 3 — Component Tokens (optional, for large systems)**
Tokens scoped to specific components.
- Button/Color/Fill/Primary → references Color/Brand/Primary
- Button/Color/Fill/Primary/Hover → references Color/Brand/Primary/Hover
- Button/Spacing/Padding/Horizontal → references Spacing/Component/MD
- Input/Color/Border/Default → references Color/Border/Default
- Input/Color/Border/Focus → references Color/Brand/Primary

Figma mapping: Variable collection "Components"

## Audit & Restructure Steps

### Phase 1 — Analyze current state

1. Call get_variable_defs() to get all variable collections, modes, and variables.
2. Call get_styles() to get all local styles.
3. Classify each existing token:
   - Is it a primitive (raw value, no context)? → Tier 1
   - Is it semantic (contextual name)? → Tier 2
   - Is it component-scoped? → Tier 3
   - Is it unclassifiable / badly named? → needs rename

4. Identify structural issues:
   - Primitives mixed with semantic tokens in the same collection
   - Missing tiers (e.g., only primitives, no semantic layer)
   - Inconsistent naming patterns within the same tier
   - Variables that should be semantic but have primitive names

### Phase 2 — Propose restructuring

Present a restructuring plan:

| Current Name | Current Collection | Proposed Name | Proposed Collection | Tier |
|-------------|-------------------|--------------|--------------------|----- |

Include:
- Which collections to create/rename
- Which variables to move/rename
- Which new semantic aliases to create
- Which modes to set up (if not already present)

### Phase 3 — Execute (with user approval)

1. Create missing collections: create_variable_collection()
2. Rename existing collections if needed: rename_variable_collection()
3. Rename modes: rename_mode()
4. Batch rename variables: batch_rename_variables()
5. Create new semantic tokens: create_variable() + set_variable_value()
6. Rename styles: rename_style()

### Phase 4 — Validate

1. Call get_variable_defs() to verify new structure
2. Check that all semantic tokens have values for all modes
3. Verify naming consistency across all tiers
4. Report summary: "Restructured X variables across Y collections into Z tiers"

## Rules
- Show the complete restructuring plan before making any changes.
- Preserve all existing variable bindings — use rename operations, not delete+recreate.
- batch_rename_variables() is 10–50x faster than individual rename_variable() calls — always batch.
- When a variable has node bindings, renaming is safe (bindings are preserved).
- Group related changes: rename all variables in one collection before moving to the next.
- If the file already has a good structure, say so — don't force unnecessary changes.
`),
				),
			},
		), nil
	})
}
