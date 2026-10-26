import { describe, it, expect, beforeEach } from "bun:test";
import { handleWriteCreateRequest } from "./write-create";
import { handleWriteModifyRequest } from "./write-modify";
import { handleWriteStyleRequest } from "./write-styles";
import { handleWriteAuditRequest } from "./write-audit";
import { resolveVariable } from "./tokens";

// ── Figma global mock ─────────────────────────────────────────────────────────

let mockNodes: Record<string, any>;
let created: any[];
let loadedFonts: string[];
const MIXED = Symbol("mixed");

const req = (type: string, nodeIds: string[] = [], params: any = {}) => ({ type, requestId: "r1", nodeIds, params });

let collections: any[];
let variables: any[];
let textStyles: any[];
let effectStyles: any[];
const baseVariables = () => [
  { id: "V:surface", name: "surface/1", resolvedType: "COLOR", variableCollectionId: "C:color", valuesByMode: { m1: { r: 0.1, g: 0.08, b: 0.08, a: 1 } } },
  { id: "V:white30", name: "white/30", resolvedType: "COLOR", variableCollectionId: "C:color", valuesByMode: { m1: { r: 1, g: 1, b: 1, a: 0.3 } } },
  { id: "V:r16", name: "radius/lg", resolvedType: "FLOAT", variableCollectionId: "C:dim", valuesByMode: { m2: 16 } },
  { id: "V:s16", name: "space/16", resolvedType: "FLOAT", variableCollectionId: "C:dim", valuesByMode: { m2: 16 } },
];
const baseText = () => [{ id: "S:title", name: "SDV Type/Title", fontName: { family: "Plus Jakarta Sans", style: "Bold" }, fontSize: 15 }];
const glowEffects = [{ type: "DROP_SHADOW", radius: 20, color: { r: 0.9, g: 0.1, b: 0.25, a: 0.4 }, offset: { x: 0, y: 6 }, spread: 0, visible: true }];
const baseEffects = () => [{ id: "S:glow", name: "SDV/Glow CTA", effects: glowEffects }];

const makeNode = (id: string, type: string, props: any = {}) => {
  const node: any = {
    id, type, name: id, x: 0, y: 0, width: 100, height: 40,
    fills: [], strokes: [], effects: [], cornerRadius: 0, boundVariables: {} as Record<string, any>,
    resize(w: number, h: number) { this.width = w; this.height = h; },
    setBoundVariable(field: string, v: any) { this.boundVariables[field] = { id: v.id }; },
    async setEffectStyleIdAsync(sid: string) { this.effectStyleId = sid; },
    async setTextStyleIdAsync(sid: string) { this.textStyleId = sid; },
    ...props,
  };
  mockNodes[id] = node;
  return node;
};

