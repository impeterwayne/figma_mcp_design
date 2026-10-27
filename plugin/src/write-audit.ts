// design_system_audit: report (and optionally fix) layers that are not linked to the
// design system — raw colours, unstyled text, loose effects, off-token radius/spacing,
// and repeated frames that should be components.
import { RADIUS_NAME, SPACE_NAME, autoTextStyle, colorKey, effectKey, effectName, ensureVariable, logData, newLog } from "./tokens";

const CORNERS = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
const SPACING = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "itemSpacing"];
const KINDS = ["color", "text", "effect", "radius", "spacing", "repeat"];

const loadTokens = async () => {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const defaultMode = new Map(collections.map((c) => [c.id, c.defaultModeId]));
  const colors = new Map<string, Variable>();
  const radius = new Map<number, Variable>();
  const spacing = new Map<number, Variable>();
  for (const v of await figma.variables.getLocalVariablesAsync()) {
    const value: any = v.valuesByMode[defaultMode.get(v.variableCollectionId) ?? Object.keys(v.valuesByMode)[0]];
    if (value == null || (typeof value === "object" && value.type === "VARIABLE_ALIAS")) continue;
    if (v.resolvedType === "COLOR") {
      const key = colorKey(value);
      if (!colors.has(key)) colors.set(key, v);
    } else if (v.resolvedType === "FLOAT") {
      const name = v.name.toLowerCase();
      const target = /radius|corner|round/.test(name) ? radius : /space|spacing|gap|padding|inset/.test(name) ? spacing : null;
      if (target && !target.has(value)) target.set(value, v);
    }
  }
  const textStyles = new Map<string, TextStyle>();
  for (const s of await figma.getLocalTextStylesAsync()) {
    const key = `${s.fontName.family}|${s.fontName.style}|${s.fontSize}`;
    if (!textStyles.has(key)) textStyles.set(key, s);
  }
  const effectStyles = new Map<string, EffectStyle>();
  for (const s of await figma.getLocalEffectStylesAsync()) {
    const key = effectKey(s.effects);
    if (!effectStyles.has(key)) effectStyles.set(key, s);
  }
  return { colors, radius, spacing, textStyles, effectStyles };
};

