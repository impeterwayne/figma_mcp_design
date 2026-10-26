package internal

import (
	"context"
	"encoding/json"
	"sort"
	"testing"

	"github.com/mark3labs/mcp-go/server"
)

func toolNamesForProfile(t *testing.T, profile string) []string {
	t.Helper()
	s := server.NewMCPServer("test", "0.0.1")
	RegisterTools(s, NewNode("127.0.0.1", 19940, "test"))
	if err := ApplyProfile(s, profile); err != nil {
		t.Fatalf("ApplyProfile(%q): %v", profile, err)
	}
	raw := s.HandleMessage(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`))
	b, _ := json.Marshal(raw)
	var resp toolsListResponse
	if err := json.Unmarshal(b, &resp); err != nil {
		t.Fatal(err)
	}
	names := make([]string, 0, len(resp.Result.Tools))
	for _, tool := range resp.Result.Tools {
		names = append(names, tool.Name)
	}
	sort.Strings(names)
	return names
}

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}

func TestApplyProfile_FullKeepsEverything(t *testing.T) {
	if got := len(toolNamesForProfile(t, "full")); got != 89 {
		t.Errorf("full profile has %d tools, want 89", got)
	}
	if got := len(toolNamesForProfile(t, "")); got != 89 {
		t.Errorf("empty profile has %d tools, want 89 (defaults to full)", got)
	}
}

func TestApplyProfile_ReadIsReadOnly(t *testing.T) {
	names := toolNamesForProfile(t, "read")
	for _, want := range []string{"get_design_context", "get_selection", "get_screenshot", "save_screenshots", "get_variable_defs", "search_nodes"} {
		if !contains(names, want) {
			t.Errorf("read profile missing %s", want)
		}
	}
	for _, banned := range []string{"create_frame", "set_fills", "delete_nodes", "set_text", "create_instance"} {
		if contains(names, banned) {
			t.Errorf("read profile must not expose write tool %s", banned)
		}
	}
	if len(names) > 25 {
		t.Errorf("read profile has %d tools, want <= 25", len(names))
	}
}

func TestApplyProfile_DesignDropsRareTools(t *testing.T) {
	names := toolNamesForProfile(t, "design")
	for _, want := range []string{"create_frame", "set_auto_layout", "create_instance", "set_instance_properties", "set_text_properties", "set_image_fill", "replace_colors", "snap_to_tokens", "bind_variable_to_node", "get_design_context", "get_screenshot"} {
		if !contains(names, want) {
			t.Errorf("design profile missing %s", want)
		}
	}
	for _, dropped := range []string{"set_reactions", "remove_reactions", "export_frames_to_pdf", "get_document", "create_grid_style", "batch_rename_variables"} {
		if contains(names, dropped) {
			t.Errorf("design profile should drop %s", dropped)
		}
	}
	if len(names) >= 89 || len(names) < 50 {
		t.Errorf("design profile has %d tools, want 50..84", len(names))
	}
}

func TestApplyProfile_ProfileListsOnlyRegisteredTools(t *testing.T) {
	all := toolNamesForProfile(t, "full")
	for _, name := range readProfileTools {
		if !contains(all, name) {
			t.Errorf("readProfileTools lists unknown tool %s", name)
		}
	}
	for _, name := range designExcludedTools {
		if !contains(all, name) {
			t.Errorf("designExcludedTools lists unknown tool %s", name)
		}
	}
}

func TestApplyProfile_Unknown(t *testing.T) {
	s := server.NewMCPServer("test", "0.0.1")
	RegisterTools(s, NewNode("127.0.0.1", 19940, "test"))
	if err := ApplyProfile(s, "tiny"); err == nil {
		t.Error("expected error for unknown profile")
	}
}

// TestToolSchemas_SizeBudget keeps each tool's schema small: every byte is
// loaded into the client's context each session. Put long guidance in skills.
func TestToolSchemas_SizeBudget(t *testing.T) {
	s, _ := newTestServer(t)
	raw := s.HandleMessage(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`))
	b, _ := json.Marshal(raw)
	var resp struct {
		Result struct {
			Tools []json.RawMessage `json:"tools"`
		} `json:"result"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		t.Fatal(err)
	}
	const budget = 2500
	for _, tool := range resp.Result.Tools {
		var named struct{ Name string }
		json.Unmarshal(tool, &named) //nolint:errcheck
		if len(tool) > budget {
			t.Errorf("%s schema is %d bytes, budget %d", named.Name, len(tool), budget)
		}
	}
}
