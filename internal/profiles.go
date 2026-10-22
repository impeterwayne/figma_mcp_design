package internal

import (
	"fmt"

	"github.com/mark3labs/mcp-go/server"
)

// Tool profiles trim the tool list an AI client loads every session. The
// schema of every exposed tool costs context tokens, so a smaller profile is
// cheaper when the task does not need the rest.
//
//	full   — every tool (default)
//	design — building and editing UI; drops prototyping, bulk renaming,
//	         housekeeping and whole-document reads
//	read   — inspection, review and export only; no write tools

// readProfileTools is the allowlist for the "read" profile.
var readProfileTools = []string{
	"get_design_context", "get_document", "get_pages", "get_metadata", "get_selection",
	"get_node", "get_nodes_info", "search_nodes", "scan_nodes_by_types", "scan_text_nodes",
	"get_reactions", "get_viewport", "get_fonts", "get_styles", "get_variable_defs",
	"get_local_components", "get_annotations", "export_tokens",
	"get_screenshot", "save_screenshots", "export_frames_to_pdf", "navigate_to_page",
}

// designExcludedTools are removed from the full set for the "design" profile.
var designExcludedTools = []string{
	// whole-document read: use get_design_context instead
	"get_document",
	// prototyping
	"get_reactions", "set_reactions", "remove_reactions",
	// export / handoff
	"export_frames_to_pdf", "export_tokens", "get_annotations",
	// renaming and housekeeping
	"batch_rename_nodes", "rename_variable_collection", "rename_mode", "rename_variable",
	"batch_rename_variables", "rename_style", "rename_page", "delete_page", "delete_style",
	"update_paint_style", "set_description", "lock_nodes", "unlock_nodes",
	// rarely needed for UI work
	"create_grid_style", "set_blend_mode", "rotate_nodes",
}

// Profiles lists the accepted --profile values.
var Profiles = []string{"full", "design", "read"}

// ApplyProfile removes the tools the given profile does not expose.
// An empty profile means "full".
func ApplyProfile(s *server.MCPServer, profile string) error {
	switch profile {
	case "", "full":
		return nil
	case "design":
		s.DeleteTools(designExcludedTools...)
		return nil
	case "read":
		keep := make(map[string]bool, len(readProfileTools))
		for _, name := range readProfileTools {
			keep[name] = true
		}
		var drop []string
		for name := range s.ListTools() {
			if !keep[name] {
				drop = append(drop, name)
			}
		}
		s.DeleteTools(drop...)
		return nil
	default:
		return fmt.Errorf("unknown profile %q (want one of %v)", profile, Profiles)
	}
}
