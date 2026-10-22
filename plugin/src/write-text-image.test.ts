import { describe, it, expect, beforeEach } from "bun:test";
import { handleWriteModifyRequest } from "./write-modify";

// ── Figma global mock ─────────────────────────────────────────────────────────

let mockNodes: Record<string, any>;
let commitUndoCalled: boolean;
let loadedFonts: any[];

const makeRequest = (type: string, nodeIds?: string[], params?: any) => ({
  type,
  requestId: "req-test-1",
  nodeIds: nodeIds ?? [],
  params: params ?? {},
});

const MIXED = Symbol("mixed");

const makeTextNode = (id: string, overrides: any = {}) => ({
  id,
  name: "Label",
  type: "TEXT",
  characters: "Hello",
  fontName: { family: "Inter", style: "Regular" },
  fontSize: 14,
  lineHeight: { unit: "AUTO" },
  letterSpacing: { unit: "PIXELS", value: 0 },
  textAlignHorizontal: "LEFT",
  textAlignVertical: "TOP",
  textCase: "ORIGINAL",
  textDecoration: "NONE",
  textAutoResize: "WIDTH_AND_HEIGHT",
  getRangeAllFontNames: function () { return [this.fontName]; },
  ...overrides,
});

beforeEach(() => {
  commitUndoCalled = false;
  loadedFonts = [];
  mockNodes = {};
  (globalThis as any).figma = {
    mixed: MIXED,
    getNodeByIdAsync: async (id: string) => mockNodes[id] ?? null,
    loadFontAsync: async (font: any) => { loadedFonts.push(font); },
    createImage: (_bytes: Uint8Array) => ({ hash: "img-hash-1" }),
    commitUndo: () => { commitUndoCalled = true; },
  };
});

// ── set_text_properties ───────────────────────────────────────────────────────

describe("set_text_properties", () => {
  it("sets font size, weight style, and alignment on a text node", async () => {
    mockNodes["1:1"] = makeTextNode("1:1");
    const res = await handleWriteModifyRequest(makeRequest("set_text_properties", ["1:1"], {
      fontStyle: "Bold", fontSize: 24, textAlignHorizontal: "CENTER",
    }));
    const n = mockNodes["1:1"];
    expect(n.fontName).toEqual({ family: "Inter", style: "Bold" });
    expect(n.fontSize).toBe(24);
    expect(n.textAlignHorizontal).toBe("CENTER");
    expect(res?.data.results[0].nodeId).toBe("1:1");
    expect(res?.data.results[0].error).toBeUndefined();
    expect(commitUndoCalled).toBe(true);
  });

  it("loads both the current and the new font before editing", async () => {
    mockNodes["1:1"] = makeTextNode("1:1");
    await handleWriteModifyRequest(makeRequest("set_text_properties", ["1:1"], { fontFamily: "Roboto" }));
    expect(loadedFonts).toContainEqual({ family: "Inter", style: "Regular" });
    expect(loadedFonts).toContainEqual({ family: "Roboto", style: "Regular" });
    expect(mockNodes["1:1"].fontName).toEqual({ family: "Roboto", style: "Regular" });
  });

  it("parses line height and letter spacing in pixels, percent, and AUTO", async () => {
    mockNodes["1:1"] = makeTextNode("1:1");
    mockNodes["2:2"] = makeTextNode("2:2");
    await handleWriteModifyRequest(makeRequest("set_text_properties", ["1:1"], { lineHeight: 24, letterSpacing: "-2%" }));
    await handleWriteModifyRequest(makeRequest("set_text_properties", ["2:2"], { lineHeight: "150%", letterSpacing: 1 }));
    expect(mockNodes["1:1"].lineHeight).toEqual({ unit: "PIXELS", value: 24 });
    expect(mockNodes["1:1"].letterSpacing).toEqual({ unit: "PERCENT", value: -2 });
    expect(mockNodes["2:2"].lineHeight).toEqual({ unit: "PERCENT", value: 150 });
    expect(mockNodes["2:2"].letterSpacing).toEqual({ unit: "PIXELS", value: 1 });

    await handleWriteModifyRequest(makeRequest("set_text_properties", ["1:1"], { lineHeight: "AUTO" }));
    expect(mockNodes["1:1"].lineHeight).toEqual({ unit: "AUTO" });
  });

  it("sets case, decoration, vertical alignment, and auto-resize", async () => {
    mockNodes["1:1"] = makeTextNode("1:1");
    await handleWriteModifyRequest(makeRequest("set_text_properties", ["1:1"], {
      textCase: "UPPER", textDecoration: "UNDERLINE", textAlignVertical: "CENTER", textAutoResize: "HEIGHT",
    }));
    const n = mockNodes["1:1"];
    expect(n.textCase).toBe("UPPER");
    expect(n.textDecoration).toBe("UNDERLINE");
    expect(n.textAlignVertical).toBe("CENTER");
    expect(n.textAutoResize).toBe("HEIGHT");
  });

  it("loads every font of a mixed-font node", async () => {
    mockNodes["1:1"] = makeTextNode("1:1", {
      fontName: MIXED,
      getRangeAllFontNames: () => [{ family: "Inter", style: "Regular" }, { family: "Inter", style: "Bold" }],
    });
    await handleWriteModifyRequest(makeRequest("set_text_properties", ["1:1"], { fontSize: 18 }));
    expect(loadedFonts).toContainEqual({ family: "Inter", style: "Bold" });
    expect(mockNodes["1:1"].fontSize).toBe(18);
  });

  it("applies to several nodes and reports per-node errors", async () => {
    mockNodes["1:1"] = makeTextNode("1:1");
    mockNodes["2:2"] = { id: "2:2", type: "FRAME" };
    const res = await handleWriteModifyRequest(makeRequest("set_text_properties", ["1:1", "2:2", "9:9"], { fontSize: 20 }));
    const results = res?.data.results;
    expect(results).toHaveLength(3);
    expect(mockNodes["1:1"].fontSize).toBe(20);
    expect(results[1].error).toContain("not a TEXT node");
    expect(results[2].error).toBe("Node not found");
  });

  it("throws when nodeIds is empty", async () => {
    await expect(handleWriteModifyRequest(makeRequest("set_text_properties", [], { fontSize: 12 }))).rejects.toThrow("nodeIds is required");
  });
});

