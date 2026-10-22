import { describe, it, expect, beforeEach } from "bun:test";
import { handleWriteStyleRequest } from "./write-styles";

// ── Figma global mock ─────────────────────────────────────────────────────────

let mockNodes: Record<string, any>;
let commitUndoCalled: boolean;
const MIXED = Symbol("mixed");

const makeRequest = (type: string, nodeIds?: string[], params?: any) => ({
  type,
  requestId: "req-test-1",
  nodeIds: nodeIds ?? [],
  params: params ?? {},
});

const solid = (r: number, g: number, b: number, opacity = 1) => ({ type: "SOLID", color: { r, g, b }, opacity });
const PINK = solid(1, 45 / 255, 85 / 255); // #FF2D55
const WHITE = solid(1, 1, 1);

beforeEach(() => {
  commitUndoCalled = false;
  mockNodes = {};
  (globalThis as any).figma = {
    mixed: MIXED,
    getNodeByIdAsync: async (id: string) => mockNodes[id] ?? null,
    commitUndo: () => { commitUndoCalled = true; },
    variables: {
      getVariableByIdAsync: async (id: string) => (id === "VariableID:1:1" ? { id, name: "brand/primary" } : null),
      setBoundVariableForPaint: (paint: any, _field: string, variable: any) => ({
        ...paint, boundVariables: { color: { type: "VARIABLE_ALIAS", id: variable.id } },
      }),
    },
  };
});

const buildTree = () => {
  const text = { id: "1:3", type: "TEXT", fills: [WHITE], strokes: [] };
  const button = { id: "1:2", type: "FRAME", fills: [PINK], strokes: [PINK], children: [text] };
  const instChild = { id: "I1:5;2:1", type: "RECTANGLE", fills: [PINK], strokes: [] };
  const instance = { id: "1:5", type: "INSTANCE", fills: [], strokes: [], children: [instChild] };
  const mixedText = { id: "1:6", type: "TEXT", fills: MIXED, strokes: [] };
  const root = { id: "1:1", type: "FRAME", fills: [solid(0, 0, 0)], strokes: [], children: [button, instance, mixedText] };
  for (const n of [root, button, text, instance, instChild, mixedText]) mockNodes[n.id] = n;
  return { root, button, text, instChild };
};

describe("replace_colors", () => {
  it("dryRun reports solid colour usage without changing anything", async () => {
    const { button } = buildTree();
    const res = await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { dryRun: true }));
    const colors = res?.data.colors;
    expect(colors[0]).toEqual({ hex: "#FF2D55", fills: 1, strokes: 1, gradientStops: 0, effects: 0 });
    expect(colors.map((c: any) => c.hex)).toContain("#FFFFFF");
    expect(res?.data.skippedMixed).toBe(1);
    expect(button.fills[0]).toBe(PINK);
    expect(commitUndoCalled).toBe(false);
  });

  it("binds matching fills and strokes to a variable, keeping paint opacity", async () => {
    const { button } = buildTree();
    button.fills = [solid(1, 45 / 255, 85 / 255, 0.5)];
    const res = await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], {
      mappings: [{ from: "#ff2d55", variableId: "VariableID:1:1" }],
    }));
    expect(button.fills[0].boundVariables.color.id).toBe("VariableID:1:1");
    expect(button.fills[0].opacity).toBe(0.5);
    expect(button.strokes[0].boundVariables.color.id).toBe("VariableID:1:1");
    expect(res?.data.replaced["#FF2D55"]).toBe(2);
    expect(commitUndoCalled).toBe(true);
  });

  it("replaces with a plain hex colour", async () => {
    const { text } = buildTree();
    await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { mappings: [{ from: "#FFFFFF", color: "#F0F0F0" }] }));
    expect(text.fills[0].color.r).toBeCloseTo(240 / 255);
  });

  it("skips instance internals by default and includes them when asked", async () => {
    const { instChild } = buildTree();
    await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { mappings: [{ from: "#FF2D55", color: "#000000" }] }));
    expect(instChild.fills[0]).toBe(PINK);
    await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], {
      mappings: [{ from: "#FF2D55", color: "#000000" }], includeInstances: true,
    }));
    expect(instChild.fills[0].color.r).toBe(0);
  });

  it("rejects an unknown variable before changing anything", async () => {
    const { button } = buildTree();
    await expect(handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], {
      mappings: [{ from: "#FF2D55", variableId: "VariableID:9:9" }],
    }))).rejects.toThrow("Variable not found: VariableID:9:9");
    expect(button.fills[0]).toBe(PINK);
  });

  it("requires mappings unless dryRun", async () => {
    buildTree();
    await expect(handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], {}))).rejects.toThrow("mappings is required");
  });
});

