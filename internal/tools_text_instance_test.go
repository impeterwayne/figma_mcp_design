package internal

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/mark3labs/mcp-go/server"
)

// newCapturingServer registers all tools against a follower Node whose leader is
// a stub that records the forwarded RPC request.
func newCapturingServer(t *testing.T) (*server.MCPServer, *RPCRequest) {
	t.Helper()
	captured := &RPCRequest{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(captured) //nolint:errcheck
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(RPCResponse{Data: "ok"}) //nolint:errcheck
	}))
	t.Cleanup(srv.Close)
	node := &Node{role: RoleFollower, follower: NewFollower(srv.URL)}
	s := server.NewMCPServer("test", "0.0.1")
	RegisterTools(s, node)
	return s, captured
}

// ── Forwarding ───────────────────────────────────────────────────────────────

func TestSetTextProperties_Forwards(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "set_text_properties", map[string]any{
		"nodeIds":    []string{"1:1", "2-2"},
		"fontFamily": "Inter",
		"fontStyle":  "Bold",
		"fontSize":   24,
		"lineHeight": "150%",
		"textCase":   "UPPER",
	})
	if got.Tool != "set_text_properties" {
		t.Fatalf("tool = %q", got.Tool)
	}
	if !reflect.DeepEqual(got.NodeIDs, []string{"1:1", "2:2"}) {
		t.Errorf("nodeIDs = %v", got.NodeIDs)
	}
	want := map[string]any{"fontFamily": "Inter", "fontStyle": "Bold", "fontSize": float64(24), "lineHeight": "150%", "textCase": "UPPER"}
	if !reflect.DeepEqual(got.Params, want) {
		t.Errorf("params = %v, want %v", got.Params, want)
	}
}

func TestSetTextProperties_NumericLineHeight(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "set_text_properties", map[string]any{"nodeIds": []string{"1:1"}, "lineHeight": 24, "letterSpacing": -0.5})
	if got.Params["lineHeight"] != float64(24) || got.Params["letterSpacing"] != -0.5 {
		t.Errorf("params = %v", got.Params)
	}
}

func TestSetText_ItemsForwarded(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "set_text", map[string]any{
		"items": []map[string]any{{"nodeId": "1-1", "text": "A"}, {"nodeId": "2:2", "text": "B"}},
	})
	items, _ := got.Params["items"].([]any)
	if got.Tool != "set_text" || len(items) != 2 {
		t.Fatalf("tool=%q params=%v", got.Tool, got.Params)
	}
	first, _ := items[0].(map[string]any)
	if first["nodeId"] != "1:1" || first["text"] != "A" {
		t.Errorf("first item = %v, want normalized nodeId 1:1", first)
	}
}

func TestSetImageFill_Forwards(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "set_image_fill", map[string]any{"nodeIds": []string{"1:1"}, "imageData": "abc", "scaleMode": "FIT"})
	want := map[string]any{"imageData": "abc", "scaleMode": "FIT"}
	if got.Tool != "set_image_fill" || !reflect.DeepEqual(got.Params, want) {
		t.Errorf("tool=%q params=%v", got.Tool, got.Params)
	}
}

func TestCreateInstance_Forwards(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "create_instance", map[string]any{
		"componentId": "10-1", "parentId": "5:5", "x": 8, "y": 16, "name": "CTA",
		"properties": map[string]any{"Size": "Large", "Label": "Go"},
	})
	want := map[string]any{
		"componentId": "10:1", "parentId": "5:5", "x": float64(8), "y": float64(16), "name": "CTA",
		"properties": map[string]any{"Size": "Large", "Label": "Go"},
	}
	if got.Tool != "create_instance" || !reflect.DeepEqual(got.Params, want) {
		t.Errorf("tool=%q params=%v", got.Tool, got.Params)
	}
}

func TestSetInstanceProperties_Forwards(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "set_instance_properties", map[string]any{"nodeId": "3:3", "properties": map[string]any{"Show icon": true}})
	if got.Tool != "set_instance_properties" || !reflect.DeepEqual(got.NodeIDs, []string{"3:3"}) {
		t.Fatalf("tool=%q nodeIDs=%v", got.Tool, got.NodeIDs)
	}
	if !reflect.DeepEqual(got.Params, map[string]any{"properties": map[string]any{"Show icon": true}}) {
		t.Errorf("params = %v", got.Params)
	}
}

// ── Validation ───────────────────────────────────────────────────────────────

