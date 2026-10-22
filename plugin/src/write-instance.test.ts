import { describe, it, expect, beforeEach } from "bun:test";
import { handleWriteComponentRequest } from "./write-components";

// ── Figma global mock ─────────────────────────────────────────────────────────

let mockNodes: Record<string, any>;
let commitUndoCalled: boolean;
let currentPage: any;

const makeRequest = (type: string, nodeIds?: string[], params?: any) => ({
  type,
  requestId: "req-test-1",
  nodeIds: nodeIds ?? [],
  params: params ?? {},
});

// Instance mock whose setProperties mirrors Figma: keys must match componentProperties exactly.
const makeInstance = (id: string, componentProperties: Record<string, any>) => {
  const inst: any = {
    id,
    name: "Button",
    type: "INSTANCE",
    x: 0,
    y: 0,
    componentProperties,
    setProperties(props: Record<string, any>) {
      for (const [k, v] of Object.entries(props)) {
        if (!(k in this.componentProperties)) throw new Error(`Unknown property ${k}`);
        this.componentProperties[k] = { ...this.componentProperties[k], value: v };
      }
    },
  };
  return inst;
};

const buttonProps = () => ({
  Size: { type: "VARIANT", value: "Medium" },
  "Label#12:0": { type: "TEXT", value: "Button" },
  "Show icon#12:1": { type: "BOOLEAN", value: false },
});

const makeComponent = (id: string) => ({
  id,
  name: "Button",
  type: "COMPONENT",
  createInstance() {
    const inst = makeInstance(`inst-of-${id}`, buttonProps());
    mockNodes[inst.id] = inst;
    return inst;
  },
});

beforeEach(() => {
  commitUndoCalled = false;
  mockNodes = {};
  currentPage = { id: "0:1", name: "Page 1", children: [], appendChild(c: any) { this.children.push(c); } };
  (globalThis as any).figma = {
    get currentPage() { return currentPage; },
    getNodeByIdAsync: async (id: string) => mockNodes[id] ?? null,
    commitUndo: () => { commitUndoCalled = true; },
  };
});

// ── create_instance ───────────────────────────────────────────────────────────

describe("create_instance", () => {
  it("creates an instance of a COMPONENT inside the parent at x/y", async () => {
    mockNodes["1:1"] = makeComponent("1:1");
    const parent = { id: "5:5", type: "FRAME", children: [] as any[], appendChild(c: any) { this.children.push(c); } };
    mockNodes["5:5"] = parent;
    const res = await handleWriteComponentRequest(makeRequest("create_instance", [], {
      componentId: "1:1", parentId: "5:5", x: 10, y: 20, name: "Primary CTA",
    }));
    const inst = parent.children[0];
    expect(inst.type).toBe("INSTANCE");
    expect(inst.x).toBe(10);
    expect(inst.y).toBe(20);
    expect(inst.name).toBe("Primary CTA");
    expect(res?.data.id).toBe(inst.id);
    expect(commitUndoCalled).toBe(true);
  });

  it("uses the default variant of a COMPONENT_SET", async () => {
    mockNodes["1:1"] = makeComponent("1:1");
    mockNodes["2:2"] = { id: "2:2", type: "COMPONENT_SET", defaultVariant: mockNodes["1:1"] };
    const res = await handleWriteComponentRequest(makeRequest("create_instance", [], { componentId: "2:2" }));
    expect(res?.data.id).toBe("inst-of-1:1");
    expect(currentPage.children).toHaveLength(1);
  });

  it("applies properties by display name on creation", async () => {
    mockNodes["1:1"] = makeComponent("1:1");
    const res = await handleWriteComponentRequest(makeRequest("create_instance", [], {
      componentId: "1:1", properties: { Size: "Large", Label: "Continue", "Show icon": true },
    }));
    expect(res?.data.properties).toEqual({ Size: "Large", Label: "Continue", "Show icon": true });
  });

  it("rejects nodes that are not components", async () => {
    mockNodes["1:1"] = { id: "1:1", type: "FRAME" };
    await expect(handleWriteComponentRequest(makeRequest("create_instance", [], { componentId: "1:1" })))
      .rejects.toThrow("not a COMPONENT or COMPONENT_SET");
  });

  it("throws when componentId is missing", async () => {
    await expect(handleWriteComponentRequest(makeRequest("create_instance", [], {}))).rejects.toThrow("componentId is required");
  });
});

// ── set_instance_properties ───────────────────────────────────────────────────

describe("set_instance_properties", () => {
  it("sets variant, text, and boolean properties using display names", async () => {
    mockNodes["3:3"] = makeInstance("3:3", buttonProps());
    const res = await handleWriteComponentRequest(makeRequest("set_instance_properties", ["3:3"], {
      properties: { Size: "Small", Label: "Save", "Show icon": true },
    }));
    expect(mockNodes["3:3"].componentProperties["Label#12:0"].value).toBe("Save");
    expect(res?.data.properties).toEqual({ Size: "Small", Label: "Save", "Show icon": true });
    expect(commitUndoCalled).toBe(true);
  });

  it("accepts full property keys with the #id suffix", async () => {
    mockNodes["3:3"] = makeInstance("3:3", buttonProps());
    await handleWriteComponentRequest(makeRequest("set_instance_properties", ["3:3"], { properties: { "Label#12:0": "OK" } }));
    expect(mockNodes["3:3"].componentProperties["Label#12:0"].value).toBe("OK");
  });

  it("lists available properties when a name is unknown", async () => {
    mockNodes["3:3"] = makeInstance("3:3", buttonProps());
    await expect(handleWriteComponentRequest(makeRequest("set_instance_properties", ["3:3"], { properties: { Color: "Red" } })))
      .rejects.toThrow("Unknown property 'Color'. Available: Size, Label, Show icon");
  });

  it("rejects nodes that are not instances", async () => {
    mockNodes["3:3"] = { id: "3:3", type: "FRAME" };
    await expect(handleWriteComponentRequest(makeRequest("set_instance_properties", ["3:3"], { properties: { Size: "Small" } })))
      .rejects.toThrow("is not a component INSTANCE");
  });

  it("throws when properties is empty", async () => {
    mockNodes["3:3"] = makeInstance("3:3", buttonProps());
    await expect(handleWriteComponentRequest(makeRequest("set_instance_properties", ["3:3"], { properties: {} })))
      .rejects.toThrow("properties is required");
  });
});

// ── Review fixes ──────────────────────────────────────────────────────────────

describe("review fixes", () => {
  it("create_instance removes the instance when properties are invalid", async () => {
    let removed = false;
    mockNodes["1:1"] = {
      id: "1:1", type: "COMPONENT",
      createInstance() {
        const inst = makeInstance("i:1", buttonProps());
        inst.remove = () => { removed = true; currentPage.children = currentPage.children.filter((c: any) => c !== inst); };
        return inst;
      },
    };
    await expect(handleWriteComponentRequest(makeRequest("create_instance", [], { componentId: "1:1", properties: { Nope: 1 } })))
      .rejects.toThrow("Unknown property 'Nope'");
    expect(removed).toBe(true);
    expect(currentPage.children).toHaveLength(0);
  });

  it("matches property names that contain '#'", async () => {
    mockNodes["3:3"] = makeInstance("3:3", { "Item #2#7:0": { type: "TEXT", value: "a" } });
    const res = await handleWriteComponentRequest(makeRequest("set_instance_properties", ["3:3"], { properties: { "Item #2": "b" } }));
    expect(res?.data.properties).toEqual({ "Item #2": "b" });
  });
});
