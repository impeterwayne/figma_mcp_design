package internal

import (
	"context"
	"fmt"
	"os"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func registerWriteCreateTools(s *server.MCPServer, node *Node) {
	s.AddTool(mcp.NewTool("create_frame",
		mcp.WithDescription("Create a frame. Token params take a name: reused if it or an equal-value token exists, else created from fillColor/cornerRadius/padding. Raw values get auto-named tokens unless link=false."),
		mcp.WithNumber("x", mcp.Description("X (default 0)")),
		mcp.WithNumber("y", mcp.Description("Y (default 0)")),
		mcp.WithNumber("width", mcp.Description("Width (default 100)")),
		mcp.WithNumber("height", mcp.Description("Height (default 100)")),
		mcp.WithString("name", mcp.Description("Frame name")),
		mcp.WithString("fillColor", mcp.Description("Fill hex e.g. #FFFFFF")),
		mcp.WithString("layoutMode", mcp.Description("HORIZONTAL, VERTICAL or NONE")),
		mcp.WithNumber("paddingTop", mcp.Description("Top padding")),
		mcp.WithNumber("paddingRight", mcp.Description("Right padding")),
		mcp.WithNumber("paddingBottom", mcp.Description("Bottom padding")),
		mcp.WithNumber("paddingLeft", mcp.Description("Left padding")),
		mcp.WithNumber("itemSpacing", mcp.Description("Gap between children")),
		mcp.WithString("primaryAxisAlignItems", mcp.Description("MIN, CENTER, MAX or SPACE_BETWEEN")),
		mcp.WithString("counterAxisAlignItems", mcp.Description("MIN, CENTER, MAX or BASELINE")),
		mcp.WithString("primaryAxisSizingMode", mcp.Description("FIXED or AUTO (hug)")),
		mcp.WithString("counterAxisSizingMode", mcp.Description("FIXED or AUTO (hug)")),
		mcp.WithString("layoutWrap", mcp.Description("NO_WRAP or WRAP")),
		mcp.WithNumber("counterAxisSpacing", mcp.Description("Gap between wrapped rows")),
		mcp.WithString("parentId", mcp.Description("Parent node ID; defaults to current page")),
		mcp.WithString("fillVariable", mcp.Description("COLOR variable name/ID, e.g. 'surface/1' (preferred)")),
		mcp.WithString("strokeVariable", mcp.Description("COLOR variable for a stroke")),
		mcp.WithString("strokeColor", mcp.Description("Hex to create strokeVariable")),
		mcp.WithNumber("cornerRadius", mcp.Description("Corner radius px")),
		mcp.WithBoolean("link", mcp.Description("Default true")),
		mcp.WithNumber("strokeWeight", mcp.Description("Stroke width (default 1)")),
		mcp.WithString("radiusVariable", mcp.Description("FLOAT variable for all corner radii")),
		mcp.WithString("paddingVariable", mcp.Description("FLOAT variable for all paddings")),
		mcp.WithString("gapVariable", mcp.Description("FLOAT variable for itemSpacing")),
		mcp.WithString("effectStyle", mcp.Description("Effect style name or ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		if msg := ValidateRPC("create_frame", nil, params); msg != "" {
			return mcp.NewToolResultError(msg), nil
		}
		resp, err := node.Send(ctx, "create_frame", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_rectangle",
		mcp.WithDescription("Create a rectangle. Token params work as in create_frame: reuse by name or value, else create from fillColor/cornerRadius."),
		mcp.WithNumber("x", mcp.Description("X position (default 0)")),
		mcp.WithNumber("y", mcp.Description("Y position (default 0)")),
		mcp.WithNumber("width", mcp.Description("Width in pixels (default 100)")),
		mcp.WithNumber("height", mcp.Description("Height in pixels (default 100)")),
		mcp.WithString("name", mcp.Description("Rectangle name")),
		mcp.WithString("fillColor", mcp.Description("Fill color as hex e.g. #FF5733")),
		mcp.WithNumber("cornerRadius", mcp.Description("Corner radius in pixels")),
		mcp.WithString("parentId", mcp.Description("Parent node ID in colon format. Defaults to current page.")),
		mcp.WithString("fillVariable", mcp.Description("COLOR variable name or ID for the fill, e.g. 'surface/1' (preferred over fillColor)")),
		mcp.WithString("strokeVariable", mcp.Description("COLOR variable for a stroke; strokeWeight sets its width")),
		mcp.WithString("strokeColor", mcp.Description("Hex used to create strokeVariable when missing")),
		mcp.WithBoolean("link", mcp.Description("Tokenise raw values (default true)")),
		mcp.WithNumber("strokeWeight", mcp.Description("Stroke width with strokeVariable (default 1)")),
		mcp.WithString("radiusVariable", mcp.Description("FLOAT variable bound to all four corner radii")),
		mcp.WithString("effectStyle", mcp.Description("Effect style name or ID")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		if msg := ValidateRPC("create_rectangle", nil, params); msg != "" {
			return mcp.NewToolResultError(msg), nil
		}
		resp, err := node.Send(ctx, "create_rectangle", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_ellipse",
		mcp.WithDescription("Create a new ellipse (circle/oval) on the current page or inside a parent node."),
		mcp.WithNumber("x", mcp.Description("X position (default 0)")),
		mcp.WithNumber("y", mcp.Description("Y position (default 0)")),
		mcp.WithNumber("width", mcp.Description("Width in pixels (default 100)")),
		mcp.WithNumber("height", mcp.Description("Height in pixels (default 100)")),
		mcp.WithString("name", mcp.Description("Ellipse name")),
		mcp.WithString("fillColor", mcp.Description("Fill color as hex e.g. #3B82F6")),
		mcp.WithString("parentId", mcp.Description("Parent node ID in colon format. Defaults to current page.")),
		mcp.WithString("fillVariable", mcp.Description("COLOR variable name or ID for the fill, e.g. 'surface/1' (preferred over fillColor)")),
		mcp.WithString("effectStyle", mcp.Description("Effect style name or ID")),
		mcp.WithBoolean("link", mcp.Description("Tokenise raw values (default true)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		if msg := ValidateRPC("create_ellipse", nil, params); msg != "" {
			return mcp.NewToolResultError(msg), nil
		}
		resp, err := node.Send(ctx, "create_ellipse", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_text",
		mcp.WithDescription("Create a text node linked to the design system: textStyle is reused by name, or by matching font, or created from fontFamily/fontStyle/fontSize; fillVariable likewise from fillColor. Plain font params are saved as an auto-named style (Text/<font> <size>) unless link=false. Use set_text to change existing text."),
		mcp.WithString("text",
			mcp.Required(),
			mcp.Description("Text content to display"),
		),
		mcp.WithNumber("x", mcp.Description("X position in pixels (default 0)")),
		mcp.WithNumber("y", mcp.Description("Y position in pixels (default 0)")),
		mcp.WithNumber("fontSize", mcp.Description("Font size in pixels (default 14)")),
		mcp.WithString("fontFamily", mcp.Description("Font family name e.g. 'Inter', 'Roboto', 'SF Pro Display' (default Inter). Must be a font installed in Figma.")),
		mcp.WithString("fontStyle", mcp.Description("Font style variant e.g. 'Regular', 'Bold', 'Italic', 'Medium', 'SemiBold' (default Regular). Must match an available style for the chosen fontFamily.")),
		mcp.WithString("fillColor", mcp.Description("Text color as hex e.g. #000000 (default black)")),
		mcp.WithString("name", mcp.Description("Node name shown in the layers panel (defaults to the text content)")),
		mcp.WithString("parentId", mcp.Description("Parent node ID in colon format. Defaults to current page.")),
		mcp.WithString("textStyle", mcp.Description("Text style name or ID, e.g. 'Type/Title'")),
		mcp.WithString("fillVariable", mcp.Description("COLOR variable name or ID for the text colour, e.g. 'text/primary'")),
		mcp.WithBoolean("link", mcp.Description("Tokenise raw values (default true)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := req.GetArguments()
		if msg := ValidateRPC("create_text", nil, params); msg != "" {
			return mcp.NewToolResultError(msg), nil
		}
		resp, err := node.Send(ctx, "create_text", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("import_image",
		mcp.WithDescription("Import a base64-encoded image into Figma as a rectangle with an image fill. Use get_screenshot to capture images or provide your own base64 PNG/JPG."),
		mcp.WithString("imageData",
			mcp.Required(),
			mcp.Description("Base64-encoded image data (PNG or JPG)"),
		),
		mcp.WithNumber("x", mcp.Description("X position (default 0)")),
		mcp.WithNumber("y", mcp.Description("Y position (default 0)")),
		mcp.WithNumber("width", mcp.Description("Width in pixels (default 200)")),
		mcp.WithNumber("height", mcp.Description("Height in pixels (default 200)")),
		mcp.WithString("name", mcp.Description("Node name")),
		mcp.WithString("scaleMode", mcp.Description("Image scale mode: FILL (default), FIT, CROP, or TILE")),
		mcp.WithString("parentId", mcp.Description("Parent node ID in colon format. Defaults to current page.")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := map[string]interface{}{
			"imageData": req.GetArguments()["imageData"],
		}
		if x, ok := req.GetArguments()["x"].(float64); ok {
			params["x"] = x
		}
		if y, ok := req.GetArguments()["y"].(float64); ok {
			params["y"] = y
		}
		if w, ok := req.GetArguments()["width"].(float64); ok {
			params["width"] = w
		}
		if h, ok := req.GetArguments()["height"].(float64); ok {
			params["height"] = h
		}
		if n, ok := req.GetArguments()["name"].(string); ok && n != "" {
			params["name"] = n
		}
		if sm, ok := req.GetArguments()["scaleMode"].(string); ok && sm != "" {
			params["scaleMode"] = sm
		}
		if pid, ok := req.GetArguments()["parentId"].(string); ok && pid != "" {
			params["parentId"] = pid
		}
		resp, err := node.Send(ctx, "import_image", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_svg",
		mcp.WithDescription("Insert SVG markup (icon, logo, illustration) as editable vectors. Pass svg, or path to a .svg file in the working directory (cheaper: the markup never passes through you). Scripts and external links are stripped. width/height scale it keeping aspect ratio. colorVariable (token name, get-or-create with color as its value) recolours every visible fill and stroke; a raw color is tokenised unless link is false."),
		mcp.WithString("svg", mcp.Description("SVG markup containing an <svg> element (max 500 KB)")),
		mcp.WithString("path", mcp.Description(".svg file path, relative to the working directory or absolute inside it")),
		mcp.WithString("parentId", mcp.Required(), mcp.Description("Parent node ID in colon format; use a page ID for top level")),
		mcp.WithNumber("x", mcp.Description("X position (default 0)")),
		mcp.WithNumber("y", mcp.Description("Y position (default 0)")),
		mcp.WithNumber("width", mcp.Description("Target width; height follows the aspect ratio")),
		mcp.WithNumber("height", mcp.Description("Target height; with width too, the SVG fits inside that box")),
		mcp.WithString("name", mcp.Description("Node name")),
		mcp.WithString("colorVariable", mcp.Description("COLOR token name or ID for every visible fill and stroke, e.g. icon/primary")),
		mcp.WithString("colorVariableId", mcp.Description("COLOR variable ID (must exist)")),
		mcp.WithString("color", mcp.Description("Hex #RRGGBB; the value for colorVariable if it must be created")),
		mcp.WithBoolean("link", mcp.Description("false keeps a raw color unlinked (default true)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		svg, _ := args["svg"].(string)
		path, _ := args["path"].(string)
		if (svg == "") == (path == "") {
			return mcp.NewToolResultError("pass exactly one of svg or path"), nil
		}
		if path != "" {
			workDir, err := os.Getwd()
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("cannot determine working directory: %v", err)), nil
			}
			if svg, err = readSVGFile(path, workDir); err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
		}
		params := map[string]interface{}{"svg": cleanSVG(svg)}
		for _, key := range []string{"parentId", "name", "colorVariable", "colorVariableId", "color"} {
			if v, ok := args[key].(string); ok && v != "" {
				params[key] = v
			}
		}
		if link, ok := args["link"].(bool); ok {
			params["link"] = link
		}
		for _, key := range []string{"x", "y", "width", "height"} {
			if v, ok := args[key].(float64); ok {
				params[key] = v
			}
		}
		if pid, ok := params["parentId"].(string); ok {
			params["parentId"] = NormalizeNodeID(pid)
		}
		if msg := ValidateRPC("create_svg", nil, params); msg != "" {
			return mcp.NewToolResultError(msg), nil
		}
		resp, err := node.Send(ctx, "create_svg", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_component",
		mcp.WithDescription("Convert an existing FRAME node into a reusable COMPONENT. The frame is replaced in place by the new component."),
		mcp.WithString("nodeId",
			mcp.Required(),
			mcp.Description("FRAME node ID to convert, in colon format e.g. '4029:12345'"),
		),
		mcp.WithString("name", mcp.Description("Optional name for the component. Defaults to the frame's current name.")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		nodeID, _ := req.GetArguments()["nodeId"].(string)
		nodeID = NormalizeNodeID(nodeID)
		params := map[string]interface{}{}
		if name, ok := req.GetArguments()["name"].(string); ok && name != "" {
			params["name"] = name
		}
		resp, err := node.Send(ctx, "create_component", []string{nodeID}, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("create_section",
		mcp.WithDescription("Create a Figma Section node on the current page. Sections are the modern way to organize frames and groups on a page."),
		mcp.WithString("name", mcp.Description("Section name (default 'Section')")),
		mcp.WithNumber("x", mcp.Description("X position (default 0)")),
		mcp.WithNumber("y", mcp.Description("Y position (default 0)")),
		mcp.WithNumber("width", mcp.Description("Width in pixels")),
		mcp.WithNumber("height", mcp.Description("Height in pixels")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := map[string]interface{}{}
		if name, ok := req.GetArguments()["name"].(string); ok && name != "" {
			params["name"] = name
		}
		if x, ok := req.GetArguments()["x"].(float64); ok {
			params["x"] = x
		}
		if y, ok := req.GetArguments()["y"].(float64); ok {
			params["y"] = y
		}
		if w, ok := req.GetArguments()["width"].(float64); ok {
			params["width"] = w
		}
		if h, ok := req.GetArguments()["height"].(float64); ok {
			params["height"] = h
		}
		resp, err := node.Send(ctx, "create_section", nil, params)
		return renderResponse(resp, err)
	})
}
