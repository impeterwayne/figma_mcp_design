package internal

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

// ── cleanSVG ──────────────────────────────────────────────────────────────────

func TestCleanSVG_StripsActiveContent(t *testing.T) {
	in := `<?xml version="1.0"?>
<!DOCTYPE svg>
<!-- exported -->
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" viewBox="0 0 24 24">
  <metadata>tool</metadata>
  <title>Search</title>
  <script>alert(1)</script>
  <foreignObject><div/></foreignObject>
  <a href="javascript:alert(1)"><path d="M0 0h24v24H0z" onclick='x()'/></a>
  <image xlink:href="https://evil.example/x.png"/>
  <image href="data:image/png;base64,AAAA"/>
</svg>`
	out := cleanSVG(in)
	for _, banned := range []string{"<script", "onload", "onclick", "foreignObject", "javascript:", "https://evil", "<?xml", "DOCTYPE", "<!--", "<metadata", "<title"} {
		if strings.Contains(out, banned) {
			t.Errorf("cleanSVG kept %q: %s", banned, out)
		}
	}
	for _, kept := range []string{`xmlns="http://www.w3.org/2000/svg"`, `viewBox="0 0 24 24"`, `d="M0 0h24v24H0z"`, "data:image/png;base64,AAAA"} {
		if !strings.Contains(out, kept) {
			t.Errorf("cleanSVG dropped %q: %s", kept, out)
		}
	}
	if strings.Contains(out, ">\n") || strings.Contains(out, ">  <") {
		t.Errorf("cleanSVG kept whitespace between tags: %q", out)
	}
}

// ── readSVGFile ───────────────────────────────────────────────────────────────

func TestReadSVGFile(t *testing.T) {
	workDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(workDir, "logo.svg"), []byte("<svg/>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got, err := readSVGFile("logo.svg", workDir); err != nil || got != "<svg/>" {
		t.Errorf("relative path: got %q, %v", got, err)
	}
	if _, err := readSVGFile(filepath.Join(workDir, "logo.svg"), workDir); err != nil {
		t.Errorf("absolute path inside workDir: %v", err)
	}

	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "x.svg"), []byte("<svg/>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := readSVGFile(filepath.Join(outside, "x.svg"), workDir); err == nil {
		t.Error("expected error for a file outside workDir")
	}
	if _, err := readSVGFile("../x.svg", workDir); err == nil {
		t.Error("expected error for ../ path")
	}
	if err := os.Symlink(filepath.Join(outside, "x.svg"), filepath.Join(workDir, "link.svg")); err == nil {
		if _, err := readSVGFile("link.svg", workDir); err == nil {
			t.Error("expected error for a symlink pointing outside workDir")
		}
	}
	if _, err := readSVGFile("logo.png", workDir); err == nil {
		t.Error("expected error for a non-.svg path")
	}
	if _, err := readSVGFile("missing.svg", workDir); err == nil {
		t.Error("expected error for a missing file")
	}
}

// ── ValidateRPC create_svg ────────────────────────────────────────────────────

func TestValidateRPC_CreateSVG(t *testing.T) {
	ok := map[string]interface{}{"svg": "<svg/>", "parentId": "1:2"}
	if msg := ValidateRPC("create_svg", nil, ok); msg != "" {
		t.Errorf("valid params rejected: %s", msg)
	}
	bad := []map[string]interface{}{
		{"parentId": "1:2"},
		{"svg": "<div/>", "parentId": "1:2"},
		{"svg": "<svg/>"},
		{"svg": "<svg/>", "parentId": "bad"},
		{"svg": "<svg/>", "parentId": "1:2", "color": "red"},
		{"svg": "<svg/>", "parentId": "1:2", "color": "#FF0000", "colorVariableId": "VariableID:1:1"},
		{"svg": "<svg/>", "parentId": "1:2", "width": float64(0)},
		{"svg": "<svg>" + strings.Repeat("a", maxSVGBytes) + "</svg>", "parentId": "1:2"},
	}
	for i, p := range bad {
		if msg := ValidateRPC("create_svg", nil, p); msg == "" {
			t.Errorf("case %d: expected rejection for %v", i, p)
		}
	}
}

func TestHandlers_CreateSVG(t *testing.T) {
	s, _ := newTestServer(t)
	callTool(t, s, "create_svg", map[string]any{"svg": "<svg/>", "parentId": "1:2", "width": float64(24), "color": "#111111"})
	callTool(t, s, "create_svg", map[string]any{"svg": "<svg/>", "path": "a.svg", "parentId": "1:2"})
	callTool(t, s, "create_svg", map[string]any{"path": "missing.svg", "parentId": "1:2"})
}

