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

const SPACING = { "4": "V:s4", "8": "V:s8", "12": "V:s12", "16": "V:s16", "24": "V:s24" };
const RADIUS = { "8": "V:r8", "12": "V:r12", "16": "V:r16", "999": "V:full" };

const makeNode = (id: string, props: any) => {
  const node: any = {
    id, type: "FRAME", width: 200, height: 48, layoutMode: "HORIZONTAL", cornerRadius: 0,
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, itemSpacing: 0,
    bound: {} as Record<string, string>,
    setBoundVariable(field: string, variable: any) { this.bound[field] = variable.id; },
    ...props,
  };
  mockNodes[id] = node;
  return node;
};

beforeEach(() => {
  commitUndoCalled = false;
  mockNodes = {};
  (globalThis as any).figma = {
    mixed: MIXED,
    getNodeByIdAsync: async (id: string) => mockNodes[id] ?? null,
    commitUndo: () => { commitUndoCalled = true; },
    variables: { getVariableByIdAsync: async (id: string) => ({ id }) },
  };
});

describe("snap_to_tokens", () => {
  it("binds auto-layout spacing to the nearest spacing variable", async () => {
    const n = makeNode("1:1", { paddingLeft: 10, paddingRight: 15, itemSpacing: 6, paddingTop: 0 });
    const res = await handleWriteStyleRequest(makeRequest("snap_to_tokens", ["1:1"], { spacingVariables: SPACING, radiusVariables: RADIUS }));
    expect(n.bound.paddingLeft).toBe("V:s8");
    expect(n.bound.paddingRight).toBe("V:s16");
    expect(n.bound.itemSpacing).toBe("V:s4");
    expect(n.bound.paddingTop).toBeUndefined();
    expect(res?.data.spacing["10→8"]).toBe(1);
    expect(commitUndoCalled).toBe(true);
  });

  it("ignores spacing on frames without auto-layout", async () => {
    const n = makeNode("1:1", { layoutMode: "NONE", paddingLeft: 10 });
    await handleWriteStyleRequest(makeRequest("snap_to_tokens", ["1:1"], { spacingVariables: SPACING, radiusVariables: RADIUS }));
    expect(n.bound.paddingLeft).toBeUndefined();
  });

  it("snaps radius, using full for pills", async () => {
    const card = makeNode("1:1", { cornerRadius: 10, height: 120, children: [] as any[] });
    const pill = makeNode("1:2", { cornerRadius: 24, height: 48 });
    card.children.push(pill);
    const res = await handleWriteStyleRequest(makeRequest("snap_to_tokens", ["1:1"], { spacingVariables: SPACING, radiusVariables: RADIUS }));
    for (const corner of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) {
      expect(card.bound[corner]).toBe("V:r8");
      expect(pill.bound[corner]).toBe("V:full");
    }
    expect(res?.data.radius["24→full"]).toBe(1);
  });

  it("snaps mixed corner radii per corner and skips zero corners", async () => {
    const n = makeNode("1:1", { cornerRadius: MIXED, topLeftRadius: 16, topRightRadius: 15, bottomLeftRadius: 0, bottomRightRadius: 0, height: 300 });
    await handleWriteStyleRequest(makeRequest("snap_to_tokens", ["1:1"], { spacingVariables: SPACING, radiusVariables: RADIUS }));
    expect(n.bound.topLeftRadius).toBe("V:r16");
    expect(n.bound.topRightRadius).toBe("V:r16");
    expect(n.bound.bottomLeftRadius).toBeUndefined();
  });

  it("skips text, vectors and instance internals", async () => {
    const text = makeNode("1:2", { type: "TEXT", cornerRadius: 10 });
    const inner = makeNode("I1:3;2:1", { paddingLeft: 10 });
    const inst = makeNode("1:3", { type: "INSTANCE", children: [inner] });
    makeNode("1:1", { children: [text, inst] });
    await handleWriteStyleRequest(makeRequest("snap_to_tokens", ["1:1"], { spacingVariables: SPACING, radiusVariables: RADIUS }));
    expect(text.bound.topLeftRadius).toBeUndefined();
    expect(inner.bound.paddingLeft).toBeUndefined();
  });

  it("dryRun reports changes without binding", async () => {
    const n = makeNode("1:1", { paddingLeft: 10, cornerRadius: 10, height: 120 });
    const res = await handleWriteStyleRequest(makeRequest("snap_to_tokens", ["1:1"], { spacingVariables: SPACING, radiusVariables: RADIUS, dryRun: true }));
    expect(res?.data.spacing["10→8"]).toBe(1);
    expect(res?.data.radius["10→8"]).toBe(1);
    expect(Object.keys(n.bound)).toHaveLength(0);
    expect(commitUndoCalled).toBe(false);
  });

  it("requires both variable maps", async () => {
    makeNode("1:1", {});
    await expect(handleWriteStyleRequest(makeRequest("snap_to_tokens", ["1:1"], { spacingVariables: SPACING })))
      .rejects.toThrow("radiusVariables is required");
  });
});

describe("snap_to_tokens limits", () => {
  it("leaves spacing well above the largest step untouched", async () => {
    const n = makeNode("1:1", { paddingLeft: 80, paddingTop: 26 });
    const res = await handleWriteStyleRequest(makeRequest("snap_to_tokens", ["1:1"], { spacingVariables: SPACING, radiusVariables: RADIUS }));
    expect(n.bound.paddingLeft).toBeUndefined();
    expect(n.bound.paddingTop).toBe("V:s24");
    expect(res?.data.skipped["80"]).toBe(1);
  });
});
