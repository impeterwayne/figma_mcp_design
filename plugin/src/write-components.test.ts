import { describe, it, expect, beforeEach } from "bun:test";
import { handleWriteComponentRequest } from "./write-components";

// ── Figma global mock ─────────────────────────────────────────────────────────

let mockNodes: Record<string, any>;
let commitUndoCalled: boolean;
let navigatedTo: any;

const makeRequest = (type: string, nodeIds?: string[], params?: any) => ({
  type,
  requestId: "req-test-1",
  nodeIds: nodeIds ?? [],
  params: params ?? {},
});

beforeEach(() => {
  commitUndoCalled = false;
  navigatedTo = null;
  mockNodes = {};
  (globalThis as any).figma = {
    get currentPage() { return { id: "0:1", name: "Page 1" }; },
    setCurrentPageAsync: async (page: any) => { navigatedTo = page; },
    getNodeByIdAsync: async (id: string) => mockNodes[id] ?? null,
    group: (nodes: any[], parent: any) => {
      const group = { id: "grp:1", name: "Group 1", type: "GROUP", children: [...nodes] };
      (parent as any).children = (parent as any).children ?? [];
      (parent as any).children.push(group);
      return group;
    },
    root: {
      children: [
        { id: "0:1", name: "Page 1", type: "PAGE" },
        { id: "0:2", name: "Page 2", type: "PAGE" },
      ],
    },
    commitUndo: () => { commitUndoCalled = true; },
  };
});

// ── navigate_to_page ──────────────────────────────────────────────────────────

describe("navigate_to_page", () => {
  it("navigates by pageId", async () => {
    mockNodes["0:2"] = { id: "0:2", name: "Page 2", type: "PAGE" };
    const res = await handleWriteComponentRequest(makeRequest("navigate_to_page", [], { pageId: "0:2" }));
    expect(navigatedTo?.id).toBe("0:2");
    expect(res?.data.id).toBe("0:2");
    expect(res?.data.name).toBe("Page 2");
  });

  it("navigates by pageName", async () => {
    const res = await handleWriteComponentRequest(makeRequest("navigate_to_page", [], { pageName: "Page 2" }));
    expect(navigatedTo?.name).toBe("Page 2");
    expect(res?.data.name).toBe("Page 2");
  });

  it("throws when pageId node not found", async () => {
    await expect(
      handleWriteComponentRequest(makeRequest("navigate_to_page", [], { pageId: "9:9" }))
    ).rejects.toThrow("Page not found: 9:9");
  });

  it("throws when pageId node is not a PAGE", async () => {
    mockNodes["1:1"] = { id: "1:1", name: "Frame", type: "FRAME" };
    await expect(
      handleWriteComponentRequest(makeRequest("navigate_to_page", [], { pageId: "1:1" }))
    ).rejects.toThrow("is not a PAGE");
  });

  it("throws when pageName not found", async () => {
    await expect(
      handleWriteComponentRequest(makeRequest("navigate_to_page", [], { pageName: "Nonexistent" }))
    ).rejects.toThrow("Page not found");
  });

  it("throws when neither pageId nor pageName provided", async () => {
    await expect(
      handleWriteComponentRequest(makeRequest("navigate_to_page", [], {}))
    ).rejects.toThrow("pageId or pageName is required");
  });
});

// ── group_nodes ───────────────────────────────────────────────────────────────

describe("group_nodes", () => {
  it("groups nodes and returns the GROUP", async () => {
    const parent = { id: "0:1", children: [] as any[], appendChild: () => {} };
    mockNodes["1:1"] = { id: "1:1", type: "RECTANGLE", parent };
    mockNodes["2:2"] = { id: "2:2", type: "RECTANGLE", parent };
    const res = await handleWriteComponentRequest(makeRequest("group_nodes", ["1:1", "2:2"]));
    expect(res?.data.type).toBe("GROUP");
    expect(commitUndoCalled).toBe(true);
  });

  it("applies custom name to the group", async () => {
    const parent = { id: "0:1", children: [] as any[], appendChild: () => {} };
    mockNodes["1:1"] = { id: "1:1", type: "FRAME", parent };
    mockNodes["2:2"] = { id: "2:2", type: "FRAME", parent };
    const res = await handleWriteComponentRequest(
      makeRequest("group_nodes", ["1:1", "2:2"], { name: "My Group" })
    );
    expect(res?.data.name).toBe("My Group");
  });

  it("throws for empty nodeIds", async () => {
    await expect(handleWriteComponentRequest(makeRequest("group_nodes", []))).rejects.toThrow("nodeIds is required");
  });

  it("throws when no valid nodes found", async () => {
    await expect(
      handleWriteComponentRequest(makeRequest("group_nodes", ["9:9", "8:8"]))
    ).rejects.toThrow("No valid scene nodes found");
  });
});

// ── ungroup_nodes ─────────────────────────────────────────────────────────────

