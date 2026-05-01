package prompts

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func addDesignSystemFromReference(s *server.MCPServer) {
	s.AddPrompt(mcp.NewPrompt("design_system_from_reference",
		mcp.WithPromptDescription("Scaffold a complete Figma design system (tokens, styles, structure) based on a reference design system like Material Design 3, Carbon, Polaris, or Ant Design"),
	), func(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		return mcp.NewGetPromptResult(
			"Scaffold a Figma design system based on a reference design system",
			[]mcp.PromptMessage{
				mcp.NewPromptMessage(
					mcp.RoleUser,
					mcp.NewTextContent(`# Design System from Reference

Scaffold a complete design system in Figma based on a well-known reference system.
The user picks a reference and this prompt creates the full token architecture.

## Supported Reference Systems

### Material Design 3 (Google)
Token architecture:
- **Reference tokens** (primitives): md.ref.palette.primary0–100, md.ref.palette.neutral0–100
- **System tokens** (semantic): md.sys.color.primary, md.sys.color.on-primary, md.sys.color.surface
- **Component tokens**: md.comp.button.filled.container.color
Color roles: primary, on-primary, primary-container, on-primary-container, secondary, tertiary,
  error, surface, on-surface, surface-variant, outline, inverse-surface, shadow, scrim
Spacing: compact=4, medium=8, expanded=16 (density system)
Typography: display-large/medium/small, headline-large/medium/small, title-large/medium/small,
  body-large/medium/small, label-large/medium/small
Shape: none=0, extra-small=4, small=8, medium=12, large=16, extra-large=28, full=9999

### Carbon Design System (IBM)
Token architecture:
- **Global tokens**: $carbon--blue-60, $carbon--gray-10
- **Contextual tokens**: $interactive-01, $text-01, $ui-01, $field-01
Spacing scale: 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128 (rem-based)
Typography: code-01/02, label-01/02, helper-text-01/02, body-short-01/02, body-long-01/02,
  heading-01–07, display-01–04
Icon sizes: 16, 20, 24, 32

### Polaris (Shopify)
Token architecture:
- **Primitives**: color-blue-100–900, color-gray-100–900
- **Semantic**: color-bg, color-bg-surface, color-text, color-text-secondary, color-icon,
  color-border, color-bg-fill-brand, color-bg-fill-success/warning/critical
Spacing: 025=1, 050=2, 100=4, 150=6, 200=8, 300=12, 400=16, 500=20, 600=24,
  800=32, 1000=40, 1200=48, 1600=64
Typography scale: heading-3xl/2xl/xl/lg/md/sm, body-lg/md/sm/xs
Border radius: 050=2, 100=4, 150=6, 200=8, 300=12, 400=16, 500=20, full=9999

### Ant Design (Alibaba)
Token architecture:
- **Seed tokens**: colorPrimary, colorSuccess, colorWarning, colorError, colorInfo
- **Map tokens** (derived): colorPrimaryBg, colorPrimaryBgHover, colorPrimaryBorder,
  colorPrimaryBorderHover, colorPrimaryHover, colorPrimary, colorPrimaryActive, colorPrimaryTextHover
- **Alias tokens**: colorBgContainer, colorBgElevated, colorText, colorTextSecondary
Spacing: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48
Border radius: borderRadius=6, borderRadiusSM=4, borderRadiusLG=8
Font sizes: 12, 14, 16, 20, 24, 30, 38, 46

## Workflow Steps

### 1. Ask the user
- Which reference system to follow (or describe a custom one)
- Their brand primary color (hex) — required
- Secondary/accent color — optional
- Whether to include dark mode — default yes
- Figma plan (free or paid) — affects multi-mode support

### 2. Map reference tokens to Figma structure

Based on the selected reference, generate a token plan:

| Collection | Variable Name | Type | Light Value | Dark Value |
|-----------|--------------|------|------------|------------|

Show this plan and get user approval.

### 3. Create in Figma

Execute in this order:
1. create_variable_collection() — one per token tier (e.g., "Primitives", "Semantic")
2. add_variable_mode() — add "Dark" mode if paid plan (handle free-plan fallback)
3. create_variable() — each token
4. set_variable_value() — light values, then dark values
5. create_text_style() — for each typography token
6. create_paint_style() — for key color styles (optional, variables preferred)
7. create_effect_style() — for shadow tokens (e.g., Shadow/SM, Shadow/MD, Shadow/LG)

### 4. Create reference page (optional)

Offer to create a "Design System Reference" page in Figma:
- Add a page via add_page(name="🎨 Design System")
- navigate_to_page() to switch to it
- Create frames showing color swatches, type samples, spacing examples
- This serves as a living documentation page

## Rules
- Always show the complete token plan before creating anything.
- Adapt the reference system's naming to Figma slash-notation (e.g., md.sys.color.primary → Color/Primary).
- Never create tokens that conflict with existing variables — check get_variable_defs() first.
- Handle free-plan mode limits: if add_variable_mode fails, use name-prefix workaround.
- Preserve any existing design system — only add new tokens.
`),
				),
			},
		), nil
	})
}