describe("replace_colors fidelity", () => {
  it("restores paint opacity when binding drops it", async () => {
    const { button } = buildTree();
    button.fills = [solid(1, 45 / 255, 85 / 255, 0.2)];
    (globalThis as any).figma.variables.setBoundVariableForPaint = (paint: any, _f: string, v: any) => {
      const { opacity, ...rest } = paint;
      return { ...rest, boundVariables: { color: { type: "VARIABLE_ALIAS", id: v.id } } };
    };
    await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { mappings: [{ from: "#FF2D55", variableId: "VariableID:1:1" }] }));
    expect(button.fills[0].opacity).toBe(0.2);
  });

  it("recolours matching gradient stops, keeping stop alpha", async () => {
    const { button } = buildTree();
    button.fills = [{
      type: "GRADIENT_LINEAR",
      gradientTransform: [[1, 0, 0], [0, 1, 0]],
      gradientStops: [
        { position: 0, color: { r: 21 / 255, g: 1, b: 207 / 255, a: 1 } },
        { position: 1, color: { r: 21 / 255, g: 1, b: 207 / 255, a: 0.4 } },
        { position: 0.5, color: { r: 0, g: 0, b: 0, a: 1 } },
      ],
    }];
    const res = await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { mappings: [{ from: "#15FFCF", color: "#6C47FF" }] }));
    const stops = button.fills[0].gradientStops;
    expect(stops[0].color.r).toBeCloseTo(108 / 255);
    expect(stops[1].color.a).toBe(0.4);
    expect(stops[2].color.r).toBe(0);
    expect(res?.data.replaced["#15FFCF"]).toBe(2);
  });

  it("dryRun counts gradient stop colours", async () => {
    const { button } = buildTree();
    button.fills = [{ type: "GRADIENT_LINEAR", gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 21 / 255, g: 1, b: 207 / 255, a: 1 } }] }];
    const res = await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { dryRun: true }));
    expect(res?.data.colors.find((c: any) => c.hex === "#15FFCF")?.gradientStops).toBe(1);
  });

  it("uses the variable's resolved colour for gradient stops", async () => {
    const { button } = buildTree();
    (globalThis as any).figma.variables.getVariableByIdAsync = async (id: string) => ({
      id, name: "brand/primary", resolveForConsumer: () => ({ value: { r: 108 / 255, g: 71 / 255, b: 1, a: 1 }, resolvedType: "COLOR" }),
    });
    button.fills = [{ type: "GRADIENT_LINEAR", gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 21 / 255, g: 1, b: 207 / 255, a: 1 } }] }];
    await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { mappings: [{ from: "#15FFCF", variableId: "VariableID:1:1" }] }));
    expect(button.fills[0].gradientStops[0].color.g).toBeCloseTo(71 / 255);
  });
});

describe("replace_colors effects", () => {
  it("recolours matching shadow colours, keeping alpha", async () => {
    const { button } = buildTree();
    (button as any).effects = [
      { type: "DROP_SHADOW", color: { r: 21 / 255, g: 1, b: 207 / 255, a: 0.35 }, offset: { x: 0, y: 0 }, radius: 12, visible: true, blendMode: "NORMAL" },
      { type: "LAYER_BLUR", radius: 4, visible: true },
    ];
    const res = await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { mappings: [{ from: "#15FFCF", color: "#6C47FF" }] }));
    const fx = (button as any).effects;
    expect(fx[0].color.r).toBeCloseTo(108 / 255);
    expect(fx[0].color.a).toBe(0.35);
    expect(fx[1].type).toBe("LAYER_BLUR");
    expect(res?.data.replaced["#15FFCF"]).toBe(1);
  });

  it("dryRun counts shadow colours", async () => {
    const { button } = buildTree();
    (button as any).effects = [{ type: "DROP_SHADOW", color: { r: 21 / 255, g: 1, b: 207 / 255, a: 0.35 }, offset: { x: 0, y: 0 }, radius: 12, visible: true, blendMode: "NORMAL" }];
    const res = await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { dryRun: true }));
    expect(res?.data.colors.find((c: any) => c.hex === "#15FFCF")?.effects).toBe(1);
  });
});