// ── renderScreenshotContent ───────────────────────────────────────────────────

func TestRenderScreenshotContent(t *testing.T) {
	svg := `<svg viewBox="0 0 1 1"/>`
	data := map[string]any{"exports": []any{
		map[string]any{"nodeId": "1:1", "format": "PNG", "base64": "iVBORw0K", "width": 10.0},
		map[string]any{"nodeId": "1:2", "format": "JPG", "base64": "/9j/"},
		map[string]any{"nodeId": "1:3", "format": "SVG", "base64": base64.StdEncoding.EncodeToString([]byte(svg))},
		map[string]any{"nodeId": "1:4", "format": "PDF", "base64": "JVBERi0="},
	}}
	res, err := renderScreenshotContent(data)
	if err != nil || res.IsError {
		t.Fatalf("unexpected error: %v %+v", err, res)
	}
	if len(res.Content) != 4 {
		t.Fatalf("want 1 metadata + 3 content blocks, got %d", len(res.Content))
	}

	metaText, ok := res.Content[0].(mcp.TextContent)
	if !ok {
		t.Fatalf("first block is %T, want TextContent", res.Content[0])
	}
	var meta struct {
		Exports []map[string]any `json:"exports"`
	}
	if err := json.Unmarshal([]byte(metaText.Text), &meta); err != nil {
		t.Fatal(err)
	}
	if _, has := meta.Exports[0]["base64"]; has {
		t.Error("PNG metadata should not repeat base64")
	}
	if meta.Exports[0]["width"] != 10.0 || meta.Exports[0]["content"] != "image" {
		t.Errorf("PNG metadata wrong: %v", meta.Exports[0])
	}
	if meta.Exports[3]["base64"] != "JVBERi0=" {
		t.Errorf("PDF should keep base64: %v", meta.Exports[3])
	}

	png, ok := res.Content[1].(mcp.ImageContent)
	if !ok || png.MIMEType != "image/png" || png.Data != "iVBORw0K" {
		t.Errorf("PNG block wrong: %+v", res.Content[1])
	}
	jpg, ok := res.Content[2].(mcp.ImageContent)
	if !ok || jpg.MIMEType != "image/jpeg" {
		t.Errorf("JPG block wrong: %+v", res.Content[2])
	}
	svgText, ok := res.Content[3].(mcp.TextContent)
	if !ok || svgText.Text != svg {
		t.Errorf("SVG block wrong: %+v", res.Content[3])
	}
}

func TestRenderScreenshotContent_UnexpectedShape(t *testing.T) {
	res, err := renderScreenshotContent(map[string]any{"other": 1})
	if err != nil || res.IsError || len(res.Content) != 1 {
		t.Errorf("fallback should render plain JSON: %+v %v", res, err)
	}
}

// ── boolean_operation ─────────────────────────────────────────────────────────

func TestValidateRPC_BooleanOperation(t *testing.T) {
	for _, op := range []string{"UNION", "SUBTRACT", "INTERSECT", "EXCLUDE"} {
		if msg := ValidateRPC("boolean_operation", []string{"1:1", "1:2"}, map[string]interface{}{"operation": op}); msg != "" {
			t.Errorf("%s with 2 nodes rejected: %s", op, msg)
		}
		if msg := ValidateRPC("boolean_operation", []string{"1:1"}, map[string]interface{}{"operation": op}); msg == "" {
			t.Errorf("%s with 1 node should be rejected", op)
		}
	}
	if msg := ValidateRPC("boolean_operation", []string{"1:1"}, map[string]interface{}{"operation": "FLATTEN"}); msg != "" {
		t.Errorf("FLATTEN with 1 node rejected: %s", msg)
	}
	if msg := ValidateRPC("boolean_operation", nil, map[string]interface{}{"operation": "FLATTEN"}); msg == "" {
		t.Error("FLATTEN with no nodes should be rejected")
	}
	if msg := ValidateRPC("boolean_operation", []string{"1:1", "1:2"}, map[string]interface{}{"operation": "MERGE"}); msg == "" {
		t.Error("unknown operation should be rejected")
	}
	if msg := ValidateRPC("boolean_operation", []string{"1:1", "bad"}, map[string]interface{}{"operation": "UNION"}); msg == "" {
		t.Error("bad node ID should be rejected")
	}
}

func TestHandlers_BooleanOperation(t *testing.T) {
	s, _ := newTestServer(t)
	callTool(t, s, "boolean_operation", map[string]any{"nodeIds": []any{"1:1", "1:2"}, "operation": "subtract", "name": "Ring"})
	callTool(t, s, "boolean_operation", map[string]any{"nodeIds": []any{"1:1"}, "operation": "UNION"})
}
