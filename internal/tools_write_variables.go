package internal

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func registerWriteVariableTools(s *server.MCPServer, node *Node) {
	s.AddTool(mcp.NewTool("create_variable_collection",
		mcp.WithDescription("Create a new local variable collection with an optional initial mode name. "+
			"NOTE — Figma free plan limits each collection to 1 mode. If you need Light/Dark (or any multi-mode) "+
			"theming and the user is on the free plan, do NOT try to call add_variable_mode; instead use the "+
			"name-prefix workaround: create all variables in a single collection and prefix each variable name "+
			"with its mode, e.g. 'light/color-bg' and 'dark/color-bg'. Inform the user of this limitation."),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Collection name"),
		),
		mcp.WithString("initialModeName", mcp.Description("Name for the initial mode (default 'Mode 1')")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "create_variable_collection", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("add_variable_mode",
		mcp.WithDescription("Add a new mode to an existing variable collection (e.g. Light/Dark, Desktop/Mobile). "+
			"IMPORTANT — Figma free plan only allows 1 mode per collection; calling this tool on a free-plan "+
			"account will return the error 'Limited to 1 modes only'. If that error occurs, stop retrying and "+
			"switch to the name-prefix workaround: keep the single default mode and create variables prefixed "+
			"by mode, e.g. 'light/color-bg' and 'dark/color-bg' in the same collection. Tell the user that "+
			"native multi-mode variables require a paid Figma plan (Professional or above)."),
		mcp.WithString("collectionId",
			mcp.Required(),
			mcp.Description("Variable collection ID"),
		),
		mcp.WithString("modeName",
			mcp.Required(),
			mcp.Description("Name for the new mode"),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "add_variable_mode", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_variable",
		mcp.WithDescription("Create a new variable (design token) inside an existing collection. Returns the new variable's ID. Use get_variable_defs to find collection IDs, set_variable_value to set values per mode, and bind_variable_to_node to apply the variable to a node property."),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Variable name — use slash notation to group e.g. 'Color/Primary', 'Spacing/MD'"),
		),
		mcp.WithString("collectionId",
			mcp.Required(),
			mcp.Description("ID of the variable collection to add this variable to (from get_variable_defs)"),
		),
		mcp.WithString("type",
			mcp.Required(),
			mcp.Description("Variable type: COLOR (hex color), FLOAT (numeric dimension/spacing), STRING (text), or BOOLEAN (true/false toggle)"),
		),
		mcp.WithString("value", mcp.Description("Initial value for the first mode. COLOR: hex e.g. #FF5733. FLOAT: number e.g. 16. STRING: text. BOOLEAN: true or false.")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "create_variable", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("set_variable_value",
		mcp.WithDescription("Set a variable's value for a specific mode."),
		mcp.WithString("variableId",
			mcp.Required(),
			mcp.Description("Variable ID"),
		),
		mcp.WithString("modeId",
			mcp.Required(),
			mcp.Description("Mode ID within the collection"),
		),
		mcp.WithString("value",
			mcp.Required(),
			mcp.Description("Value to set. COLOR: hex e.g. #FF5733. FLOAT: number e.g. 16. STRING: text. BOOLEAN: true or false."),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "set_variable_value", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("delete_variable",
		mcp.WithDescription("Delete a single variable (provide variableId) or an entire collection and all its variables (provide collectionId). Provide exactly one of the two — not both."),
		mcp.WithString("variableId", mcp.Description("Variable ID to delete")),
		mcp.WithString("collectionId", mcp.Description("Collection ID to delete (removes all variables in the collection)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "delete_variable", nil, params)
		return renderResponse(resp, err)
	})
	s.AddTool(mcp.NewTool("rename_variable",
		mcp.WithDescription("Rename a variable in place, preserving all node bindings and variable aliases. "+
			"Use slash notation for group hierarchies (e.g. 'Color/Brand/Primary'). "+
			"WARNING: renaming a variable that uses slash-notation may move it to a different group in the variables panel."),
		mcp.WithString("variableId",
			mcp.Required(),
			mcp.Description("Variable ID to rename (from get_variable_defs)"),
		),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("New variable name — use slash notation to group e.g. 'Color/Brand/Primary'"),
		),
		mcp.WithString("description", mcp.Description("Optional new description for the variable")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "rename_variable", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("rename_mode",
		mcp.WithDescription("Rename a mode within a variable collection (e.g. rename 'Mode 1' to 'Light')."),
		mcp.WithString("collectionId",
			mcp.Required(),
			mcp.Description("Variable collection ID"),
		),
		mcp.WithString("modeId",
			mcp.Required(),
			mcp.Description("Mode ID to rename (from get_variable_defs, in the modes array)"),
		),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("New mode name"),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "rename_mode", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("rename_variable_collection",
		mcp.WithDescription("Rename a variable collection. All variables in the collection remain intact."),
		mcp.WithString("collectionId",
			mcp.Required(),
			mcp.Description("Variable collection ID (from get_variable_defs)"),
		),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("New collection name"),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "rename_variable_collection", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("batch_rename_variables",
		mcp.WithDescription("Rename up to 100 variables in a single operation. All renames are applied in one WebSocket "+
			"round-trip with a single undo step, making this 10-50x faster than calling rename_variable repeatedly. "+
			"Partial failures are reported per-item — the operation does NOT abort on individual errors."),
		mcp.WithArray("renames",
			mcp.Required(),
			mcp.Description("Array of rename objects. Each must have: variableId (string, required), name (string, required), description (string, optional). Maximum 100 items."),
			mcp.Items(map[string]any{"type": "object"}),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		resp, err := node.Send(ctx, "batch_rename_variables", nil, params)
		return renderResponse(resp, err)
	})
}
