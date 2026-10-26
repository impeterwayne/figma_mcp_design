package internal

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func registerWriteStyleTools(s *server.MCPServer, node *Node) {
	s.AddTool(mcp.NewTool("create_paint_style",
		mcp.WithDescription("Create a new local paint style with a solid fill color."),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Style name e.g. 'Brand/Primary'"),
		),
		mcp.WithString("color",
			mcp.Required(),
			mcp.Description("Fill color as hex e.g. #FF5733"),
		),
		mcp.WithString("description", mcp.Description("Optional style description")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "create_paint_style", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_text_style",
		mcp.WithDescription("Create a new local text style (typography preset). Returns the new style's ID. Apply it to nodes with apply_style_to_node. Use get_styles to list existing text styles."),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Style name — use slash notation to organise into groups e.g. 'Heading/H1', 'Body/Regular'"),
		),
		mcp.WithNumber("fontSize", mcp.Description("Font size in pixels (default 16)")),
		mcp.WithString("fontFamily", mcp.Description("Font family name e.g. 'Inter', 'Roboto' (default Inter). Must be installed in Figma.")),
		mcp.WithString("fontStyle", mcp.Description("Font style variant e.g. 'Regular', 'Bold', 'Medium', 'SemiBold' (default Regular)")),
		mcp.WithString("textDecoration", mcp.Description("Text decoration: NONE (default), UNDERLINE, or STRIKETHROUGH")),
		mcp.WithNumber("lineHeightValue", mcp.Description("Line height value (unit set by lineHeightUnit)")),
		mcp.WithString("lineHeightUnit", mcp.Description("Line height unit: PIXELS (default) or PERCENT")),
		mcp.WithNumber("letterSpacingValue", mcp.Description("Letter spacing value (unit set by letterSpacingUnit)")),
		mcp.WithString("letterSpacingUnit", mcp.Description("Letter spacing unit: PIXELS (default) or PERCENT")),
		mcp.WithString("description", mcp.Description("Optional human-readable description shown in the Figma style panel")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "create_text_style", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_effect_style",
		mcp.WithDescription("Create a new local effect style (drop shadow, inner shadow, or blur)."),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Style name e.g. 'Shadow/Card'"),
		),
		mcp.WithString("type", mcp.Description("Effect type: DROP_SHADOW (default), INNER_SHADOW, LAYER_BLUR, or BACKGROUND_BLUR")),
		mcp.WithString("color", mcp.Description("Shadow color as hex e.g. #000000 (default #000000, shadows only)")),
		mcp.WithNumber("opacity", mcp.Description("Shadow color opacity 0–1 (default 0.25, shadows only)")),
		mcp.WithNumber("radius", mcp.Description("Blur radius in pixels (default 8 for shadows, 4 for blurs)")),
		mcp.WithNumber("offsetX", mcp.Description("Shadow X offset in pixels (default 0, shadows only)")),
		mcp.WithNumber("offsetY", mcp.Description("Shadow Y offset in pixels (default 4, shadows only)")),
		mcp.WithNumber("spread", mcp.Description("Shadow spread in pixels (default 0, shadows only)")),
		mcp.WithString("description", mcp.Description("Optional style description")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "create_effect_style", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_grid_style",
		mcp.WithDescription("Create a new local layout grid style."),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Style name e.g. 'Grid/Desktop'"),
		),
		mcp.WithString("pattern", mcp.Description("Grid pattern: GRID (default), COLUMNS, or ROWS")),
		mcp.WithNumber("count", mcp.Description("Number of columns or rows (COLUMNS/ROWS only, default 12)")),
		mcp.WithNumber("gutterSize", mcp.Description("Gutter size in pixels (COLUMNS/ROWS only, default 16)")),
		mcp.WithNumber("offset", mcp.Description("Margin/offset in pixels (COLUMNS/ROWS only, default 0)")),
		mcp.WithString("alignment", mcp.Description("Alignment: STRETCH (default), CENTER, MIN, or MAX (COLUMNS/ROWS only)")),
		mcp.WithNumber("sectionSize", mcp.Description("Grid cell size in pixels (GRID only, default 8)")),
		mcp.WithString("color", mcp.Description("Grid line color as hex e.g. #FF0000 (GRID only, default #FF0000)")),
		mcp.WithNumber("opacity", mcp.Description("Grid line opacity 0–1 (GRID only, default 0.1)")),
		mcp.WithString("description", mcp.Description("Optional style description")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "create_grid_style", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("update_paint_style",
		mcp.WithDescription("Update an existing paint style's name, color, or description. Only paint styles support in-place updates — to modify text, effect, or grid styles, use delete_style and recreate them."),
		mcp.WithString("styleId",
			mcp.Required(),
			mcp.Description("Paint style ID"),
		),
		mcp.WithString("name", mcp.Description("New style name")),
		mcp.WithString("color", mcp.Description("New fill color as hex e.g. #FF5733")),
		mcp.WithString("description", mcp.Description("New style description")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "update_paint_style", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("delete_style",
		mcp.WithDescription("Delete a style (paint, text, effect, or grid) by its ID."),
		mcp.WithString("styleId",
			mcp.Required(),
			mcp.Description("Style ID to delete"),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "delete_style", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("apply_style_to_node",
		mcp.WithDescription("Apply an existing local style (paint, text, effect, or grid) to a node, linking the node to that style."),
		mcp.WithString("nodeId",
			mcp.Required(),
			mcp.Description("Target node ID in colon format e.g. 4029:12345"),
		),
		mcp.WithString("styleId",
			mcp.Required(),
			mcp.Description("Style ID to apply (from get_styles)"),
		),
		mcp.WithString("target", mcp.Description("For paint styles only — apply to 'fill' (default) or 'stroke'")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		nodeID, _ := args["nodeId"].(string)
		nodeID = NormalizeNodeID(nodeID)
		params := map[string]interface{}{
			"styleId": args["styleId"],
		}
		if t, ok := args["target"]; ok {
			params["target"] = t
		}
		resp, err := node.Send(ctx, "apply_style_to_node", []string{nodeID}, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("set_effects",
		mcp.WithDescription("Apply one or more effects (drop shadow, inner shadow, layer blur, background blur) directly to a node. Replaces all existing effects. Pass an empty array to clear all effects."),
		mcp.WithString("nodeId",
			mcp.Required(),
			mcp.Description("Target node ID in colon format e.g. 4029:12345"),
		),
		mcp.WithArray("effects",
			mcp.Required(),
			mcp.Description("Array of effect objects. Each has: type (DROP_SHADOW | INNER_SHADOW | LAYER_BLUR | BACKGROUND_BLUR), radius, color (hex, shadows only), opacity (0–1, shadows only), offsetX, offsetY (shadows only), spread (shadows only), visible (default true)"),
			mcp.Items(map[string]any{"type": "object"}),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		nodeID, _ := args["nodeId"].(string)
		nodeID = NormalizeNodeID(nodeID)
		params := map[string]interface{}{
			"effects": args["effects"],
		}
		resp, err := node.Send(ctx, "set_effects", []string{nodeID}, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("bind_variable_to_node",
		mcp.WithDescription("Bind a local variable to a node property so the property is driven by the variable's value. COLOR variables: use fillColor or strokeColor. BOOLEAN variables: use visible. FLOAT variables: use opacity, rotation, width, height, cornerRadius, topLeftRadius, topRightRadius, bottomLeftRadius, bottomRightRadius, strokeWeight, itemSpacing, paddingTop, paddingRight, paddingBottom, paddingLeft."),
		mcp.WithString("nodeId",
			mcp.Required(),
			mcp.Description("Target node ID in colon format e.g. 4029:12345"),
		),
		mcp.WithString("variableId",
			mcp.Required(),
			mcp.Description("Variable ID to bind (from get_variable_defs)"),
		),
		mcp.WithString("field",
			mcp.Required(),
			mcp.Description("Property to bind: fillColor | strokeColor | visible | opacity | rotation | width | height | cornerRadius | topLeftRadius | topRightRadius | bottomLeftRadius | bottomRightRadius | strokeWeight | itemSpacing | paddingTop | paddingRight | paddingBottom | paddingLeft"),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		nodeID, _ := args["nodeId"].(string)
		nodeID = NormalizeNodeID(nodeID)
		params := map[string]interface{}{
			"variableId": args["variableId"],
			"field":      args["field"],
		}
		resp, err := node.Send(ctx, "bind_variable_to_node", []string{nodeID}, params)
		return renderResponse(resp, err)
	})
	s.AddTool(mcp.NewTool("rename_style",
		mcp.WithDescription("Rename any local style (paint, text, effect, or grid) in place, preserving all node linkages. "+
			"Use slash notation for group hierarchies (e.g. 'Brand/Primary', 'Heading/H1'). "+
			"Unlike update_paint_style, this works for ALL style types."),
		mcp.WithString("styleId",
			mcp.Required(),
			mcp.Description("Style ID to rename (from get_styles)"),
		),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("New style name — use slash notation to organise into groups"),
		),
		mcp.WithString("description", mcp.Description("Optional new description for the style")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "rename_style", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("set_description",
		mcp.WithDescription("Set the description text on a component, component set, style, or variable. "+
			"Provide exactly one of nodeId, styleId, or variableId. Pass an empty string to clear the description. "+
			"Useful for documenting refactoring changes or adding design intent notes."),
		mcp.WithString("nodeId", mcp.Description("Node ID of a COMPONENT or COMPONENT_SET (colon format e.g. '4029:12345')")),
		mcp.WithString("styleId", mcp.Description("Style ID (from get_styles)")),
		mcp.WithString("variableId", mcp.Description("Variable ID (from get_variable_defs)")),
		mcp.WithString("description",
			mcp.Required(),
			mcp.Description("Description text to set. Pass empty string to clear."),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		params := map[string]interface{}{
			"description": args["description"],
		}
		if sid, ok := args["styleId"].(string); ok && sid != "" {
			params["styleId"] = sid
		}
		if vid, ok := args["variableId"].(string); ok && vid != "" {
			params["variableId"] = vid
		}
		if nid, ok := args["nodeId"].(string); ok && nid != "" {
			params["nodeId"] = NormalizeNodeID(nid)
		}
		resp, err := node.Send(ctx, "set_description", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("replace_colors",
		mcp.WithDescription("Recolour a whole subtree in one call: every SOLID fill/stroke matching a hex is rebound to a variable (preferred) or set to a new hex; matching gradient stops take the resolved colour. Opacity and stop alpha are kept. Run with dryRun=true first to list the colours in use. Instance internals are skipped unless includeInstances is true; edit main components instead."),
		mcp.WithString("nodeId",
			mcp.Required(),
			mcp.Description("Root node or page ID in colon format e.g. '0:1'"),
		),
		mcp.WithArray("mappings",
			mcp.Description("[{\"from\":\"#FF2D55\",\"variableId\":\"VariableID:1:2\"}, {\"from\":\"#FFFFFF\",\"color\":\"#F4F4F7\"}]; required unless dryRun"),
			mcp.Items(map[string]any{
				"type": "object",
				"properties": map[string]any{
					"from":       map[string]any{"type": "string", "description": "Hex #RRGGBB (any opacity) or #RRGGBBAA (only that opacity) to match"},
					"variableId": map[string]any{"type": "string", "description": "COLOR variable to bind"},
					"color":      map[string]any{"type": "string", "description": "Replacement hex #RRGGBB"},
					"gradient":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "2-4 hex colours: turns matching solids into a left-to-right linear gradient"},
				},
				"required": []string{"from"},
			}),
		),
		mcp.WithBoolean("dryRun", mcp.Description("Only report colour usage (hex, fill and stroke counts); change nothing")),
		mcp.WithBoolean("includeInstances", mcp.Description("Also recolour inside instances, creating overrides (default false)")),
		mcp.WithArray("nodeTypes", mcp.Description("Only recolour these node types, e.g. [\"TEXT\"]"), mcp.WithStringItems()),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		nodeID, _ := args["nodeId"].(string)
		params := map[string]interface{}{}
		if t, ok := args["nodeTypes"].([]interface{}); ok && len(t) > 0 {
			params["nodeTypes"] = t
		}
		if m, ok := args["mappings"].([]interface{}); ok && len(m) > 0 {
			params["mappings"] = m
		}
		for _, key := range []string{"dryRun", "includeInstances"} {
			if v, ok := args[key].(bool); ok {
				params[key] = v
			}
		}
		resp, err := node.Send(ctx, "replace_colors", []string{nodeID}, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("snap_to_tokens",
		mcp.WithDescription("Snap a subtree to the spacing and radius scale in one call: every auto-layout padding/itemSpacing is bound to the nearest spacing variable and every corner radius to the nearest radius variable (key 999 = full, used for pills). Skips text, vectors and instance internals. Run dryRun first to see the value changes."),
		mcp.WithString("nodeId",
			mcp.Required(),
			mcp.Description("Root node ID in colon format e.g. '90:19994'"),
		),
		mcp.WithObject("spacingVariables",
			mcp.Required(),
			mcp.Description("Map of pixel value to FLOAT variable ID, e.g. {\"4\":\"VariableID:1:4\",\"8\":\"VariableID:1:8\"}"),
		),
		mcp.WithObject("radiusVariables",
			mcp.Required(),
			mcp.Description("Map of pixel value to FLOAT variable ID; use key \"999\" for the full/pill radius"),
		),
		mcp.WithBoolean("dryRun", mcp.Description("Only report value changes (e.g. \"10→8\": 3); bind nothing")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		nodeID, _ := args["nodeId"].(string)
		params := map[string]interface{}{
			"spacingVariables": args["spacingVariables"],
			"radiusVariables":  args["radiusVariables"],
		}
		if v, ok := args["dryRun"].(bool); ok {
			params["dryRun"] = v
		}
		resp, err := node.Send(ctx, "snap_to_tokens", []string{nodeID}, params)
		return renderResponse(resp, err)
	})
}
