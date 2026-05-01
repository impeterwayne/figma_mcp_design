package prompts

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func addWCAGAccessibilityAudit(s *server.MCPServer) {
	s.AddPrompt(mcp.NewPrompt("wcag_accessibility_audit",
		mcp.WithPromptDescription("Audit Figma design tokens and styles against WCAG 2.2 accessibility guidelines (contrast ratios, touch targets, focus indicators)"),
	), func(ctx context.Context, req mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		return mcp.NewGetPromptResult(
			"Audit Figma design tokens and styles against WCAG 2.2 accessibility guidelines",
			[]mcp.PromptMessage{
				mcp.NewPromptMessage(
					mcp.RoleUser,
					mcp.NewTextContent(`# WCAG 2.2 Accessibility Audit

Audit the current Figma file's design system against WCAG 2.2 accessibility requirements.
Apply authoritative W3C and WAI guidelines to identify and fix violations.

## Embedded WCAG 2.2 Reference

### Color Contrast (Success Criteria 1.4.3 & 1.4.6)
- **AA Normal text** (< 18pt or < 14pt bold): minimum contrast ratio **4.5:1**
- **AA Large text** (≥ 18pt or ≥ 14pt bold): minimum contrast ratio **3:1**
- **AAA Normal text**: minimum contrast ratio **7:1**
- **AAA Large text**: minimum contrast ratio **4.5:1**
- **Non-text contrast** (1.4.11): UI components and graphical objects require **3:1** minimum

### Contrast Ratio Formula
Contrast ratio = (L1 + 0.05) / (L2 + 0.05)
Where L1 = relative luminance of lighter color, L2 = relative luminance of darker color.

Relative luminance for each sRGB channel:
- If sRGB ≤ 0.04045: linear = sRGB / 12.92
- If sRGB > 0.04045: linear = ((sRGB + 0.055) / 1.055) ^ 2.4
- L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear

### Touch Target Size (Success Criterion 2.5.8)
- **Minimum**: 24×24 CSS pixels
- **Enhanced (AAA)**: 44×44 CSS pixels
- Exception: inline links in text, and targets with sufficient spacing

### Focus Indicators (Success Criterion 2.4.11 & 2.4.12)
- Focus indicator must have minimum area of **2 CSS pixels** around the perimeter
- Contrast of focus indicator against adjacent colors: **3:1** minimum
- Focus indicator should not be obscured by other content

### Color Not Sole Indicator (Success Criterion 1.4.1)
- Color must not be the only visual means of conveying information
- Use additional indicators: icons, patterns, text labels, underlines

## Audit Steps

### Phase 1 — Gather Design Tokens

1. Call get_variable_defs() to get all variables.
2. Call get_styles() to get all styles.
3. Identify:
   - **Background colors**: variables/styles containing "bg", "background", "surface" in name
   - **Text colors**: variables/styles containing "text", "foreground", "content" in name
   - **Border/UI colors**: variables/styles containing "border", "stroke", "outline" in name
   - **Interactive colors**: variables/styles containing "primary", "action", "link", "focus" in name

### Phase 2 — Contrast Audit

For each logical pairing of background + foreground tokens:
1. Extract the hex values from variables/styles.
2. Convert hex to sRGB (0–1 range), then to linear RGB, then compute relative luminance.
3. Calculate contrast ratio.
4. Compare against WCAG thresholds.

Common pairings to check:
- Background/Default + Text/Default  → must pass AA normal text (4.5:1)
- Background/Default + Text/Subtle   → must pass AA normal text (4.5:1)
- Background/Subtle  + Text/Default  → must pass AA normal text (4.5:1)
- Background/Default + Primary color → must pass AA large text (3:1) at minimum
- Background/Default + Border color  → must pass non-text contrast (3:1)
- Primary color (as bg) + White text → must pass AA normal text (4.5:1)

### Phase 3 — Component Scan

1. Call get_design_context(depth=3, detail="compact") to scan the design.
2. For interactive elements (buttons, inputs, toggles):
   - Check if dimensions meet 24×24px minimum touch target
   - Check if there's a visible focus state variant
3. For icons used as the sole indicator:
   - Check if color alone distinguishes states (error: red icon only → needs text label too)

### Phase 4 — Report

Present findings as:

| # | Token/Node | Issue | Value | Threshold | Ratio | Status |
|---|-----------|-------|-------|-----------|-------|--------|
| 1 | Text/Primary on BG/Default | Contrast | #333 on #FFF | 4.5:1 AA | 12.6:1 | ✅ PASS |
| 2 | Text/Subtle on BG/Subtle | Contrast | #999 on #F5F5F5 | 4.5:1 AA | 2.8:1 | ❌ FAIL |

### Phase 5 — Fix (with user approval)

For each failing contrast pair, suggest a fix:
- Darken the text color or lighten the background until the ratio passes
- Use set_variable_value() to update the token
- Show before/after hex values and contrast ratios

## Rules
- Calculate contrast ratios mathematically using the sRGB luminance formula above — do not estimate.
- Check both light and dark mode values if multiple modes exist.
- Always show the full report before making any changes.
- Distinguish between AA and AAA violations — AA is required, AAA is recommended.
- Skip variables that are clearly not foreground/background pairs (e.g., spacing, radius tokens).
`),
				),
			},
		), nil
	})
}
