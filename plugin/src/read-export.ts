export const handleReadExportRequest = async (request: any) => {
  switch (request.type) {
    case "get_screenshot": {
      const format =
        request.params && request.params.format
          ? request.params.format
          : "PNG";
      const scale =
        request.params && request.params.scale != null
          ? request.params.scale
          : 2;
      let targetNodes: any[];
      if (request.nodeIds && request.nodeIds.length > 0) {
        const nodes = await Promise.all(
          request.nodeIds.map((id: string) => figma.getNodeByIdAsync(id)),
        );
        targetNodes = nodes.filter(
          (n) => n !== null && n.type !== "DOCUMENT" && n.type !== "PAGE",
        );
      } else {
        targetNodes = figma.currentPage.selection.slice();
      }
      if (targetNodes.length === 0)
        throw new Error(
          "No nodes to export. Select nodes or provide nodeIds.",
        );
      // maxSize caps the longest side of a raster image in pixels, so a large
      // node is exported smaller instead of flooding the response.
      const maxSize =
        request.params && request.params.maxSize > 0
          ? request.params.maxSize
          : 0;
      const exports = await Promise.all(
        targetNodes.map(async (node: any) => {
          const longest = Math.max(node.width || 0, node.height || 0);
          const nodeScale =
            maxSize && longest * scale > maxSize ? maxSize / longest : scale;
          const settings: any =
            format === "SVG"
              ? { format: "SVG" }
              : format === "PDF"
                ? { format: "PDF" }
                : format === "JPG"
                  ? {
                      format: "JPG",
                      constraint: { type: "SCALE", value: nodeScale },
                    }
                  : {
                      format: "PNG",
                      constraint: { type: "SCALE", value: nodeScale },
                    };
          const bytes = await node.exportAsync(settings);
          const base64 = figma.base64Encode(bytes);
          return {
            nodeId: node.id,
            nodeName: node.name,
            format,
            base64,
            width: node.width,
            height: node.height,
            ...(nodeScale !== scale ? { scale: nodeScale, downscaled: true } : {}),
          };
        }),
      );
      return {
        type: request.type,
        requestId: request.requestId,
        data: { exports },
      };
    }

    case "export_frames_to_pdf": {
      const nodeIds: string[] = request.nodeIds ?? [];
      if (nodeIds.length === 0) {
        throw new Error("nodeIds is required and must not be empty");
      }
      const frames: any[] = [];
      for (const id of nodeIds) {
        const node = await figma.getNodeByIdAsync(id);
        if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
          throw new Error(`Node ${id} not found or is not exportable`);
        }
        const bytes = await (node as any).exportAsync({ format: "PDF" });
        const base64 = figma.base64Encode(bytes);
        frames.push({
          nodeId: node.id,
          nodeName: node.name,
          base64,
        });
      }
      return {
        type: request.type,
        requestId: request.requestId,
        data: { frames },
      };
    }

    default:
      return null;
  }
};