// ── set_text batch ────────────────────────────────────────────────────────────

describe("set_text with items", () => {
  it("updates several text nodes in one call", async () => {
    mockNodes["1:1"] = makeTextNode("1:1");
    mockNodes["2:2"] = makeTextNode("2:2");
    const res = await handleWriteModifyRequest(makeRequest("set_text", [], {
      items: [{ nodeId: "1:1", text: "Sign in" }, { nodeId: "2:2", text: "Forgot password?" }],
    }));
    expect(mockNodes["1:1"].characters).toBe("Sign in");
    expect(mockNodes["2:2"].characters).toBe("Forgot password?");
    expect(res?.data.results).toHaveLength(2);
    expect(commitUndoCalled).toBe(true);
  });

  it("reports per-item errors without stopping the batch", async () => {
    mockNodes["2:2"] = makeTextNode("2:2");
    const res = await handleWriteModifyRequest(makeRequest("set_text", [], {
      items: [{ nodeId: "9:9", text: "x" }, { nodeId: "2:2", text: "ok" }],
    }));
    expect(res?.data.results[0].error).toBe("Node not found");
    expect(mockNodes["2:2"].characters).toBe("ok");
  });

  it("still supports the single nodeId form", async () => {
    mockNodes["1:1"] = makeTextNode("1:1");
    const res = await handleWriteModifyRequest(makeRequest("set_text", ["1:1"], { text: "Single" }));
    expect(res?.data.characters).toBe("Single");
  });
});

// ── set_image_fill ────────────────────────────────────────────────────────────