describe("ungroup_nodes", () => {
  it("ungroups a GROUP node and returns child IDs", async () => {
    const child1 = { id: "3:1", type: "RECTANGLE" };
    const child2 = { id: "3:2", type: "RECTANGLE" };
    let removed = false;
    const parent = {
      id: "0:1",
      children: [] as any[],
      insertChild(_idx: number, child: any) { this.children.push(child); },
    };
    const group = {
      id: "grp:1", type: "GROUP",
      children: [child1, child2],
      parent,
      remove() { removed = true; },
    };
    parent.children = [group];
    mockNodes["grp:1"] = group;

    const res = await handleWriteComponentRequest(makeRequest("ungroup_nodes", ["grp:1"]));
    expect(res?.data.results[0].childIds).toEqual(["3:1", "3:2"]);
    expect(removed).toBe(true);
    expect(commitUndoCalled).toBe(true);
  });

  it("reports error for missing node", async () => {
    const res = await handleWriteComponentRequest(makeRequest("ungroup_nodes", ["9:9"]));
    expect(res?.data.results[0].error).toBe("Node not found");
  });

  it("reports error when node is not a GROUP", async () => {
    mockNodes["1:1"] = { id: "1:1", type: "FRAME" };
    const res = await handleWriteComponentRequest(makeRequest("ungroup_nodes", ["1:1"]));
    expect(res?.data.results[0].error).toBe("Node is not a GROUP");
  });

  it("throws for empty nodeIds", async () => {
    await expect(
      handleWriteComponentRequest(makeRequest("ungroup_nodes", []))
    ).rejects.toThrow("nodeIds is required");
  });

  it("returns null for unrecognised type", async () => {
    const res = await handleWriteComponentRequest(makeRequest("unknown_op"));
    expect(res).toBeNull();
  });
});

// ── boolean_operation ─────────────────────────────────────────────────────────

describe("boolean_operation", () => {
  let calls: { op: string; nodes: any[]; parent: any; index: number }[];
  let parent: any;

  const setup = () => {
    calls = [];
    parent = { id: "1:0", children: [] as any[] };
    const shapes = ["1:1", "1:2", "1:3", "1:4"].map((id) => ({ id, type: "ELLIPSE", parent }));
    parent.children = [...shapes];
    for (const s of shapes) mockNodes[s.id] = s;
    const f = (globalThis as any).figma;
    for (const [op, type] of [["union", "BOOLEAN_OPERATION"], ["subtract", "BOOLEAN_OPERATION"], ["intersect", "BOOLEAN_OPERATION"], ["exclude", "BOOLEAN_OPERATION"], ["flatten", "VECTOR"]]) {
      f[op] = (nodes: any[], par: any, index: number) => {
        calls.push({ op, nodes, parent: par, index });
        return { id: "res:1", name: op, type, x: 0, y: 0, width: 10, height: 10 };
      };
    }
  };

  it("runs each operation with the shared parent", async () => {
    setup();
    for (const op of ["UNION", "SUBTRACT", "INTERSECT", "EXCLUDE"]) {
      const res = await handleWriteComponentRequest(makeRequest("boolean_operation", ["1:2", "1:3"], { operation: op }));
      expect(res?.data.type).toBe("BOOLEAN_OPERATION");
    }
    expect(calls.map((c) => c.op)).toEqual(["union", "subtract", "intersect", "exclude"]);
    expect(calls[0].parent).toBe(parent);
    expect(commitUndoCalled).toBe(true);
  });

  it("inserts at the lowest source layer index to keep stacking order", async () => {
    setup();
    await handleWriteComponentRequest(makeRequest("boolean_operation", ["1:4", "1:2"], { operation: "UNION" }));
    expect(calls[0].index).toBe(1);
  });

  it("flattens a single node and applies the name", async () => {
    setup();
    const res = await handleWriteComponentRequest(makeRequest("boolean_operation", ["1:3"], { operation: "flatten", name: "Logo" }));
    expect(calls[0].op).toBe("flatten");
    expect(res?.data).toMatchObject({ id: "res:1", type: "VECTOR", name: "Logo", bounds: { width: 10 } });
  });

  it("rejects bad input", async () => {
    setup();
    mockNodes["9:1"] = { id: "9:1", type: "ELLIPSE", parent: { id: "9:0", children: [] } };
    await expect(handleWriteComponentRequest(makeRequest("boolean_operation", ["1:1"], { operation: "UNION" }))).rejects.toThrow("at least 2");
    await expect(handleWriteComponentRequest(makeRequest("boolean_operation", ["1:1", "1:2"], { operation: "MERGE" }))).rejects.toThrow("operation must be");
    await expect(handleWriteComponentRequest(makeRequest("boolean_operation", ["1:1", "9:1"], { operation: "UNION" }))).rejects.toThrow("same parent");
    await expect(handleWriteComponentRequest(makeRequest("boolean_operation", ["1:1", "8:8"], { operation: "UNION" }))).rejects.toThrow("not found");
    expect(calls).toHaveLength(0);
  });
});