func TestValidateRPC_SetTextProperties(t *testing.T) {
	ok := map[string]any{"fontSize": float64(12)}
	if msg := ValidateRPC("set_text_properties", nil, ok); msg == "" {
		t.Error("expected error for missing nodeIds")
	}
	if msg := ValidateRPC("set_text_properties", []string{"1:1"}, map[string]any{}); msg == "" {
		t.Error("expected error when no property is given")
	}
	if msg := ValidateRPC("set_text_properties", []string{"1:1"}, map[string]any{"textCase": "SHOUT"}); msg == "" {
		t.Error("expected error for invalid textCase")
	}
	if msg := ValidateRPC("set_text_properties", []string{"1:1"}, map[string]any{"textAlignHorizontal": "MIDDLE"}); msg == "" {
		t.Error("expected error for invalid textAlignHorizontal")
	}
	if msg := ValidateRPC("set_text_properties", []string{"1:1"}, ok); msg != "" {
		t.Errorf("unexpected error: %s", msg)
	}
}

func TestValidateRPC_SetTextItems(t *testing.T) {
	items := []any{map[string]any{"nodeId": "1:1", "text": "A"}}
	if msg := ValidateRPC("set_text", nil, map[string]any{"items": items}); msg != "" {
		t.Errorf("unexpected error: %s", msg)
	}
	bad := []any{map[string]any{"nodeId": "bad", "text": "A"}}
	if msg := ValidateRPC("set_text", nil, map[string]any{"items": bad}); msg == "" {
		t.Error("expected error for invalid item nodeId")
	}
	noText := []any{map[string]any{"nodeId": "1:1"}}
	if msg := ValidateRPC("set_text", nil, map[string]any{"items": noText}); msg == "" {
		t.Error("expected error for item without text")
	}
}

func TestValidateRPC_SetImageFill(t *testing.T) {
	if msg := ValidateRPC("set_image_fill", []string{"1:1"}, map[string]any{}); msg == "" {
		t.Error("expected error for missing imageData")
	}
	if msg := ValidateRPC("set_image_fill", []string{"1:1"}, map[string]any{"imageData": "a", "scaleMode": "ZOOM"}); msg == "" {
		t.Error("expected error for invalid scaleMode")
	}
	if msg := ValidateRPC("set_image_fill", nil, map[string]any{"imageData": "a"}); msg == "" {
		t.Error("expected error for missing nodeIds")
	}
	if msg := ValidateRPC("set_image_fill", []string{"1:1"}, map[string]any{"imageData": "a"}); msg != "" {
		t.Errorf("unexpected error: %s", msg)
	}
}

func TestValidateRPC_CreateInstance(t *testing.T) {
	if msg := ValidateRPC("create_instance", nil, map[string]any{}); msg == "" {
		t.Error("expected error for missing componentId")
	}
	if msg := ValidateRPC("create_instance", nil, map[string]any{"componentId": "1:1", "parentId": "x"}); msg == "" {
		t.Error("expected error for invalid parentId")
	}
	if msg := ValidateRPC("create_instance", nil, map[string]any{"componentId": "1:1"}); msg != "" {
		t.Errorf("unexpected error: %s", msg)
	}
}

func TestValidateRPC_SetInstanceProperties(t *testing.T) {
	props := map[string]any{"properties": map[string]any{"Size": "Small"}}
	if msg := ValidateRPC("set_instance_properties", nil, props); msg == "" {
		t.Error("expected error for missing nodeId")
	}
	if msg := ValidateRPC("set_instance_properties", []string{"1:1"}, map[string]any{}); msg == "" {
		t.Error("expected error for missing properties")
	}
	if msg := ValidateRPC("set_instance_properties", []string{"1:1"}, props); msg != "" {
		t.Errorf("unexpected error: %s", msg)
	}
}

func TestSetText_MissingTextNotForwarded(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "set_text", map[string]any{"nodeId": "1:1"})
	if got.Tool != "" {
		t.Errorf("set_text without text must not reach the plugin, forwarded %q with %v", got.Tool, got.Params)
	}
}

func TestReplaceColors_Forwards(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "replace_colors", map[string]any{
		"nodeId":   "0-1",
		"mappings": []map[string]any{{"from": "#FF2D55", "variableId": "VariableID:1:1"}},
	})
	if got.Tool != "replace_colors" || !reflect.DeepEqual(got.NodeIDs, []string{"0:1"}) {
		t.Fatalf("tool=%q nodeIDs=%v", got.Tool, got.NodeIDs)
	}
	if m, _ := got.Params["mappings"].([]any); len(m) != 1 {
		t.Errorf("params = %v", got.Params)
	}
}