beforeEach(() => {
  collections = [{ id: "C:color", name: "SDV/Color", defaultModeId: "m1" }, { id: "C:dim", name: "SDV/Dimension", defaultModeId: "m2" }];
  variables = baseVariables();
  textStyles = baseText();
  effectStyles = baseEffects();
  mockNodes = {};
  created = [];
  loadedFonts = [];
  let seq = 0;
  const create = (type: string) => () => { const n = makeNode(`new:${++seq}`, type); created.push(n); return n; };
  (globalThis as any).figma = {
    mixed: MIXED,
    currentPage: { id: "0:1", name: "Page 1", type: "PAGE", children: [] as any[], appendChild() {} },
    getNodeByIdAsync: async (id: string) => mockNodes[id] ?? null,
    commitUndo: () => {},
    loadFontAsync: async (f: any) => { loadedFonts.push(`${f.family} ${f.style}`); },
    createFrame: create("FRAME"),
    createRectangle: create("RECTANGLE"),
    createEllipse: create("ELLIPSE"),
    createText: create("TEXT"),
    getLocalTextStylesAsync: async () => textStyles,
    getLocalEffectStylesAsync: async () => effectStyles,
    createTextStyle: () => { const st: any = { id: `S:new${textStyles.length}`, name: "", fontName: null, fontSize: 0 }; textStyles.push(st); return st; },
    createEffectStyle: () => { const st: any = { id: `S:fx${effectStyles.length}`, name: "", effects: [] }; effectStyles.push(st); return st; },
    variables: {
      getVariableCollectionByIdAsync: async (id: string) => collections.find((c) => c.id === id) ?? null,
      createVariableCollection: (name: string) => { const c = { id: `C:${name}`, name, defaultModeId: "m9" }; collections.push(c); return c; },
      createVariable: (name: string, col: any, type: string) => {
        const v: any = { id: `V:new${variables.length}`, name, resolvedType: type, variableCollectionId: col.id, valuesByMode: {},
          setValueForMode(m: string, val: any) { this.valuesByMode[m] = val; } };
        variables.push(v); return v;
      },
      getVariableByIdAsync: async (id: string) => variables.find((v) => v.id === id) ?? null,
      getLocalVariablesAsync: async (type?: string) => variables.filter((v) => !type || v.resolvedType === type),
      getLocalVariableCollectionsAsync: async () => collections,
      setBoundVariableForPaint: (paint: any, _f: string, v: any) => ({ ...paint, boundVariables: { color: { id: v.id } } }),
    },
  };
});

describe("resolveVariable", () => {
  it("finds by id, name and collection-prefixed name", async () => {
    expect((await resolveVariable("V:surface" as any)).id).toBe("V:surface");
    expect((await resolveVariable("surface/1", "COLOR")).id).toBe("V:surface");
    expect((await resolveVariable("SDV/Color/surface/1")).id).toBe("V:surface");
  });
  it("rejects unknown names and wrong types", async () => {
    await expect(resolveVariable("nope")).rejects.toThrow("Variable not found");
    await expect(resolveVariable("radius/lg", "COLOR")).rejects.toThrow();
  });
});

