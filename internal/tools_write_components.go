package internal

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func registerWriteComponentTools(s *server.MCPServer, node *Node) {
	s.AddTool(mcp.NewTool("navigate_to_page",
		mcp.WithDescription("Switch the active Figma page. Provide either pageId or pageName."),
		mcp.WithString("pageId", mcp.Description("Page node ID in colon format e.g. '0:1'")),
		mcp.WithString("pageName", mcp.Description("Exact page name to navigate to")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := map[string]interface{}{}
		if id, ok := req.GetArguments()["pageId"].(string); ok && id != "" {
			params["pageId"] = id
		}
		if name, ok := req.GetArguments()["pageName"].(string); ok && name != "" {
			params["pageName"] = name
		}
		resp, err := node.Send(ctx, "navigate_to_page", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("group_nodes",
		mcp.WithDescription("Group two or more nodes into a GROUP. All nodes must share the same parent."),
		mcp.WithArray("nodeIds",
			mcp.Required(),
			mcp.Description("Node IDs to group (minimum 2), in colon format e.g. ['4029:12345', '4029:12346']"),
			mcp.WithStringItems(),
		),
		mcp.WithString("name", mcp.Description("Optional name for the new group")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		raw, _ := req.GetArguments()["nodeIds"].([]interface{})
		nodeIDs := toStringSlice(raw)
		params := map[string]interface{}{}
		if name, ok := req.GetArguments()["name"].(string); ok && name != "" {
			params["name"] = name
		}
		resp, err := node.Send(ctx, "group_nodes", nodeIDs, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("ungroup_nodes",
		mcp.WithDescription("Ungroup one or more GROUP nodes, moving their children to the parent and removing the group."),
		mcp.WithArray("nodeIds",
			mcp.Required(),
			mcp.Description("GROUP node IDs in colon format e.g. ['4029:12345']"),
			mcp.WithStringItems(),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		raw, _ := req.GetArguments()["nodeIds"].([]interface{})
		nodeIDs := toStringSlice(raw)
		resp, err := node.Send(ctx, "ungroup_nodes", nodeIDs, nil)
		return renderResponse(resp, err)
	})


	s.AddTool(mcp.NewTool("swap_component",
		mcp.WithDescription("Swap the main component of an existing INSTANCE node, replacing it with a different component while keeping position and size."),
		mcp.WithString("nodeId",
			mcp.Required(),
			mcp.Description("INSTANCE node ID in colon format e.g. 4029:12345"),
		),
		mcp.WithString("componentId",
			mcp.Required(),
			mcp.Description("Target COMPONENT node ID in colon format (from get_local_components)"),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		nodeID, _ := args["nodeId"].(string)
		nodeID = NormalizeNodeID(nodeID)
		componentID, _ := args["componentId"].(string)
		componentID = NormalizeNodeID(componentID)
		params := map[string]interface{}{"componentId": componentID}
		resp, err := node.Send(ctx, "swap_component", []string{nodeID}, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("detach_instance",
		mcp.WithDescription("Detach one or more component instances, converting them to plain frames. The link to the main component is broken; all visual properties are preserved."),
		mcp.WithArray("nodeIds",
			mcp.Required(),
			mcp.Description("INSTANCE node IDs in colon format e.g. ['4029:12345']"),
			mcp.WithStringItems(),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		raw, _ := req.GetArguments()["nodeIds"].([]interface{})
		nodeIDs := toStringSlice(raw)
		for i, id := range nodeIDs {
			nodeIDs[i] = NormalizeNodeID(id)
		}
		resp, err := node.Send(ctx, "detach_instance", nodeIDs, nil)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_instance",
		mcp.WithDescription("Create an instance of a local COMPONENT (or the default variant of a COMPONENT_SET) inside a parent, optionally setting its properties. Build screens from instances instead of redrawing shapes. Get IDs from get_local_components."),
		mcp.WithString("componentId",
			mcp.Required(),
			mcp.Description("COMPONENT or COMPONENT_SET node ID in colon format e.g. 4029:12345"),
		),
		mcp.WithString("parentId", mcp.Description("Parent frame ID in colon format; defaults to the current page. Always pass it when building inside a layout.")),
		mcp.WithNumber("x", mcp.Description("X position (ignored inside auto-layout parents)")),
		mcp.WithNumber("y", mcp.Description("Y position (ignored inside auto-layout parents)")),
		mcp.WithString("name", mcp.Description("Optional layer name for the instance")),
		mcp.WithObject("properties", mcp.Description("Component properties by display name, e.g. {\"Size\":\"Large\",\"Label\":\"Continue\",\"Show icon\":true}. Variant values are strings, booleans for BOOLEAN props, text for TEXT props.")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		componentID, _ := args["componentId"].(string)
		params := map[string]interface{}{"componentId": NormalizeNodeID(componentID)}
		if pid, ok := args["parentId"].(string); ok && pid != "" {
			params["parentId"] = pid
		}
		for _, key := range []string{"x", "y"} {
			if v, ok := args[key].(float64); ok {
				params[key] = v
			}
		}
		if name, ok := args["name"].(string); ok && name != "" {
			params["name"] = name
		}
		if props, ok := args["properties"].(map[string]interface{}); ok && len(props) > 0 {
			params["properties"] = props
		}
		resp, err := node.Send(ctx, "create_instance", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("set_instance_properties",
		mcp.WithDescription("Set variant, boolean, and text properties on a component INSTANCE by display name (e.g. 'Size', 'Label'). The error message lists available property names if one is wrong."),
		mcp.WithString("nodeId",
			mcp.Required(),
			mcp.Description("INSTANCE node ID in colon format e.g. 4029:12345"),
		),
		mcp.WithObject("properties",
			mcp.Required(),
			mcp.Description("e.g. {\"Size\":\"Small\",\"State\":\"Disabled\",\"Show icon\":false,\"Label\":\"Save\"}"),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		nodeID, _ := args["nodeId"].(string)
		props, _ := args["properties"].(map[string]interface{})
		resp, err := node.Send(ctx, "set_instance_properties", []string{nodeID}, map[string]interface{}{"properties": props})
		return renderResponse(resp, err)
	})
}
