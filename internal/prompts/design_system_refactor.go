package prompts

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func addDesignSystemRefactor(s *server.MCPServer) {
	s.AddPrompt(mcp.NewPrompt("design_system_refactor",
		mcp.WithPromptDescription("Systematically rename variables and styles to follow a target naming convention with dry-run preview"),
	), func(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		return mcp.NewGetPromptResult(
			"Systematically rename variables and styles to follow a target naming convention with dry-run preview",
			[]mcp.PromptMessage{
				mcp.NewPromptMessage(
					mcp.RoleUser,
					mcp.NewTextContent(`# Design System Refactor

Systematically rename variables and styles across the design system to follow a consistent
naming convention. Always preview changes before applying them.

## Steps

1. **Determine target naming convention**
   Ask the user which naming convention to apply. If they don't have a preference, suggest:
   - Slash-separated hierarchies: "Color/Brand/Primary", "Spacing/MD"
   - PascalCase group names, kebab-case leaf names
   - Semantic vs. primitive token tiers
   - Common type prefixes: Color/, Spacing/, Radius/, Typography/, Shadow/, Grid/

   If the file already has a partial convention, infer the dominant pattern and propose
   extending it to all tokens.

2. **Analyze current naming**
   - Call get_variable_defs() to get all variables
   - Call get_styles() to get all styles
   - Group tokens by their current naming pattern
   - Identify which tokens already follow the target convention (skip these)
   - Identify which tokens need renaming

3. **Generate rename mapping**
   Create a complete mapping table showing every proposed rename:

   | Type | ID | Current Name | Proposed Name | Reason |
   |------|-----|-------------|---------------|--------|

   Rules for generating proposed names:
   - Preserve existing slash hierarchy where it already follows the convention
   - Convert flat names to hierarchical: "primaryBlue" → "Color/Brand/Primary"
   - Normalize casing: "color/brand/primary" → "Color/Brand/Primary"
   - Remove auto-generated suffixes: "Color 2" → infer from value
   - Group related tokens under common prefixes
   - For variables with slash notation: changing the name changes the group — be explicit

4. **Present dry-run preview**
   Show the complete mapping table to the user. Highlight:
   - Total renames proposed
   - Any renames that will move variables between groups (slash-notation changes)
   - Any potential naming conflicts (two tokens mapping to the same name)
   Wait for explicit user approval before proceeding.

5. **Execute renames**
   After user approval:
   - For variables: use batch_rename_variables() for efficiency (up to 100 per call)
   - For styles: use rename_style() for each style (no batch operation available)
   - Process in order: collections first, then modes, then variables, then styles
   - This ensures group hierarchies are stable before renaming children

6. **Verify results**
   - Call get_variable_defs() again to confirm all variable renames applied
   - Call get_styles() again to confirm all style renames applied
   - Report any discrepancies

7. **Document changes (optional)**
   If the user wants documentation:
   - Use set_description() on renamed items to add a note like "Renamed from X to Y"
   - This creates an audit trail visible in Figma's design panel

## Naming Convention Reference

### Slash-separated hierarchy
- Color/Brand/Primary
- Color/Brand/Secondary
- Color/BG/Primary
- Color/BG/Secondary
- Color/Text/Primary
- Color/Text/Muted
- Spacing/XS (4px)
- Spacing/SM (8px)
- Spacing/MD (16px)
- Spacing/LG (24px)
- Spacing/XL (32px)
- Radius/SM
- Radius/MD
- Radius/LG
- Typography/Heading/H1
- Typography/Body/Regular
- Shadow/Card
- Shadow/Modal

### Two-tier token architecture
- **Primitives** (raw values): Blue/50, Blue/100, ..., Blue/900, Gray/50, ..., 4, 8, 16, 24
- **Semantic** (contextual aliases): Color/Brand/Primary → aliases Blue/600

## Rules
- NEVER rename without showing the dry-run preview first.
- NEVER proceed without explicit user confirmation.
- Skip tokens that already follow the target convention.
- If two tokens would end up with the same name, flag the conflict and ask the user to resolve.
- Process renames in dependency order: if variable A aliases variable B, rename B first.
`),
				),
			},
		), nil
	})
}