describe("token params on create tools", () => {
  it("create_frame binds fill, radius, padding, gap and effect style", async () => {
    const res = await handleWriteCreateRequest(req("create_frame", [], {
      layoutMode: "VERTICAL", fillVariable: "surface/1", radiusVariable: "radius/lg",
      paddingVariable: "space/16", gapVariable: "space/16", effectStyle: "SDV/Glow CTA",
    }));
    const f = created[0];
    expect(f.fills[0].boundVariables.color.id).toBe("V:surface");
    expect(f.boundVariables.topLeftRadius.id).toBe("V:r16");
    expect(f.boundVariables.paddingLeft.id).toBe("V:s16");
    expect(f.boundVariables.itemSpacing.id).toBe("V:s16");
    expect(f.effectStyleId).toBe("S:glow");
    expect(res?.data.tokens.created).toEqual([]);
    expect(res?.data.tokens.reused).toContain("surface/1");
  });

  it("create_text uses the text style instead of raw font params", async () => {
    const res = await handleWriteCreateRequest(req("create_text", [], { text: "Hi", textStyle: "SDV Type/Title", fillVariable: "surface/1", fontFamily: "Inter" }));
    const t = created[0];
    expect(t.textStyleId).toBe("S:title");
    expect(loadedFonts).toEqual(["Plus Jakarta Sans Bold"]);
    expect(t.characters).toBe("Hi");
    expect(res?.data.tokens.reused).toEqual(["SDV Type/Title", "surface/1"]);
  });

  it("create_text with raw font saves it as a text style, then reuses it", async () => {
    const res = await handleWriteCreateRequest(req("create_text", [], { text: "Hi", fontFamily: "Inter", fontSize: 12 }));
    expect(created[0].fontSize).toBe(12);
    expect(res?.data.tokens.created).toEqual(["Text/Inter Regular 12"]);
    const again = await handleWriteCreateRequest(req("create_text", [], { text: "Yo", fontFamily: "Inter", fontSize: 12 }));
    expect(again?.data.tokens).toEqual({ created: [], reused: ["Text/Inter Regular 12"] });
    expect(created[1].textStyleId).toBe(created[0].textStyleId);
  });

  it("create_text with link:false keeps the old raw behaviour", async () => {
    const res = await handleWriteCreateRequest(req("create_text", [], { text: "Hi", fontFamily: "Inter", fontSize: 12, link: false }));
    expect(created[0].fontSize).toBe(12);
    expect(created[0].textStyleId).toBeUndefined();
    expect(res?.data.tokens).toBeUndefined();
  });

  it("fails clearly on an unknown style with nothing to create it from", async () => {
    await expect(handleWriteCreateRequest(req("create_text", [], { text: "Hi", textStyle: "Missing" }))).rejects.toThrow("Text style not found");
  });

  it("creates missing tokens from the values given, then reuses them", async () => {
    const res = await handleWriteCreateRequest(req("create_frame", [], {
      layoutMode: "VERTICAL", fillVariable: "bg/card", fillColor: "#123456", radiusVariable: "radius/xl", cornerRadius: 24,
      paddingVariable: "space/20", paddingTop: 20, effectStyle: "Shadow/Card", effects: [{ type: "DROP_SHADOW", color: "#000000", opacity: 0.3, radius: 12, offsetY: 4 }],
    }));
    expect(res?.data.tokens.created).toEqual(["SDV/Color/bg/card", "SDV/Dimension/radius/xl", "SDV/Dimension/space/20", "Shadow/Card"]);
    const again = await handleWriteCreateRequest(req("create_frame", [], { fillVariable: "bg/card", fillColor: "#123456" }));
    expect(again?.data.tokens).toEqual({ created: [], reused: ["bg/card"] });
    expect(variables.filter((v) => v.name === "bg/card").length).toBe(1);
  });

  it("reuses a token with the same value instead of creating a duplicate name", async () => {
    const res = await handleWriteCreateRequest(req("create_rectangle", [], { fillVariable: "card/bg", fillColor: "#1A1414" }));
    expect(res?.data.tokens).toEqual({ created: [], reused: ["surface/1"] });
    expect(created[0].fills[0].boundVariables.color.id).toBe("V:surface");
  });

  it("links raw values to existing tokens, or creates auto-named ones", async () => {
    await handleWriteCreateRequest(req("create_rectangle", [], { fillColor: "#1A1414", cornerRadius: 16 }));
    expect(created[0].fills[0].boundVariables.color.id).toBe("V:surface");
    expect(created[0].boundVariables.topLeftRadius.id).toBe("V:r16");
    const raw = await handleWriteCreateRequest(req("create_rectangle", [], { fillColor: "#ABCDEF", cornerRadius: 10 }));
    expect(raw?.data.tokens.created).toEqual(["SDV/Color/color/ABCDEF", "SDV/Dimension/radius/10"]);
    const again = await handleWriteCreateRequest(req("create_rectangle", [], { fillColor: "#ABCDEF" }));
    expect(again?.data.tokens).toEqual({ created: [], reused: ["color/ABCDEF"] });
  });

  it("auto-creates spacing tokens without touching radius ones", async () => {
    const res = await handleWriteCreateRequest(req("create_frame", [], { layoutMode: "HORIZONTAL", paddingLeft: 16, itemSpacing: 6 }));
    expect(res?.data.tokens.reused).toContain("space/16");
    expect(res?.data.tokens.created).toEqual(["SDV/Dimension/space/6"]);
  });

  it("raw effects become an auto-named effect style", async () => {
    const n = makeNode("1:1", "FRAME");
    const res = await handleWriteStyleRequest(req("set_effects", ["1:1"], { effects: [{ type: "BACKGROUND_BLUR", radius: 16 }, { type: "INNER_SHADOW", color: "#FFFFFF", opacity: 0.3, radius: 1, offsetY: 1 }] }));
    expect(res?.data.effectStyle).toBe("Effect/background blur 16 + inner shadow 1");
    expect(n.effectStyleId).toBeDefined();
  });

  it("set_fills with a raw colour auto-creates then reuses", async () => {
    const a = makeNode("1:1", "RECTANGLE"); const b = makeNode("1:2", "RECTANGLE");
    await handleWriteModifyRequest(req("set_fills", ["1:1"], { color: "#00FF00" }));
    await handleWriteModifyRequest(req("set_fills", ["1:2"], { color: "#00FF00" }));
    expect(a.fills[0].boundVariables.color.id).toBe(b.fills[0].boundVariables.color.id);
    expect(variables.filter((v) => v.name.startsWith("color/00FF00")).length).toBe(1);
  });

  it("link:false keeps raw values", async () => {
    await handleWriteCreateRequest(req("create_rectangle", [], { fillColor: "#1A1414", link: false }));
    expect(created[0].fills[0].boundVariables).toBeUndefined();
  });

  it("creates a text style from font params and reuses it by value", async () => {
    const res = await handleWriteCreateRequest(req("create_text", [], { text: "A", textStyle: "Type/Caption", fontFamily: "Inter", fontStyle: "Medium", fontSize: 12 }));
    expect(res?.data.tokens.created).toEqual(["Type/Caption"]);
    const plain = await handleWriteCreateRequest(req("create_text", [], { text: "B", fontFamily: "Inter", fontStyle: "Medium", fontSize: 12 }));
    expect(plain?.data.tokens.reused).toEqual(["Type/Caption"]);
    expect(created[1].textStyleId).toBe(created[0].textStyleId);
  });
});