func TestReplaceColors_DryRunForwards(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "replace_colors", map[string]any{"nodeId": "0:1", "dryRun": true, "includeInstances": true})
	if got.Params["dryRun"] != true || got.Params["includeInstances"] != true {
		t.Errorf("params = %v", got.Params)
	}
}

func TestValidateRPC_ReplaceColors(t *testing.T) {
	good := []any{map[string]any{"from": "#FF2D55", "color": "#000000"}}
	if msg := ValidateRPC("replace_colors", nil, map[string]any{"mappings": good}); msg == "" {
		t.Error("expected error for missing nodeId")
	}
	if msg := ValidateRPC("replace_colors", []string{"0:1"}, map[string]any{}); msg == "" {
		t.Error("expected error for missing mappings without dryRun")
	}
	if msg := ValidateRPC("replace_colors", []string{"0:1"}, map[string]any{"dryRun": true}); msg != "" {
		t.Errorf("dryRun should not need mappings: %s", msg)
	}
	bad := []any{map[string]any{"from": "red", "color": "#000000"}}
	if msg := ValidateRPC("replace_colors", []string{"0:1"}, map[string]any{"mappings": bad}); msg == "" {
		t.Error("expected error for non-hex from")
	}
	noTarget := []any{map[string]any{"from": "#FF2D55"}}
	if msg := ValidateRPC("replace_colors", []string{"0:1"}, map[string]any{"mappings": noTarget}); msg == "" {
		t.Error("expected error for mapping without variableId or color")
	}
	if msg := ValidateRPC("replace_colors", []string{"0:1"}, map[string]any{"mappings": good}); msg != "" {
		t.Errorf("unexpected error: %s", msg)
	}
}

func TestSnapToTokens_Forwards(t *testing.T) {
	s, got := newCapturingServer(t)
	callTool(t, s, "snap_to_tokens", map[string]any{
		"nodeId":           "90-1",
		"spacingVariables": map[string]any{"8": "VariableID:1:8"},
		"radiusVariables":  map[string]any{"12": "VariableID:1:12"},
		"dryRun":           true,
	})
	if got.Tool != "snap_to_tokens" || !reflect.DeepEqual(got.NodeIDs, []string{"90:1"}) {
		t.Fatalf("tool=%q nodeIDs=%v", got.Tool, got.NodeIDs)
	}
	if got.Params["dryRun"] != true || got.Params["spacingVariables"] == nil || got.Params["radiusVariables"] == nil {
		t.Errorf("params = %v", got.Params)
	}
}

func TestValidateRPC_SnapToTokens(t *testing.T) {
	ok := map[string]any{"spacingVariables": map[string]any{"8": "V:1"}, "radiusVariables": map[string]any{"8": "V:2"}}
	if msg := ValidateRPC("snap_to_tokens", nil, ok); msg == "" {
		t.Error("expected error for missing nodeId")
	}
	if msg := ValidateRPC("snap_to_tokens", []string{"0:1"}, map[string]any{"spacingVariables": map[string]any{"8": "V:1"}}); msg == "" {
		t.Error("expected error for missing radiusVariables")
	}
	bad := map[string]any{"spacingVariables": map[string]any{"eight": "V:1"}, "radiusVariables": map[string]any{"8": "V:2"}}
	if msg := ValidateRPC("snap_to_tokens", []string{"0:1"}, bad); msg == "" {
		t.Error("expected error for non-numeric key")
	}
	if msg := ValidateRPC("snap_to_tokens", []string{"0:1"}, ok); msg != "" {
		t.Errorf("unexpected error: %s", msg)
	}
}

func TestValidateRPC_ReplaceColorsGradient(t *testing.T) {
	ok := []any{map[string]any{"from": "#6C47FF", "gradient": []any{"#6C47FF", "#FF4F93"}}}
	if msg := ValidateRPC("replace_colors", []string{"0:1"}, map[string]any{"mappings": ok}); msg != "" {
		t.Errorf("unexpected error: %s", msg)
	}
	one := []any{map[string]any{"from": "#6C47FF", "gradient": []any{"#6C47FF"}}}
	if msg := ValidateRPC("replace_colors", []string{"0:1"}, map[string]any{"mappings": one}); msg == "" {
		t.Error("expected error for single-colour gradient")
	}
	bad := []any{map[string]any{"from": "#6C47FF", "gradient": []any{"#6C47FF", "pink"}}}
	if msg := ValidateRPC("replace_colors", []string{"0:1"}, map[string]any{"mappings": bad}); msg == "" {
		t.Error("expected error for non-hex gradient stop")
	}
}
