import { makeSolidPaint, hexToRgb, loadNodeFonts } from "./write-helpers";

const channelHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0").toUpperCase();
const paintHex = (paint: any) => `#${channelHex(paint.color.r)}${channelHex(paint.color.g)}${channelHex(paint.color.b)}`;

// Visits every node under root; instance internals only when includeInstances is set.
const walkNodes = (node: any, includeInstances: boolean, visit: (n: any) => void) => {
  visit(node);
  if (node.type === "INSTANCE" && !includeInstances) return;
  if ("children" in node && node.children) {
    for (const child of node.children) walkNodes(child, includeInstances, visit);
  }
};

export const handleWriteStyleRequest = async (request: any) => {
  switch (request.type) {
    case "replace_colors": {
      const p = request.params || {};
      const rootId = request.nodeIds && request.nodeIds[0];
      if (!rootId) throw new Error("nodeId is required");
      const root = await figma.getNodeByIdAsync(rootId);
      if (!root) throw new Error(`Node not found: ${rootId}`);
      const includeInstances = !!p.includeInstances;
      const typeFilter: Set<string> | null = Array.isArray(p.nodeTypes) && p.nodeTypes.length > 0 ? new Set(p.nodeTypes) : null;
      const isGradient = (paint: any) => String(paint.type).startsWith("GRADIENT");
      const isShadow = (effect: any) => effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW";

      if (p.dryRun) {
        const usage = new Map<string, { hex: string; fills: number; strokes: number; gradientStops: number; effects: number }>();
        const entry = (hex: string) => {
          if (!usage.has(hex)) usage.set(hex, { hex, fills: 0, strokes: 0, gradientStops: 0, effects: 0 });
          return usage.get(hex)!;
        };
        let skippedMixed = 0;
        walkNodes(root, includeInstances, (n) => {
          for (const field of ["fills", "strokes"] as const) {
            if (!(field in n)) continue;
            const paints = n[field];
            if (typeof paints === "symbol") {
              if (field === "fills" && typeof n.getStyledTextSegments === "function") {
                for (const seg of n.getStyledTextSegments(["fills"])) {
                  for (const paint of seg.fills) if (paint.type === "SOLID") entry(paintHex(paint)).fills++;
                }
              } else {
                skippedMixed++;
              }
              continue;
            }
            for (const paint of paints || []) {
              if (paint.type === "SOLID") entry(paintHex(paint))[field]++;
              else if (isGradient(paint)) for (const stop of paint.gradientStops) entry(paintHex(stop)).gradientStops++;
            }
          }
          if (Array.isArray(n.effects)) {
            for (const effect of n.effects) if (isShadow(effect)) entry(paintHex(effect)).effects++;
          }
        });
        const total = (c: any) => c.fills + c.strokes + c.gradientStops + c.effects;
        const colors = [...usage.values()].sort((a, b) => total(b) - total(a));
        return { type: request.type, requestId: request.requestId, data: { colors, skippedMixed } };
      }

      if (!Array.isArray(p.mappings) || p.mappings.length === 0) throw new Error("mappings is required unless dryRun");
      // Resolve every target before touching the document so a bad mapping changes nothing.
      const targets = new Map<string, { variable?: any; color?: string; gradient?: string[] }>();
      for (const m of p.mappings) {
        const from = String(m.from).toUpperCase();
        if (m.variableId) {
          const variable = await figma.variables.getVariableByIdAsync(m.variableId);
          if (!variable) throw new Error(`Variable not found: ${m.variableId}`);
          targets.set(from, { variable });
        } else if (m.color) {
          targets.set(from, { color: m.color });
        } else if (Array.isArray(m.gradient) && m.gradient.length >= 2) {
          targets.set(from, { gradient: m.gradient });
        } else {
          throw new Error(`Mapping for ${from} needs variableId, color or gradient`);
        }
      }
      // Gradient stops cannot bind variables here, so they take the target's resolved colour.
      // A solid becomes a left-to-right linear gradient with evenly spaced stops.
      const gradientPaint = (hexes: string[], plain: any) => ({
        type: "GRADIENT_LINEAR",
        gradientTransform: [[1, 0, 0], [0, 1, 0]],
        gradientStops: hexes.map((hex, i) => {
          const { r, g, b } = hexToRgb(hex);
          return { position: i / (hexes.length - 1), color: { r, g, b, a: 1 } };
        }),
        opacity: plain.opacity ?? 1,
        visible: plain.visible ?? true,
        blendMode: plain.blendMode ?? "NORMAL",
      });
      const targetRgb = (target: { variable?: any; color?: string }, node: any) => {
        if (target.color) { const { r, g, b } = hexToRgb(target.color); return { r, g, b }; }
        const { r, g, b } = target.variable.resolveForConsumer(node).value;
        return { r, g, b };
      };
      const replaced: Record<string, number> = {};
      const count = (hex: string) => { replaced[hex] = (replaced[hex] || 0) + 1; };
      let nodesChanged = 0;
      const mixedTexts: any[] = [];
      walkNodes(root, includeInstances, (n) => {
        if (typeFilter && !typeFilter.has(n.type)) return;
        if (n.type === "TEXT" && typeof n.fills === "symbol" && typeof n.getStyledTextSegments === "function") {
          mixedTexts.push(n);
        }
        let changed = false;
        for (const field of ["fills", "strokes"]) {
          if (!(field in n) || typeof n[field] === "symbol" || !n[field]) continue;
          let touched = false;
          const next = n[field].map((paint: any) => {
            if (isGradient(paint)) {
              let stopTouched = false;
              const gradientStops = paint.gradientStops.map((stop: any) => {
                const hex = paintHex(stop);
                const target = targets.get(hex);
                if (!target || target.gradient) return stop;
                stopTouched = true;
                count(hex);
                return { ...stop, color: { ...targetRgb(target, n), a: stop.color.a } };
              });
              if (!stopTouched) return paint;
              touched = true;
              return { ...paint, gradientStops };
            }
            if (paint.type !== "SOLID") return paint;
            const hex = paintHex(paint);
            const target = targets.get(hex);
            if (!target) return paint;
            touched = true;
            count(hex);
            const { boundVariables, ...plain } = paint;
            if (target.gradient) return gradientPaint(target.gradient, plain);
            if (target.variable) {
              // Binding can drop opacity, so carry it over explicitly.
              const bound = figma.variables.setBoundVariableForPaint(plain, "color", target.variable);
              return { ...bound, opacity: plain.opacity ?? 1 };
            }
            return { ...plain, color: targetRgb(target, n) };
          });
          if (touched) { n[field] = next; changed = true; }
        }
        if (Array.isArray(n.effects)) {
          let fxTouched = false;
          const effects = n.effects.map((effect: any) => {
            if (!isShadow(effect)) return effect;
            const hex = paintHex(effect);
            const target = targets.get(hex);
            if (!target || target.gradient) return effect;
            fxTouched = true;
            count(hex);
            return { ...effect, color: { ...targetRgb(target, n), a: effect.color.a } };
          });
          if (fxTouched) { n.effects = effects; changed = true; }
        }
        if (changed) nodesChanged++;
      });
      // Text with per-range colours: recolour each matching range.
      for (const n of mixedTexts) {
        let changed = false;
        for (const seg of n.getStyledTextSegments(["fills"])) {
          let touched = false;
          const next = seg.fills.map((paint: any) => {
            if (paint.type !== "SOLID") return paint;
            const hex = paintHex(paint);
            const target = targets.get(hex);
            if (!target) return paint;
            touched = true;
            count(hex);
            const { boundVariables, ...plain } = paint;
            if (target.gradient) return gradientPaint(target.gradient, plain);
            if (target.variable) {
              const bound = figma.variables.setBoundVariableForPaint(plain, "color", target.variable);
              return { ...bound, opacity: plain.opacity ?? 1 };
            }
            return { ...plain, color: targetRgb(target, n) };
          });
          if (touched) {
            if (!changed) {
              try { await loadNodeFonts(n); } catch (_) { /* fills do not depend on fonts */ }
            }
            n.setRangeFills(seg.start, seg.end, next);
            changed = true;
          }
        }
        if (changed) nodesChanged++;
      }
      figma.commitUndo();
      return { type: request.type, requestId: request.requestId, data: { replaced, nodesChanged } };
    }

    case "snap_to_tokens": {
      const p = request.params || {};
      const rootId = request.nodeIds && request.nodeIds[0];
      if (!rootId) throw new Error("nodeId is required");
      if (!p.spacingVariables) throw new Error("spacingVariables is required");
      if (!p.radiusVariables) throw new Error("radiusVariables is required");
      const root = await figma.getNodeByIdAsync(rootId);
      if (!root) throw new Error(`Node not found: ${rootId}`);

      const loadScale = async (map: Record<string, string>) => {
        const scale: { value: number; variable: any }[] = [];
        for (const [value, id] of Object.entries(map)) {
          const variable = await figma.variables.getVariableByIdAsync(id);
          if (!variable) throw new Error(`Variable not found: ${id}`);
          scale.push({ value: Number(value), variable });
        }
        return scale.sort((a, b) => a.value - b.value);
      };
      const spacing = await loadScale(p.spacingVariables);
      const radiusAll = await loadScale(p.radiusVariables);
      const full = radiusAll.find((s) => s.value >= 999);
      const radius = radiusAll.filter((s) => s.value < 999);
      // Nearest step; ties go to the smaller step.
      const nearest = (scale: { value: number; variable: any }[], v: number) =>
        scale.reduce((best, s) => (Math.abs(s.value - v) < Math.abs(best.value - v) ? s : best), scale[0]);

      // Values far above the top step are layout gaps, not tokens; leave them alone.
      const spacingLimit = spacing.length > 0 ? spacing[spacing.length - 1].value * 1.1 : 0;
      const skippedReport: Record<string, number> = {};
      const spacingReport: Record<string, number> = {};
      const radiusReport: Record<string, number> = {};
      const note = (report: Record<string, number>, key: string) => { report[key] = (report[key] || 0) + 1; };
      let nodesChanged = 0;
      const spacingFields = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "itemSpacing"];
      const corners = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
      const radiusTypes = new Set(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "RECTANGLE"]);

      walkNodes(root, false, (n) => {
        let changed = false;
        if (n.layoutMode && n.layoutMode !== "NONE" && spacing.length > 0) {
          for (const field of spacingFields) {
            const v = n[field];
            if (typeof v !== "number" || v <= 0) continue;
            if (v > spacingLimit) { note(skippedReport, String(v)); continue; }
            const step = nearest(spacing, v);
            note(spacingReport, `${v}→${step.value}`);
            if (!p.dryRun) n.setBoundVariable(field, step.variable);
            changed = true;
          }
        }
        if (radiusTypes.has(n.type) && "cornerRadius" in n) {
          const values = typeof n.cornerRadius === "number"
            ? corners.map(() => n.cornerRadius)
            : corners.map((c) => n[c]);
          const pillAt = Math.min(n.width ?? Infinity, n.height ?? Infinity) / 2 - 0.5;
          corners.forEach((corner, i) => {
            const v = values[i];
            if (typeof v !== "number" || v <= 0) return;
            const step = full && v >= pillAt ? full : radius.length > 0 ? nearest(radius, v) : null;
            if (!step) return;
            if (i === 0 || typeof n.cornerRadius !== "number") {
              note(radiusReport, `${v}→${step === full ? "full" : step.value}`);
            }
            if (!p.dryRun) n.setBoundVariable(corner, step.variable);
            changed = true;
          });
        }
        if (changed) nodesChanged++;
      });
      if (!p.dryRun) figma.commitUndo();
      return { type: request.type, requestId: request.requestId, data: { spacing: spacingReport, radius: radiusReport, skipped: skippedReport, nodesChanged } };
    }

    case "create_paint_style": {
      const p = request.params || {};
      if (!p.name) throw new Error("name is required");
      if (!p.color) throw new Error("color is required");
      const existing = (await figma.getLocalPaintStylesAsync()).find(s => s.name === p.name);
      if (existing) {
        return { type: request.type, requestId: request.requestId, data: { id: existing.id, name: existing.name } };
      }
      const style = figma.createPaintStyle();
      style.name = p.name;
      style.paints = [makeSolidPaint(p.color)];
      if (p.description) style.description = p.description;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: style.id, name: style.name },
      };
    }

    case "create_text_style": {
      const p = request.params || {};
      if (!p.name) throw new Error("name is required");
      const existing = (await figma.getLocalTextStylesAsync()).find(s => s.name === p.name);
      if (existing) {
        return { type: request.type, requestId: request.requestId, data: { id: existing.id, name: existing.name } };
      }
      const family = p.fontFamily || "Inter";
      const fontStyle = p.fontStyle || "Regular";
      await figma.loadFontAsync({ family, style: fontStyle });
      const style = figma.createTextStyle();
      style.name = p.name;
      style.fontName = { family, style: fontStyle };
      if (p.fontSize != null) style.fontSize = Number(p.fontSize);
      if (p.description) style.description = p.description;
      if (p.textDecoration && p.textDecoration !== "NONE") {
        style.textDecoration = p.textDecoration;
      }
      if (p.lineHeightValue != null) {
        style.lineHeight = { value: Number(p.lineHeightValue), unit: p.lineHeightUnit || "PIXELS" };
      }
      if (p.letterSpacingValue != null) {
        style.letterSpacing = { value: Number(p.letterSpacingValue), unit: p.letterSpacingUnit || "PIXELS" };
      }
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: style.id, name: style.name },
      };
    }

    case "create_effect_style": {
      const p = request.params || {};
      if (!p.name) throw new Error("name is required");
      const existing = (await figma.getLocalEffectStylesAsync()).find(s => s.name === p.name);
      if (existing) {
        return { type: request.type, requestId: request.requestId, data: { id: existing.id, name: existing.name } };
      }
      const effectType = p.type || "DROP_SHADOW";
      let effect: Effect;
      if (effectType === "LAYER_BLUR") {
        effect = { type: "LAYER_BLUR", blurType: "NORMAL", radius: Number(p.radius ?? 4), visible: true };
      } else if (effectType === "BACKGROUND_BLUR") {
        effect = { type: "BACKGROUND_BLUR", blurType: "NORMAL", radius: Number(p.radius ?? 4), visible: true };
      } else {
        // DROP_SHADOW or INNER_SHADOW
        const { r, g, b, a } = hexToRgb(p.color || "#000000");
        const alpha = p.opacity != null ? Number(p.opacity) : (a !== 1 ? a : 0.25);
        effect = {
          type: effectType as "DROP_SHADOW" | "INNER_SHADOW",
          color: { r, g, b, a: alpha },
          offset: { x: Number(p.offsetX ?? 0), y: Number(p.offsetY ?? 4) },
          radius: Number(p.radius ?? 8),
          spread: Number(p.spread ?? 0),
          visible: true,
          blendMode: "NORMAL",
        };
      }
      const style = figma.createEffectStyle();
      style.name = p.name;
      style.effects = [effect];
      if (p.description) style.description = p.description;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: style.id, name: style.name },
      };
    }

    case "create_grid_style": {
      const p = request.params || {};
      if (!p.name) throw new Error("name is required");
      const existing = (await figma.getLocalGridStylesAsync()).find(s => s.name === p.name);
      if (existing) {
        return { type: request.type, requestId: request.requestId, data: { id: existing.id, name: existing.name } };
      }
      const pattern = p.pattern || "GRID";
      let grid: LayoutGrid;
      if (pattern === "COLUMNS" || pattern === "ROWS") {
        grid = {
          pattern,
          count: Number(p.count ?? 12),
          gutterSize: Number(p.gutterSize ?? 16),
          offset: Number(p.offset ?? 0),
          alignment: p.alignment || "STRETCH",
          visible: true,
        };
      } else {
        // GRID
        const { r, g, b, a } = hexToRgb(p.color || "#FF0000");
        grid = {
          pattern: "GRID",
          sectionSize: Number(p.sectionSize ?? 8),
          visible: true,
          color: { r, g, b, a: p.opacity != null ? Number(p.opacity) : (a !== 1 ? a : 0.1) },
        };
      }
      const style = figma.createGridStyle();
      style.name = p.name;
      style.layoutGrids = [grid];
      if (p.description) style.description = p.description;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: style.id, name: style.name },
      };
    }

    case "update_paint_style": {
      const p = request.params || {};
      if (!p.styleId) throw new Error("styleId is required");
      const style = await figma.getStyleByIdAsync(p.styleId);
      if (!style) throw new Error(`Style not found: ${p.styleId}`);
      if (style.type !== "PAINT") throw new Error(`Style ${p.styleId} is not a paint style`);
      if (p.name) style.name = p.name;
      if (p.color) (style as PaintStyle).paints = [makeSolidPaint(p.color)];
      if (p.description != null) style.description = p.description;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: style.id, name: style.name },
      };
    }

    case "delete_style": {
      const p = request.params || {};
      if (!p.styleId) throw new Error("styleId is required");
      const style = await figma.getStyleByIdAsync(p.styleId);
      if (!style) throw new Error(`Style not found: ${p.styleId}`);
      style.remove();
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { styleId: p.styleId, deleted: true },
      };
    }

    case "apply_style_to_node": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      if (!p.styleId) throw new Error("styleId is required");
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      const style = await figma.getStyleByIdAsync(p.styleId);
      if (!style) throw new Error(`Style not found: ${p.styleId}`);
      const n = node as any;
      switch (style.type) {
        case "PAINT": {
          const target = p.target || "fill";
          if (target === "stroke") {
            if (!("strokeStyleId" in node)) throw new Error(`Node ${nodeId} does not support stroke styles`);
            await n.setStrokeStyleIdAsync(p.styleId);
          } else {
            if (!("fillStyleId" in node)) throw new Error(`Node ${nodeId} does not support fill styles`);
            await n.setFillStyleIdAsync(p.styleId);
          }
          break;
        }
        case "TEXT":
          if (!("textStyleId" in node)) throw new Error(`Node ${nodeId} does not support text styles`);
          await n.setTextStyleIdAsync(p.styleId);
          break;
        case "EFFECT":
          if (!("effectStyleId" in node)) throw new Error(`Node ${nodeId} does not support effect styles`);
          await n.setEffectStyleIdAsync(p.styleId);
          break;
        case "GRID":
          if (!("gridStyleId" in node)) throw new Error(`Node ${nodeId} does not support grid styles`);
          await n.setGridStyleIdAsync(p.styleId);
          break;
        default:
          throw new Error(`Unknown style type: ${(style as any).type}`);
      }
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: n.id, name: n.name, styleId: p.styleId, styleType: style.type },
      };
    }

    case "set_effects": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      if (!Array.isArray(p.effects)) throw new Error("effects array is required");
      const node = await figma.getNodeByIdAsync(nodeId) as any;
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      if (!("effects" in node)) throw new Error(`Node ${nodeId} does not support effects`);
      const effects: Effect[] = p.effects.map((e: any) => {
        switch (e.type) {
          case "DROP_SHADOW":
          case "INNER_SHADOW": {
            const { r, g, b } = hexToRgb(e.color || "#000000");
            return {
              type: e.type as "DROP_SHADOW" | "INNER_SHADOW",
              color: { r, g, b, a: e.opacity != null ? Number(e.opacity) : 0.25 },
              offset: { x: Number(e.offsetX ?? 0), y: Number(e.offsetY ?? 4) },
              radius: Number(e.radius ?? 4),
              spread: Number(e.spread ?? 0),
              visible: e.visible ?? true,
              blendMode: (e.blendMode || "NORMAL") as BlendMode,
            } as DropShadowEffect;
          }
          case "LAYER_BLUR":
          case "BACKGROUND_BLUR":
            return {
              type: e.type as "LAYER_BLUR" | "BACKGROUND_BLUR",
              radius: Number(e.radius ?? 4),
              visible: e.visible ?? true,
            } as BlurEffect;
          default:
            throw new Error(`Unknown effect type: ${e.type}. Must be DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, or BACKGROUND_BLUR`);
        }
      });
      node.effects = effects;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name, effectCount: effects.length },
      };
    }

    case "bind_variable_to_node": {
      const p = request.params || {};
      const nodeId = request.nodeIds && request.nodeIds[0];
      if (!nodeId) throw new Error("nodeId is required");
      if (!p.variableId) throw new Error("variableId is required");
      if (!p.field) throw new Error("field is required");
      const node = await figma.getNodeByIdAsync(nodeId) as any;
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      const variable = await figma.variables.getVariableByIdAsync(p.variableId);
      if (!variable) throw new Error(`Variable not found: ${p.variableId}`);
      if (p.field === "fillColor") {
        if (!("fills" in node)) throw new Error(`Node ${nodeId} does not support fills`);
        const fills = [...(node.fills as Paint[])];
        const base = fills.length > 0 ? fills[0] : makeSolidPaint("#000000");
        const paint = figma.variables.setBoundVariableForPaint(base as SolidPaint, "color", variable);
        node.fills = [paint];
      } else if (p.field === "strokeColor") {
        if (!("strokes" in node)) throw new Error(`Node ${nodeId} does not support strokes`);
        const strokes = [...(node.strokes as Paint[])];
        const base = strokes.length > 0 ? strokes[0] : makeSolidPaint("#000000");
        const paint = figma.variables.setBoundVariableForPaint(base as SolidPaint, "color", variable);
        node.strokes = [paint];
      } else {
        if (!(p.field in node)) throw new Error(`Node ${nodeId} does not have field: ${p.field}`);
        node.setBoundVariable(p.field, variable);
      }
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { id: node.id, name: node.name, variableId: p.variableId, field: p.field },
      };
    }

    case "rename_style": {
      const p = request.params || {};
      if (!p.styleId) throw new Error("styleId is required");
      if (!p.name) throw new Error("name is required");
      const style = await figma.getStyleByIdAsync(p.styleId);
      if (!style) throw new Error(`Style not found: ${p.styleId}`);
      const oldName = style.name;
      style.name = p.name;
      if (p.description != null) style.description = p.description;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { styleId: style.id, oldName, newName: style.name, styleType: style.type },
      };
    }

    case "set_description": {
      const p = request.params || {};
      const targets = [p.nodeId, p.styleId, p.variableId].filter(Boolean);
      if (targets.length !== 1) {
        throw new Error("Exactly one of nodeId, styleId, or variableId is required");
      }
      if (p.description == null) throw new Error("description is required");

      if (p.styleId) {
        const style = await figma.getStyleByIdAsync(p.styleId);
        if (!style) throw new Error(`Style not found: ${p.styleId}`);
        style.description = p.description;
        figma.commitUndo();
        return {
          type: request.type,
          requestId: request.requestId,
          data: { styleId: style.id, name: style.name, description: p.description },
        };
      }

      if (p.variableId) {
        const variable = await figma.variables.getVariableByIdAsync(p.variableId);
        if (!variable) throw new Error(`Variable not found: ${p.variableId}`);
        variable.description = p.description;
        figma.commitUndo();
        return {
          type: request.type,
          requestId: request.requestId,
          data: { variableId: variable.id, name: variable.name, description: p.description },
        };
      }

      // nodeId path
      const node = await figma.getNodeByIdAsync(p.nodeId);
      if (!node) throw new Error(`Node not found: ${p.nodeId}`);
      if (!("description" in node)) {
        throw new Error(`Node type ${node.type} does not support descriptions. Only COMPONENT, COMPONENT_SET, and FRAME nodes support descriptions.`);
      }
      (node as any).description = p.description;
      figma.commitUndo();
      return {
        type: request.type,
        requestId: request.requestId,
        data: { nodeId: node.id, name: node.name, description: p.description },
      };
    }

    default:
      return null;
  }
};
