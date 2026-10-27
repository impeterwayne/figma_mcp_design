import { describe, it, expect, beforeEach } from "bun:test";
import { handleReadExportRequest } from "./read-export";

// ── Figma global mock ─────────────────────────────────────────────────────────

let exported: any[];

const makeNode = (id: string, width: number, height: number) => ({
  id,
  name: id,
  type: "FRAME",
  width,
  height,
  exportAsync: async (settings: any) => {
    exported.push(settings);
    return new Uint8Array([1]);
  },
});

const nodes: Record<string, any> = {
  "1:1": makeNode("1:1", 360, 800),
  "1:2": makeNode("1:2", 4000, 2000),
};

const makeRequest = (nodeIds: string[], params: any) => ({
  type: "get_screenshot",
  requestId: "req-test-1",
  nodeIds,
  params,
});

beforeEach(() => {
  exported = [];
  (globalThis as any).figma = {
    getNodeByIdAsync: async (id: string) => nodes[id] ?? null,
    base64Encode: () => "AQ==",
    currentPage: { selection: [] },
  };
});

// ── get_screenshot ────────────────────────────────────────────────────────────

describe("get_screenshot", () => {
  it("uses the requested scale when the image fits maxSize", async () => {
    const res: any = await handleReadExportRequest(makeRequest(["1:1"], { scale: 1, maxSize: 1600 }));
    expect(exported[0].constraint.value).toBe(1);
    expect(res.data.exports[0].downscaled).toBeUndefined();
  });

  it("lowers the scale so the longest side stays within maxSize", async () => {
    const res: any = await handleReadExportRequest(makeRequest(["1:2"], { scale: 1, maxSize: 1600 }));
    expect(exported[0].constraint.value).toBe(0.4);
    expect(res.data.exports[0]).toMatchObject({ scale: 0.4, downscaled: true });
  });

  it("keeps scale 2 and no cap when maxSize is not given", async () => {
    await handleReadExportRequest(makeRequest(["1:2"], {}));
    expect(exported[0].constraint.value).toBe(2);
  });
});
