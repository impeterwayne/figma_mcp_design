import { getBounds } from "./serializers";
import { makeSolidPaint, getParentNode, base64ToBytes, applyAutoLayout } from "./write-helpers";
import { applyTokens, autoTextStyle, colorKey, ensureTextStyle, ensureVariable, hexToRgba, linkTextStyle, logData, newLog, tokenPaint } from "./tokens";

export const handleWriteCreateRequest = async (request: any) => {
  switch (request.type) {
    case "create_frame": {
      const p = request.params || {};
      const parent = await getParentNode(p.parentId);
      const frame = figma.createFrame();
      frame.resize(p.width || 100, p.height || 100);
      frame.x = p.x != null ? p.x : 0;
      frame.y = p.y != null ? p.y : 0;
      if (p.name) frame.name = p.name;
      if (p.fillColor) frame.fills = [makeSolidPaint(p.fillColor)];
      if (p.cornerRadius != null) frame.cornerRadius = Number(p.cornerRadius);
      applyAutoLayout(frame, p);
      const log = newLog();
      await applyTokens(frame, p, log);
      (parent as any).appendChild(frame);
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: frame.id, name: frame.name, type: frame.type, bounds: getBounds(frame), ...logData(log) },
      };
    }

    case "create_rectangle": {
      const p = request.params || {};
      const parent = await getParentNode(p.parentId);
      const rect = figma.createRectangle();
      rect.resize(p.width || 100, p.height || 100);
      rect.x = p.x != null ? p.x : 0;
      rect.y = p.y != null ? p.y : 0;
      if (p.name) rect.name = p.name;
      if (p.fillColor) rect.fills = [makeSolidPaint(p.fillColor)];
      if (p.cornerRadius != null) rect.cornerRadius = p.cornerRadius;
      const log = newLog();
      await applyTokens(rect, p, log);
      (parent as any).appendChild(rect);
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: rect.id, name: rect.name, type: rect.type, bounds: getBounds(rect), ...logData(log) },
      };
    }

    case "create_ellipse": {
      const p = request.params || {};
      const parent = await getParentNode(p.parentId);
      const ellipse = figma.createEllipse();
      ellipse.resize(p.width || 100, p.height || 100);
      ellipse.x = p.x != null ? p.x : 0;
      ellipse.y = p.y != null ? p.y : 0;
      if (p.name) ellipse.name = p.name;
      if (p.fillColor) ellipse.fills = [makeSolidPaint(p.fillColor)];
      const log = newLog();
      await applyTokens(ellipse, p, log);
      (parent as any).appendChild(ellipse);
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: ellipse.id, name: ellipse.name, type: ellipse.type, bounds: getBounds(ellipse), ...logData(log) },
      };
    }

    case "create_text": {
      const p = request.params || {};
      const parent = await getParentNode(p.parentId);
      const textNode = figma.createText();
      const log = newLog();
      // A named style is reused or created from the font params. Without a name the
      // raw font is set, then linked to (or saved as) a matching style below.
      const style = p.textStyle ? await ensureTextStyle(p.textStyle, p, log) : null;
      if (style) {
        await linkTextStyle(textNode, style);
      } else {
        const fontFamily = p.fontFamily || "Inter";
        const fontStyle = p.fontStyle || "Regular";
        await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
        textNode.fontName = { family: fontFamily, style: fontStyle };
        if (p.fontSize != null) textNode.fontSize = Number(p.fontSize);
      }
      textNode.characters = p.text || "";
      if (!style && p.link !== false) await autoTextStyle(textNode, log);
      textNode.x = p.x != null ? p.x : 0;
      textNode.y = p.y != null ? p.y : 0;
      if (p.name) textNode.name = p.name;
      if (p.fillColor) textNode.fills = [makeSolidPaint(p.fillColor)];
      const fill = await tokenPaint(p.fillVariable, p.fillColor, undefined, p.link !== false, log);
      if (fill) textNode.fills = [fill];
      (parent as any).appendChild(textNode);
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: textNode.id, name: textNode.name, type: textNode.type, bounds: getBounds(textNode), ...logData(log) },
      };
    }

    case "import_image": {
      const p = request.params || {};
      if (!p.imageData) throw new Error("imageData (base64) is required");
      const parent = await getParentNode(p.parentId);
      const bytes = base64ToBytes(p.imageData);
      const image = figma.createImage(bytes);
      const rect = figma.createRectangle();
      rect.resize(p.width || 200, p.height || 200);
      rect.x = p.x != null ? p.x : 0;
      rect.y = p.y != null ? p.y : 0;
      if (p.name) rect.name = p.name;
      rect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: p.scaleMode || "FILL" }];
      (parent as any).appendChild(rect);
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: rect.id, name: rect.name, type: rect.type, bounds: getBounds(rect) },
      };
    }

    case "create_svg": {
      const p = request.params || {};
      if (!p.svg) throw new Error("svg is required");
      const parent = await getParentNode(p.parentId);
      const log = newLog();
      let variable: Variable | null = p.colorVariableId ? await figma.variables.getVariableByIdAsync(p.colorVariableId) : null;
      if (p.colorVariableId && !variable) throw new Error(`Variable not found: ${p.colorVariableId}`);
      if (variable && variable.resolvedType !== "COLOR") throw new Error(`Variable ${p.colorVariableId} is ${variable.resolvedType}, not COLOR`);
      // colorVariable is a token name (get-or-create, color is its value); a raw
      // color is tokenised too unless link is false.
      if (!variable && (p.colorVariable || (p.color && p.link !== false))) {
        const rgba = p.color ? hexToRgba(p.color) : undefined;
        variable = await ensureVariable(p.colorVariable, "COLOR", rgba, log, undefined, rgba && `color/${colorKey(rgba).slice(1)}`);
      }

      let svgNode: FrameNode;
      try {
        svgNode = figma.createNodeFromSvg(p.svg);
      } catch (e) {
        throw new Error(`Figma could not parse the SVG: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (p.name) svgNode.name = p.name;
      // Uniform scale keeps the aspect ratio and scales strokes with the shape;
      // with both sides given the icon fits inside that box.
      const factors = [p.width && p.width / svgNode.width, p.height && p.height / svgNode.height].filter((f) => f > 0);
      if (factors.length > 0) svgNode.rescale(Math.min(...factors));
      svgNode.x = p.x != null ? p.x : 0;
      svgNode.y = p.y != null ? p.y : 0;

      let recoloured = 0;
      if (variable || p.color) {
        const recolour = (paint: any) => {
          if (paint.type !== "SOLID" || paint.visible === false) return paint;
          recoloured++;
          const opacity = paint.opacity ?? 1;
          if (variable) return { ...figma.variables.setBoundVariableForPaint(paint, "color", variable), opacity };
          return { ...makeSolidPaint(p.color), opacity };
        };
        for (const n of [svgNode, ...svgNode.findAll()] as any[]) {
          for (const field of ["fills", "strokes"]) {
            if (Array.isArray(n[field]) && n[field].length > 0) n[field] = n[field].map(recolour);
          }
        }
      }

      (parent as any).appendChild(svgNode);
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: svgNode.id, name: svgNode.name, type: svgNode.type, bounds: getBounds(svgNode), ...(recoloured > 0 ? { recoloured } : {}), ...logData(log) },
      };
    }

    case "create_component": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      const node = await figma.getNodeByIdAsync(nodeId) as any;
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (node.type !== "FRAME") throw new Error(`Node ${nodeId} is not a FRAME — only frames can be converted to components`);

      const parent = node.parent as any;
      const index = parent.children.indexOf(node);

      const component = figma.createComponent();
      component.name = p.name || node.name;
      component.resize(node.width, node.height);
      component.x = node.x;
      component.y = node.y;
      component.fills = node.fills as Paint[];
      component.strokes = node.strokes as Paint[];
      if (node.cornerRadius != null && node.cornerRadius !== figma.mixed) {
        component.cornerRadius = node.cornerRadius as number;
      }
      if (node.layoutMode && node.layoutMode !== "NONE") {
        component.layoutMode = node.layoutMode;
        component.paddingTop = node.paddingTop;
        component.paddingRight = node.paddingRight;
        component.paddingBottom = node.paddingBottom;
        component.paddingLeft = node.paddingLeft;
        component.itemSpacing = node.itemSpacing;
        component.primaryAxisAlignItems = node.primaryAxisAlignItems;
        component.counterAxisAlignItems = node.counterAxisAlignItems;
      }
      // Move children from frame into component
      for (const child of [...node.children]) {
        component.appendChild(child);
      }
      parent.insertChild(index, component);
      node.remove();

      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: component.id, name: component.name, type: component.type, bounds: getBounds(component) },
      };
    }

    case "create_section": {
      const p = request.params || {};
      const section = figma.createSection();
      if (p.name) section.name = p.name;
      if (p.x != null) section.x = p.x;
      if (p.y != null) section.y = p.y;
      if (p.width != null || p.height != null) {
        section.resizeWithoutConstraints(p.width || section.width, p.height || section.height);
      }
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: section.id, name: section.name, type: section.type, bounds: getBounds(section) },
      };
    }

    default:
      return null;
  }
};