export const handleWriteAuditRequest = async (request: any) => {
  if (request.type !== "design_system_audit") return undefined;
  const p = request.params || {};
  const rootId = request.nodeIds && request.nodeIds[0];
  const root: any = rootId ? await figma.getNodeByIdAsync(rootId) : figma.currentPage;
  if (!root) throw new Error(`Node not found: ${rootId}`);
  const fix = p.fix === true;
  // create: also make auto-named tokens for values with no match, then bind them.
  const create = fix && p.create === true;
  const log = newLog();
  const limit = Number(p.limit ?? 50);
  const only: string[] = Array.isArray(p.checks) && p.checks.length > 0 ? p.checks : KINDS;
  const tokens = await loadTokens();

  const summary: Record<string, { issues: number; fixable: number; fixed: number }> = {};
  for (const k of only) summary[k] = { issues: 0, fixable: 0, fixed: 0 };
  const issues: any[] = [];
  const report = (kind: string, node: any, value: any, suggestion?: string) => {
    summary[kind].issues++;
    if (suggestion) summary[kind].fixable++;
    if (issues.length < limit) issues.push({ kind, nodeId: node.id, name: node.name, value, ...(suggestion ? { suggestion } : {}) });
  };
  const signatures = new Map<string, string[]>();
  let scanned = 0;

  const visit = async (node: any) => {
    scanned++;
    if (only.includes("color")) {
      for (const field of ["fills", "strokes"]) {
        const paints = node[field];
        if (!Array.isArray(paints)) continue;
        let changed = false;
        const next: any[] = [];
        for (const paint of paints) {
          if (paint.type !== "SOLID" || paint.visible === false || paint.boundVariables?.color) { next.push(paint); continue; }
          const key = colorKey(paint.color, paint.opacity ?? 1);
          let variable = tokens.colors.get(key);
          report("color", node, `${field}:${key}`, variable?.name);
          if (fix && !variable && create) {
            const { r, g, b } = paint.color;
            variable = (await ensureVariable(undefined, "COLOR", { r, g, b, a: paint.opacity ?? 1 }, log, undefined, `color/${key.slice(1)}`)) ?? undefined;
            if (variable) tokens.colors.set(key, variable);
          }
          if (!fix || !variable) { next.push(paint); continue; }
          changed = true;
          summary.color.fixed++;
          // The variable carries the alpha, so the paint opacity resets to 1.
          next.push({ ...figma.variables.setBoundVariableForPaint(paint, "color", variable), opacity: 1 });
        }
        if (changed) node[field] = next;
      }
    }
    if (only.includes("text") && node.type === "TEXT" && !node.textStyleId) {
      const mixed = typeof node.fontName === "symbol" || typeof node.fontSize === "symbol";
      const style = mixed ? undefined : tokens.textStyles.get(`${node.fontName.family}|${node.fontName.style}|${node.fontSize}`);
      report("text", node, mixed ? "mixed" : `${node.fontName.family} ${node.fontName.style} ${node.fontSize}`, style?.name);
      if (fix && style) {
        await figma.loadFontAsync(style.fontName);
        await node.setTextStyleIdAsync(style.id);
        summary.text.fixed++;
      } else if (create && !mixed) {
        await figma.loadFontAsync(node.fontName);
        if (await autoTextStyle(node, log)) summary.text.fixed++;
      }
    }
    if (only.includes("effect") && Array.isArray(node.effects) && node.effects.length > 0 && !node.effectStyleId) {
      const ekey = effectKey(node.effects);
      let style = tokens.effectStyles.get(ekey);
      report("effect", node, node.effects.map((e: Effect) => e.type).join("+"), style?.name);
      if (create && !style) {
        style = figma.createEffectStyle();
        style.name = effectName(node.effects);
        style.effects = node.effects;
        tokens.effectStyles.set(ekey, style);
        log.created.push(style.name);
      }
      if (fix && style) {
        await node.setEffectStyleIdAsync(style.id);
        summary.effect.fixed++;
      }
    }
    if (only.includes("radius") && typeof node.cornerRadius === "number" && node.cornerRadius > 0 && !node.boundVariables?.topLeftRadius) {
      let variable = tokens.radius.get(node.cornerRadius);
      report("radius", node, node.cornerRadius, variable?.name);
      if (create && !variable) {
        variable = (await ensureVariable(undefined, "FLOAT", node.cornerRadius, log, RADIUS_NAME, `radius/${node.cornerRadius}`)) ?? undefined;
        if (variable) tokens.radius.set(node.cornerRadius, variable);
      }
      if (fix && variable) {
        for (const c of CORNERS) node.setBoundVariable(c, variable);
        summary.radius.fixed++;
      }
    }
    if (only.includes("spacing") && node.layoutMode && node.layoutMode !== "NONE") {
      for (const field of SPACING) {
        const value = node[field];
        if (!value || node.boundVariables?.[field]) continue;
        let variable = tokens.spacing.get(value);
        report("spacing", node, `${field}:${value}`, variable?.name);
        if (create && !variable) {
          variable = (await ensureVariable(undefined, "FLOAT", value, log, SPACE_NAME, `space/${value}`)) ?? undefined;
          if (variable) tokens.spacing.set(value, variable);
        }
        if (fix && variable) {
          node.setBoundVariable(field, variable);
          summary.spacing.fixed++;
        }
      }
    }
    if (only.includes("repeat") && node.type === "FRAME" && Array.isArray(node.children) && node.children.length >= 2) {
      const sig = `${Math.round(node.width)}x${Math.round(node.height)}|${node.children.map((c: any) => c.type).join(",")}`;
      signatures.set(sig, [...(signatures.get(sig) ?? []), node.id]);
    }
    // Instance internals belong to their main component; audit the component instead.
    if (node.type === "INSTANCE" && !p.includeInstances) return;
    if (Array.isArray(node.children)) for (const child of node.children) await visit(child);
  };

  if (root.type === "PAGE") for (const child of root.children) await visit(child);
  else await visit(root);

  const repeats: any[] = [];
  if (only.includes("repeat")) {
    for (const [sig, ids] of signatures) {
      if (ids.length < 3) continue;
      summary.repeat.issues++;
      repeats.push({ count: ids.length, shape: sig, nodeIds: ids.slice(0, 10), suggestion: "create_component from one, then create_instance for the rest" });
    }
    repeats.sort((a, b) => b.count - a.count);
  }

  if (fix) figma.commitUndo();
  return {
    type: request.type,
    requestId: request.requestId,
    data: {
      root: { id: root.id, name: root.name },
      scanned,
      fixed: fix,
      tokens: { colors: tokens.colors.size, radius: tokens.radius.size, spacing: tokens.spacing.size, textStyles: tokens.textStyles.size, effectStyles: tokens.effectStyles.size },
      summary,
      ...logData(log),
      issues,
      ...(repeats.length ? { repeats: repeats.slice(0, 20) } : {}),
    },
  };
};
