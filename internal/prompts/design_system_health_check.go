package prompts

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func addDesignSystemHealthCheck(s *server.MCPServer) {
	s.AddPrompt(mcp.NewPrompt("design_system_health_check",
		mcp.WithPromptDescription("Audit a design system for naming inconsistencies, orphaned tokens, duplicates, and missing semantic layers"),
	), func(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		return mcp.NewGetPromptResult(
			"Audit a design system for naming inconsistencies, orphaned tokens, duplicates, and missing semantic layers",
			[]mcp.PromptMessage{
				mcp.NewPromptMessage(
					mcp.RoleUser,
					mcp.NewTextContent(`# Design System Health Check

Perform a comprehensive audit of the current Figma file's design system (variables and styles)
to identify naming inconsistencies, duplicates, orphaned tokens, and structural issues.

## Steps

1. **Extract all variables**
   Call get_variable_defs() to retrieve every variable collection, mode, and variable.
   Record each variable's: ID, name, resolvedType, collection name, and all mode values.

2. **Extract all styles**
   Call get_styles() to retrieve all local paint, text, effect, and grid styles.
   Record each style's: ID, name, type, and key properties.

3. **Check naming consistency**
   For each variable and style name, check against these rules:
   - Uses slash-separated hierarchy (e.g. "Color/Brand/Primary", not "color-brand-primary")
   - Group names are PascalCase (e.g. "Color/" not "color/" or "COLOR/")
   - Leaf names are consistent (either kebab-case or PascalCase — not mixed)
   - No auto-generated names remain (e.g. "Variable 1", "Style 2")
   - No inconsistent prefixes within the same type group (e.g. "Color/" mixed with "Colour/")
   - No numbering suffixes that suggest copy-paste (e.g. "Primary 2", "Card Copy")

4. **Identify duplicate tokens**
   - For COLOR variables: find variables with identical RGBA values but different names
   - For FLOAT variables: find variables with identical numeric values in the same collection
   - For paint styles: find styles with identical color values but different names
   - Flag these as candidates for consolidation

5. **Identify orphaned styles**
   - Call get_design_context(depth=3, detail="compact") to scan the design
   - For each paint/text/effect/grid style, check if any node references it
   - Styles referenced by zero nodes are potentially orphaned
   - Note: some styles may be intentionally kept for future use — flag, don't delete

6. **Check for missing semantic layer**
   - Look at variable names: are there only primitive tokens (e.g. "Blue/500") with no
     semantic aliases (e.g. "Color/Brand/Primary" aliasing "Blue/500")?
   - A healthy design system has two tiers:
     * Primitives: raw values ("Blue/500", "Gray/100", "4", "8", "16")
     * Semantic: contextual meanings ("Color/BG/Primary", "Spacing/MD")
   - If only primitives exist, flag that a semantic alias layer is recommended

7. **Present findings**
   Format results as a structured report table:

   | ID | Name | Issue Type | Details | Suggested Fix |
   |-----|------|-----------|---------|---------------|

   Issue types:
   - NAMING: Inconsistent naming convention
   - DUPLICATE: Same value under different names
   - ORPHANED: Style/variable not used by any node
   - AUTO_NAME: Figma auto-generated name not cleaned up
   - NO_SEMANTIC: Missing semantic alias layer
   - MIXED_CASE: Inconsistent casing within a group

## Rules
- This is a read-only audit — do NOT rename or delete anything.
- Present findings organized by severity: AUTO_NAME and NAMING first, then DUPLICATE, then ORPHANED.
- If the file has fewer than 5 variables/styles, skip the orphan check (too small to matter).
- Always finish with a summary: "X issues found across Y variables and Z styles."
`),
				),
			},
		), nil
	})
}
