package internal

import "testing"

func TestValidateRPC_ColorOrVariable(t *testing.T) {
	for _, tool := range []string{"set_fills", "set_strokes"} {
		if msg := ValidateRPC(tool, []string{"1:2"}, map[string]interface{}{"color": "#FF0000"}); msg != "" {
			t.Errorf("%s with color rejected: %s", tool, msg)
		}
		if msg := ValidateRPC(tool, []string{"1:2"}, map[string]interface{}{"colorVariable": "brand/primary"}); msg != "" {
			t.Errorf("%s with colorVariable rejected: %s", tool, msg)
		}
		if msg := ValidateRPC(tool, []string{"1:2"}, map[string]interface{}{}); msg == "" {
			t.Errorf("%s without colour should be rejected", tool)
		}
		if msg := ValidateRPC(tool, []string{"1:2"}, map[string]interface{}{"color": "#FF0000", "colorVariable": "x"}); msg != "" {
			t.Errorf("%s with a variable name plus its value rejected: %s", tool, msg)
		}
	}
}

func TestValidateRPC_SetEffectsStyle(t *testing.T) {
	if msg := ValidateRPC("set_effects", []string{"1:2"}, map[string]interface{}{"effectStyle": "SDV/Glow CTA"}); msg != "" {
		t.Errorf("effectStyle rejected: %s", msg)
	}
	if msg := ValidateRPC("set_effects", []string{"1:2"}, map[string]interface{}{"effects": []interface{}{}}); msg != "" {
		t.Errorf("empty effects (clear) rejected: %s", msg)
	}
	if msg := ValidateRPC("set_effects", []string{"1:2"}, map[string]interface{}{}); msg == "" {
		t.Error("set_effects without effects or effectStyle should be rejected")
	}
	if msg := ValidateRPC("set_effects", []string{"1:2"}, map[string]interface{}{"effectStyle": "a", "effects": []interface{}{map[string]interface{}{"type": "DROP_SHADOW"}}}); msg != "" {
		t.Errorf("effectStyle plus effects to create it rejected: %s", msg)
	}
	if msg := ValidateRPC("set_effects", []string{"1:2"}, map[string]interface{}{"effectStyle": "a", "effects": []interface{}{map[string]interface{}{"type": "GLOW"}}}); msg == "" {
		t.Error("bad effect type should still be rejected")
	}
}

func TestValidateRPC_TextStyleCountsAsProperty(t *testing.T) {
	if msg := ValidateRPC("set_text_properties", []string{"1:2"}, map[string]interface{}{"textStyle": "SDV Type/Title"}); msg != "" {
		t.Errorf("textStyle alone rejected: %s", msg)
	}
}

func TestValidateRPC_DesignSystemAudit(t *testing.T) {
	if msg := ValidateRPC("design_system_audit", nil, map[string]interface{}{}); msg != "" {
		t.Errorf("audit of current page rejected: %s", msg)
	}
	if msg := ValidateRPC("design_system_audit", []string{"0:1"}, map[string]interface{}{"checks": []interface{}{"color", "text"}, "limit": float64(10)}); msg != "" {
		t.Errorf("valid audit rejected: %s", msg)
	}
	bad := []struct {
		ids    []string
		params map[string]interface{}
	}{
		{[]string{"bad"}, map[string]interface{}{}},
		{nil, map[string]interface{}{"checks": []interface{}{"colour"}}},
		{nil, map[string]interface{}{"checks": []string{"fonts"}}},
		{nil, map[string]interface{}{"limit": float64(0)}},
	}
	for i, c := range bad {
		if msg := ValidateRPC("design_system_audit", c.ids, c.params); msg == "" {
			t.Errorf("case %d: expected rejection for %v %v", i, c.ids, c.params)
		}
	}
}

func TestHandlers_TokenParams(t *testing.T) {
	s, _ := newTestServer(t)
	callTool(t, s, "create_text", map[string]any{"text": "Hi", "textStyle": "SDV Type/Title", "fillVariable": "text/primary"})
	callTool(t, s, "create_frame", map[string]any{"fillVariable": "surface/1", "radiusVariable": "radius/lg", "paddingVariable": "space/16", "gapVariable": "space/8", "effectStyle": "SDV/Glow CTA"})
	callTool(t, s, "create_rectangle", map[string]any{"fillVariable": "surface/2", "strokeVariable": "border/subtle"})
	callTool(t, s, "create_ellipse", map[string]any{"fillVariable": "brand/primary"})
	callTool(t, s, "set_fills", map[string]any{"nodeId": "1:2", "colorVariable": "brand/primary"})
	callTool(t, s, "set_fills", map[string]any{"nodeId": "1:2"})
	callTool(t, s, "set_strokes", map[string]any{"nodeId": "1:2", "colorVariable": "border/subtle", "strokeWeight": float64(2)})
	callTool(t, s, "set_effects", map[string]any{"nodeId": "1:2", "effectStyle": "SDV/Glow CTA"})
	callTool(t, s, "set_text_properties", map[string]any{"nodeIds": []any{"1:2"}, "textStyle": "SDV Type/Title"})
	callTool(t, s, "design_system_audit", map[string]any{"nodeId": "0:1", "fix": true, "checks": []any{"color"}, "limit": float64(5)})
	callTool(t, s, "design_system_audit", map[string]any{})
}