describe("set_image_fill", () => {
  it("replaces fills with an image paint on each node", async () => {
    mockNodes["1:1"] = { id: "1:1", type: "RECTANGLE", fills: [] };
    mockNodes["2:2"] = { id: "2:2", type: "FRAME", fills: [] };
    const res = await handleWriteModifyRequest(makeRequest("set_image_fill", ["1:1", "2:2"], {
      imageData: "iVBORw0KGgo=", scaleMode: "FIT",
    }));
    expect(mockNodes["1:1"].fills).toEqual([{ type: "IMAGE", imageHash: "img-hash-1", scaleMode: "FIT" }]);
    expect(mockNodes["2:2"].fills[0].imageHash).toBe("img-hash-1");
    expect(res?.data.imageHash).toBe("img-hash-1");
    expect(commitUndoCalled).toBe(true);
  });

  it("defaults scaleMode to FILL", async () => {
    mockNodes["1:1"] = { id: "1:1", type: "RECTANGLE", fills: [] };
    await handleWriteModifyRequest(makeRequest("set_image_fill", ["1:1"], { imageData: "iVBORw0KGgo=" }));
    expect(mockNodes["1:1"].fills[0].scaleMode).toBe("FILL");
  });

  it("reports nodes that cannot hold fills", async () => {
    mockNodes["1:1"] = { id: "1:1", type: "GROUP" };
    const res = await handleWriteModifyRequest(makeRequest("set_image_fill", ["1:1", "9:9"], { imageData: "iVBORw0KGgo=" }));
    expect(res?.data.results[0].error).toContain("does not support fills");
    expect(res?.data.results[1].error).toBe("Node not found");
  });

  it("throws when imageData is missing", async () => {
    await expect(handleWriteModifyRequest(makeRequest("set_image_fill", ["1:1"], {}))).rejects.toThrow("imageData (base64) is required");
  });
});

// ── Review fixes ──────────────────────────────────────────────────────────────

describe("review fixes", () => {
  it("set_text items reports a font load failure per item and keeps going", async () => {
    mockNodes["1:1"] = makeTextNode("1:1", { fontName: { family: "Missing", style: "Regular" } });
    mockNodes["2:2"] = makeTextNode("2:2");
    (globalThis as any).figma.loadFontAsync = async (f: any) => {
      if (f.family === "Missing") throw new Error("font unavailable");
    };
    const res = await handleWriteModifyRequest(makeRequest("set_text", [], {
      items: [{ nodeId: "1:1", text: "a" }, { nodeId: "2:2", text: "b" }],
    }));
    expect(res?.data.results[0].error).toContain("font unavailable");
    expect(mockNodes["2:2"].characters).toBe("b");
    expect(commitUndoCalled).toBe(true);
  });

  it("set_text single form loads every font of a mixed-font node", async () => {
    mockNodes["1:1"] = makeTextNode("1:1", {
      fontName: MIXED,
      getRangeAllFontNames: () => [{ family: "Roboto", style: "Bold" }],
    });
    await handleWriteModifyRequest(makeRequest("set_text", ["1:1"], { text: "x" }));
    expect(loadedFonts).toContainEqual({ family: "Roboto", style: "Bold" });
  });

  it("set_image_fill accepts a data URL", async () => {
    let received: Uint8Array | null = null;
    (globalThis as any).figma.createImage = (b: Uint8Array) => { received = b; return { hash: "h" }; };
    mockNodes["1:1"] = { id: "1:1", type: "RECTANGLE", fills: [] };
    await handleWriteModifyRequest(makeRequest("set_image_fill", ["1:1"], { imageData: "data:image/png;base64,AAEC" }));
    expect(Array.from(received!)).toEqual([0, 1, 2]);
  });
});

describe("set_text_properties with a missing current font", () => {
  it("still switches the font when the current font cannot be loaded", async () => {
    mockNodes["1:1"] = makeTextNode("1:1", { fontName: { family: "SF Pro Text", style: "Semibold" } });
    (globalThis as any).figma.loadFontAsync = async (f: any) => {
      if (f.family === "SF Pro Text") throw new Error("could not be loaded");
      loadedFonts.push(f);
    };
    const res = await handleWriteModifyRequest(makeRequest("set_text_properties", ["1:1"], {
      fontFamily: "Poppins", fontStyle: "SemiBold", fontSize: 16,
    }));
    expect(res?.data.results[0].error).toBeUndefined();
    expect(mockNodes["1:1"].fontName).toEqual({ family: "Poppins", style: "SemiBold" });
    expect(mockNodes["1:1"].fontSize).toBe(16);
  });

  it("still reports the error when no font change is requested", async () => {
    mockNodes["1:1"] = makeTextNode("1:1", { fontName: { family: "SF Pro Text", style: "Semibold" } });
    (globalThis as any).figma.loadFontAsync = async () => { throw new Error("could not be loaded"); };
    const res = await handleWriteModifyRequest(makeRequest("set_text_properties", ["1:1"], { fontSize: 16 }));
    expect(res?.data.results[0].error).toContain("could not be loaded");
  });
});
