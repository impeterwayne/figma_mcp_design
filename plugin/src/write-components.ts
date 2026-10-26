import { getBounds } from "./serializers";
import { getParentNode } from "./write-helpers";

// Display name of a component property: "Label#12:0" -> "Label". Variant keys have no suffix,
// and only the trailing "#<id>" is stripped so names containing '#' survive.
const propertyDisplayName = (key: string) => key.replace(/#\d+:\d+$/, "");

// Maps display names (or full keys) to the exact keys setProperties expects.
const resolvePropertyKeys = (instance: InstanceNode, props: Record<string, any>) => {
  const keys = Object.keys(instance.componentProperties);
  const resolved: Record<string, any> = {};
  for (const [name, value] of Object.entries(props)) {
    const key = keys.includes(name) ? name : keys.find(k => propertyDisplayName(k) === name);
    if (!key) {
      throw new Error(`Unknown property '${name}'. Available: ${keys.map(propertyDisplayName).join(", ")}`);
    }
    resolved[key] = value;
  }
  return resolved;
};

const summarizeProperties = (instance: InstanceNode) => {
  const out: Record<string, any> = {};
  for (const [key, prop] of Object.entries(instance.componentProperties)) {
    out[propertyDisplayName(key)] = (prop as any).value;
  }
  return out;
};

export const handleWriteComponentRequest = async (request: any) => {
  switch (request.type) {
    case "create_instance": {
      const p = request.params || {};
      if (!p.componentId) throw new Error("componentId is required");
      const source = await figma.getNodeByIdAsync(p.componentId) as any;
      if (!source) throw new Error(`Component not found: ${p.componentId}`);
      let component: ComponentNode;
      if (source.type === "COMPONENT") component = source;
      else if (source.type === "COMPONENT_SET") component = source.defaultVariant;
      else throw new Error(`Node ${p.componentId} is not a COMPONENT or COMPONENT_SET`);
      const parent = await getParentNode(p.parentId);
      const instance = component.createInstance();
      (parent as any).appendChild(instance);
      if (p.x != null) instance.x = Number(p.x);
      if (p.y != null) instance.y = Number(p.y);
      if (p.name) instance.name = p.name;
      if (p.properties && Object.keys(p.properties).length > 0) {
        try {
          instance.setProperties(resolvePropertyKeys(instance, p.properties));
        } catch (err) {
          instance.remove();
          throw err;
        }
      }
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: instance.id, name: instance.name, componentId: component.id, properties: summarizeProperties(instance) },
      };
    }

    case "set_instance_properties": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (node.type !== "INSTANCE") throw new Error(`Node ${nodeId} is not a component INSTANCE`);
      if (!p.properties || Object.keys(p.properties).length === 0) throw new Error("properties is required");
      node.setProperties(resolvePropertyKeys(node, p.properties));
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name, properties: summarizeProperties(node) },
      };
    }

    case "swap_component": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      if (!p.componentId) throw new Error("componentId is required");
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (node.type !== "INSTANCE") throw new Error(`Node ${nodeId} is not a component INSTANCE`);
      const component = await figma.getNodeByIdAsync(p.componentId);
      if (!component) throw new Error(`Component not found: ${p.componentId}`);
      if (component.type !== "COMPONENT") throw new Error(`Node ${p.componentId} is not a COMPONENT`);
      node.mainComponent = component;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name, componentId: component.id, componentName: component.name },
      };
    }

    case "detach_instance": {
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid);
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        if (n.type !== "INSTANCE") { results.push({ nodeId: nid, error: "Node is not an INSTANCE" }); continue; }
        const frame = n.detachInstance();
        results.push({ nodeId: nid, newId: frame.id, name: frame.name });
      }
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { results },
      };
    }

    case "delete_nodes": {
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid);
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        n.remove();
        results.push({ nodeId: nid, deleted: true });
      }
      figma.commitUndo();
      return { type: request.type, requestId: request.requestId, data: { results } };
    }

    case "navigate_to_page": {
      const p = request.params || {};
      let page: PageNode | undefined;
      if (p.pageId) {
        const found = await figma.getNodeByIdAsync(p.pageId);
        if (!found) throw new Error(`Page not found: ${p.pageId}`);
        if (found.type !== "PAGE") throw new Error(`Node ${p.pageId} is not a PAGE`);
        page = found as PageNode;
      } else if (p.pageName) {
        page = figma.root.children.find(pg => pg.name === p.pageName) as PageNode | undefined;
        if (!page) throw new Error(`Page not found with name: ${p.pageName}`);
      } else {
        throw new Error("pageId or pageName is required");
      }
      await figma.setCurrentPageAsync(page);
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: page.id, name: page.name },
      };
    }

    case "group_nodes": {
      const p = request.params || {};
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const nodes = await Promise.all(nodeIds.map((id: string) => figma.getNodeByIdAsync(id)));
      const validNodes = nodes.filter((n): n is SceneNode => n !== null && n.type !== "DOCUMENT" && n.type !== "PAGE");
      if (validNodes.length === 0) throw new Error("No valid scene nodes found");
      const parent = validNodes[0].parent;
      if (!parent) throw new Error("Nodes must have a parent");
      const group = figma.group(validNodes, parent as any);
      if (p.name) group.name = p.name;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: group.id, name: group.name, type: group.type },
      };
    }

    case "boolean_operation": {
      const p = request.params || {};
      const nodeIds: string[] = request.nodeIds || [];
      const op = String(p.operation || "").toUpperCase();
      const combine: Record<string, (nodes: SceneNode[], parent: any, index: number) => SceneNode> = {
        UNION: (n, parent, i) => figma.union(n, parent, i),
        SUBTRACT: (n, parent, i) => figma.subtract(n, parent, i),
        INTERSECT: (n, parent, i) => figma.intersect(n, parent, i),
        EXCLUDE: (n, parent, i) => figma.exclude(n, parent, i),
        FLATTEN: (n, parent, i) => figma.flatten(n, parent, i),
      };
      if (!combine[op]) throw new Error(`operation must be UNION, SUBTRACT, INTERSECT, EXCLUDE or FLATTEN, got: ${p.operation}`);
      if (nodeIds.length < (op === "FLATTEN" ? 1 : 2)) throw new Error(`${op} needs at least ${op === "FLATTEN" ? 1 : 2} node(s)`);

      const nodes: SceneNode[] = [];
      for (const id of nodeIds) {
        const n = await figma.getNodeByIdAsync(id);
        if (!n || n.type === "DOCUMENT" || n.type === "PAGE") throw new Error(`Node not found or not a layer: ${id}`);
        nodes.push(n as SceneNode);
      }
      const parent = nodes[0].parent as any;
      if (!parent) throw new Error("Nodes must have a parent");
      if (nodes.some((n) => n.parent !== parent)) {
        throw new Error("All nodes must share the same parent; move them into one frame or group first");
      }
      // Insert where the lowest source layer was, so the result keeps its place in the stack.
      const index = Math.min(...nodes.map((n) => parent.children.indexOf(n)));

      const result = combine[op](nodes, parent, index);
      if (p.name) result.name = p.name;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: result.id, name: result.name, type: result.type, bounds: getBounds(result) },
      };
    }

    case "ungroup_nodes": {
      const nodeIds = request.nodeIds || [];
      if (nodeIds.length === 0) throw new Error("nodeIds is required");
      const results: any[] = [];
      for (const nid of nodeIds) {
        const n = await figma.getNodeByIdAsync(nid);
        if (!n) { results.push({ nodeId: nid, error: "Node not found" }); continue; }
        if (n.type !== "GROUP") { results.push({ nodeId: nid, error: "Node is not a GROUP" }); continue; }
        const group = n as GroupNode;
        const parent = group.parent as any;
        const index = parent.children.indexOf(group);
        const childIds: string[] = [];
        for (const child of [...group.children]) {
          parent.insertChild(index, child as SceneNode);
          childIds.push(child.id);
        }
        group.remove();
        results.push({ nodeId: nid, childIds });
      }
      figma.commitUndo();
      return { type: request.type, requestId: request.requestId, data: { results } };
    }

    default:
      return null;
  }
};