describe("token params on set tools", () => {
  it("set_fills / set_strokes bind a colour variable", async () => {
    const n = makeNode("1:1", "RECTANGLE");
    await handleWriteModifyRequest(req("set_fills", ["1:1"], { colorVariable: "surface/1" }));
    await handleWriteModifyRequest(req("set_strokes", ["1:1"], { colorVariable: "white/30", strokeWeight: 2 }));
    expect(n.fills[0].boundVariables.color.id).toBe("V:surface");
    expect(n.strokes[0].boundVariables.color.id).toBe("V:white30");
    expect(n.strokeWeight).toBe(2);
  });

  it("set_effects links an effect style", async () => {
    const n = makeNode("1:1", "FRAME");
    const res = await handleWriteStyleRequest(req("set_effects", ["1:1"], { effectStyle: "SDV/Glow CTA" }));
    expect(n.effectStyleId).toBe("S:glow");
    expect(res?.data.effectStyle).toBe("SDV/Glow CTA");
  });

  it("set_text_properties applies a text style", async () => {
    const n = makeNode("1:1", "TEXT", { fontName: { family: "Inter", style: "Regular" }, fontSize: 14, characters: "x" });
    await handleWriteModifyRequest(req("set_text_properties", ["1:1"], { textStyle: "SDV Type/Title" }));
    expect(n.textStyleId).toBe("S:title");
  });
});