describe("replace_colors mixed text", () => {
  const TEAL = { type: "SOLID", color: { r: 21 / 255, g: 1, b: 207 / 255 }, opacity: 1 };
  const GREY = { type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 }, opacity: 1 };
  const makeMixedText = () => {
    const ranges: any[] = [];
    const node: any = {
      id: "1:9", type: "TEXT", fills: MIXED, strokes: [], characters: "EP.6 / EP.32",
      fontName: { family: "Poppins", style: "Regular" },
      getRangeAllFontNames: () => [{ family: "Poppins", style: "Regular" }],
      getStyledTextSegments: () => [
        { start: 0, end: 4, characters: "EP.6", fills: [TEAL] },
        { start: 4, end: 12, characters: " / EP.32", fills: [GREY] },
      ],
      setRangeFills: (start: number, end: number, fills: any[]) => ranges.push({ start, end, fills }),
    };
    mockNodes["1:9"] = node;
    mockNodes["1:1"] = { id: "1:1", type: "FRAME", fills: [], strokes: [], children: [node] };
    (globalThis as any).figma.loadFontAsync = async () => {};
    return ranges;
  };

  it("recolours matching ranges of mixed-fill text", async () => {
    const ranges = makeMixedText();
    const res = await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { mappings: [{ from: "#15FFCF", color: "#A48BFF" }] }));
    expect(ranges).toHaveLength(1);
    expect(ranges[0].start).toBe(0);
    expect(ranges[0].end).toBe(4);
    expect(ranges[0].fills[0].color.r).toBeCloseTo(164 / 255);
    expect(res?.data.replaced["#15FFCF"]).toBe(1);
  });

  it("dryRun counts colours inside mixed-fill text", async () => {
    makeMixedText();
    const res = await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { dryRun: true }));
    expect(res?.data.colors.find((c: any) => c.hex === "#15FFCF")?.fills).toBe(1);
    expect(res?.data.skippedMixed).toBe(0);
  });
});

describe("replace_colors nodeTypes filter", () => {
  it("only recolours nodes of the listed types", async () => {
    const { button, text } = buildTree();
    text.fills = [PINK];
    await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], {
      mappings: [{ from: "#FF2D55", color: "#FFFFFF" }], nodeTypes: ["TEXT"],
    }));
    expect(text.fills[0].color.g).toBe(1);
    expect(button.fills[0]).toBe(PINK);
  });
});

describe("replace_colors gradient target", () => {
  it("turns a matching solid into an evenly spaced linear gradient, keeping opacity", async () => {
    const { button } = buildTree();
    button.fills = [solid(1, 45 / 255, 85 / 255, 0.8)];
    await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], {
      mappings: [{ from: "#FF2D55", gradient: ["#6C47FF", "#8A6BFF", "#FF4F93"] }], nodeTypes: ["FRAME"],
    }));
    const f = button.fills[0];
    expect(f.type).toBe("GRADIENT_LINEAR");
    expect(f.gradientStops.map((s: any) => s.position)).toEqual([0, 0.5, 1]);
    expect(f.gradientStops[2].color.r).toBe(1);
    expect(f.opacity).toBe(0.8);
  });

  it("leaves gradient stops alone when the target is a gradient", async () => {
    const { button } = buildTree();
    const grad = { type: "GRADIENT_LINEAR", gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 1, g: 45 / 255, b: 85 / 255, a: 1 } }] };
    button.fills = [grad];
    await handleWriteStyleRequest(makeRequest("replace_colors", ["1:1"], { mappings: [{ from: "#FF2D55", gradient: ["#000000", "#FFFFFF"] }] }));
    expect(button.fills[0]).toBe(grad);
  });
});