describe("design_system_audit", () => {
  const setup = () => {
    const raw = makeNode("2:1", "RECTANGLE", { fills: [{ type: "SOLID", color: { r: 0.1, g: 0.08, b: 0.08 } }], cornerRadius: 16 });
    const alpha = makeNode("2:2", "RECTANGLE", { fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.3 }], cornerRadius: 0 });
    const odd = makeNode("2:3", "RECTANGLE", { fills: [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }], cornerRadius: 7 });
    const text = makeNode("2:4", "TEXT", { fontName: { family: "Plus Jakarta Sans", style: "Bold" }, fontSize: 15, textStyleId: "" });
    const glow = makeNode("2:5", "FRAME", { effects: glowEffects, effectStyleId: "", children: [] });
    const box = makeNode("2:0", "FRAME", { layoutMode: "VERTICAL", paddingTop: 16, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, itemSpacing: 0, children: [raw, alpha, odd, text, glow] });
    return { raw, alpha, odd, text, glow, box };
  };

  it("reports issues with suggestions and changes nothing by default", async () => {
    const { raw } = setup();
    const res = await handleWriteAuditRequest(req("design_system_audit", ["2:0"]));
    const s = res!.data.summary;
    expect(s.color).toEqual({ issues: 3, fixable: 2, fixed: 0 });
    expect(s.text).toEqual({ issues: 1, fixable: 1, fixed: 0 });
    expect(s.effect.fixable).toBe(1);
    expect(s.radius).toEqual({ issues: 2, fixable: 1, fixed: 0 });
    expect(s.spacing).toEqual({ issues: 1, fixable: 1, fixed: 0 });
    expect(res!.data.issues.find((i: any) => i.nodeId === "2:1" && i.kind === "color").suggestion).toBe("surface/1");
    expect(raw.fills[0].boundVariables).toBeUndefined();
  });

  it("fix binds exact matches only", async () => {
    const { raw, alpha, odd, text, glow, box } = setup();
    const res = await handleWriteAuditRequest(req("design_system_audit", ["2:0"], { fix: true }));
    expect(raw.fills[0].boundVariables.color.id).toBe("V:surface");
    expect(alpha.fills[0].boundVariables.color.id).toBe("V:white30");
    expect(alpha.fills[0].opacity).toBe(1);
    expect(odd.fills[0].boundVariables).toBeUndefined();
    expect(odd.boundVariables.topLeftRadius).toBeUndefined();
    expect(raw.boundVariables.topLeftRadius.id).toBe("V:r16");
    expect(text.textStyleId).toBe("S:title");
    expect(glow.effectStyleId).toBe("S:glow");
    expect(box.boundVariables.paddingTop.id).toBe("V:s16");
    expect(res!.data.summary.color.fixed).toBe(2);
  });

  it("fix + create makes auto-named tokens for unmatched values", async () => {
    const { odd } = setup();
    const res = await handleWriteAuditRequest(req("design_system_audit", ["2:0"], { fix: true, create: true }));
    expect(odd.fills[0].boundVariables.color.id).toBeDefined();
    expect(odd.boundVariables.topLeftRadius).toBeDefined();
    expect(res!.data.tokens.created).toContain("SDV/Color/color/808080");
    expect(res!.data.tokens.created).toContain("SDV/Dimension/radius/7");
    expect(res!.data.summary.color.fixed).toBe(3);
  });

  it("limits checks and flags repeated frames", async () => {
    const kids = () => [makeNode(`k${Math.random()}`, "TEXT", { textStyleId: "S:title" }), makeNode(`k${Math.random()}`, "RECTANGLE")];
    const cards = [1, 2, 3].map((i) => makeNode(`3:${i}`, "FRAME", { width: 120, height: 80, children: kids() }));
    makeNode("3:0", "FRAME", { children: cards });
    const res = await handleWriteAuditRequest(req("design_system_audit", ["3:0"], { checks: ["repeat"] }));
    expect(Object.keys(res!.data.summary)).toEqual(["repeat"]);
    expect(res!.data.repeats[0].count).toBe(3);
  });

  it("skips instance internals unless asked", async () => {
    const inner = makeNode("4:2", "RECTANGLE", { fills: [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }] });
    makeNode("4:1", "INSTANCE", { children: [inner] });
    let res = await handleWriteAuditRequest(req("design_system_audit", ["4:1"], { checks: ["color"] }));
    expect(res!.data.summary.color.issues).toBe(0);
    res = await handleWriteAuditRequest(req("design_system_audit", ["4:1"], { checks: ["color"], includeInstances: true }));
    expect(res!.data.summary.color.issues).toBe(1);
  });

  it("returns undefined for other commands", async () => {
    expect(await handleWriteAuditRequest(req("get_node"))).toBeUndefined();
  });
});
