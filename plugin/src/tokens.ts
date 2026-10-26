// Design-token helpers. Every token parameter follows the same rule, so a file
// with no design system grows one while screens are built, and an existing one
// is reused instead of duplicated:
//   1. a token with that name (or ID) exists       -> use it
//   2. another token already has the same value     -> reuse it
//   3. a value was given                            -> create the token, then use it
// Raw values without a token name follow rules 2-3 too, with a generated name
// (color/1A1415, radius/16, space/12, Text/Inter Bold 16, Effect/...), so every
// layer the AI makes ends up on a token. p.link === false keeps raw values.
import { hexToRgb, makeSolidPaint, parseTextMeasure } from "./write-helpers";

const CORNERS = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
const PADDINGS = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"];
export const RADIUS_NAME = /radius|corner|round/i;
export const SPACE_NAME = /space|spacing|gap|padding|inset/i;

export type TokenLog = { created: string[]; reused: string[] };
export const newLog = (): TokenLog => ({ created: [], reused: [] });
const note = (log: TokenLog | undefined, kind: "created" | "reused", label: string) => {
  if (log && !log[kind].includes(label)) log[kind].push(label);
};

// ── values ────────────────────────────────────────────────────────────────────

const hex2 = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0").toUpperCase();
export const colorKey = (c: any, alpha = 1) => {
  const a = alpha * (c.a ?? 1);
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${a < 0.999 ? hex2(a) : ""}`;
};
const hexToRgba = (hex: string, opacity?: number) => {
  const { r, g, b, a } = hexToRgb(hex);
  return { r, g, b, a: a * (opacity ?? 1) };
};
export const effectKey = (effects: readonly any[]) =>
  JSON.stringify(effects.filter((e) => e.visible !== false).map((e) => [
    e.type, Math.round(e.radius ?? 0),
    e.color ? colorKey(e.color) : null,
    e.offset ? [Math.round(e.offset.x), Math.round(e.offset.y)] : null,
    Math.round(e.spread ?? 0),
  ]));

// Raw effect objects as the tools accept them (hex colour, offsetX/Y) -> Figma effects.
export const toFigmaEffects = (list: any[]): Effect[] => list.map((e: any) => {
  switch (e.type) {
    case "DROP_SHADOW":
    case "INNER_SHADOW": {
      const { r, g, b } = hexToRgb(e.color || "#000000");
      return {
        type: e.type,
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
      return { type: e.type, radius: Number(e.radius ?? 4), visible: e.visible ?? true } as BlurEffect;
    default:
      throw new Error(`Unknown effect type: ${e.type}. Must be DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, or BACKGROUND_BLUR`);
  }
});

// ── variables ─────────────────────────────────────────────────────────────────

const defaultValue = async (v: Variable) => {
  const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
  const mode = col?.defaultModeId ?? Object.keys(v.valuesByMode)[0];
  return v.valuesByMode[mode] as any;
};

const findByName = async (ref: string, type?: "COLOR" | "FLOAT") => {
  if (ref.startsWith("VariableID:")) return figma.variables.getVariableByIdAsync(ref);
  const all = await figma.variables.getLocalVariablesAsync(type);
  const direct = all.find((v) => v.id === ref || v.name === ref);
  if (direct) return direct;
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const byId = new Map(collections.map((c) => [c.id, c.name]));
  return all.find((v) => `${byId.get(v.variableCollectionId)}/${v.name}` === ref) ?? null;
};

// A variable of the type whose default value equals `value`. FLOAT matches are
// limited to the same family (radius vs spacing) so 16px radius never binds to space/16.
const findByValue = async (type: "COLOR" | "FLOAT", value: any, family?: RegExp) => {
  for (const v of await figma.variables.getLocalVariablesAsync(type)) {
    if (family && !family.test(v.name)) continue;
    const val = await defaultValue(v);
    if (val == null || (typeof val === "object" && val.type === "VARIABLE_ALIAS")) continue;
    if (type === "COLOR" ? colorKey(val) === colorKey(value) : val === value) return v;
  }
  return null;
};

// New variables go to a collection that already holds that type, else to "Tokens".
const collectionFor = async (type: "COLOR" | "FLOAT") => {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  for (const v of await figma.variables.getLocalVariablesAsync(type)) {
    const col = collections.find((c) => c.id === v.variableCollectionId);
    if (col) return col;
  }
  return collections.find((c) => c.name === "Tokens") ?? figma.variables.createVariableCollection("Tokens");
};

export const resolveVariable = async (ref: string, type?: "COLOR" | "FLOAT") => {
  const variable = await findByName(ref, type);
  if (!variable) throw new Error(`Variable not found: ${ref}`);
  if (type && variable.resolvedType !== type) throw new Error(`Variable ${ref} is ${variable.resolvedType}, not ${type}`);
  return variable;
};

// Generated names never clash with a different value: "radius/16" -> "radius/16-2".
const freeName = async (base: string, type?: "COLOR" | "FLOAT") => {
  const taken = new Set((await figma.variables.getLocalVariablesAsync(type)).map((v) => v.name));
  let name = base;
  for (let i = 2; taken.has(name); i++) name = `${base}-${i}`;
  return name;
};

export const ensureVariable = async (
  ref: string | undefined, type: "COLOR" | "FLOAT", value: any, log?: TokenLog, family?: RegExp, autoName?: string,
): Promise<Variable | null> => {
  if (ref) {
    const named = await findByName(ref, type);
    if (named) {
      if (named.resolvedType !== type) throw new Error(`Variable ${ref} is ${named.resolvedType}, not ${type}`);
      note(log, "reused", named.name);
      return named;
    }
  }
  if (value == null) {
    if (ref) throw new Error(`Variable not found: ${ref} (pass a value to create it)`);
    return null;
  }
  const same = await findByValue(type, value, family);
  if (same) { note(log, "reused", same.name); return same; }
  if (!ref && !autoName) return null;
  const name = ref ?? await freeName(autoName!, type);
  const col = await collectionFor(type);
  const created = figma.variables.createVariable(name, col, type);
  created.setValueForMode(col.defaultModeId, value);
  note(log, "created", `${col.name}/${name}`);
  return created;
};

// ── styles ────────────────────────────────────────────────────────────────────

export const resolveStyle = async (ref: string, kind: "TEXT" | "EFFECT") => {
  const list: BaseStyle[] = kind === "TEXT" ? await figma.getLocalTextStylesAsync() : await figma.getLocalEffectStylesAsync();
  const style = list.find((s) => s.id === ref || s.name === ref);
  if (!style) throw new Error(`${kind === "TEXT" ? "Text" : "Effect"} style not found: ${ref}`);
  return style;
};

export const ensureTextStyle = async (ref: string | undefined, p: any, log?: TokenLog): Promise<TextStyle | null> => {
  const styles = await figma.getLocalTextStylesAsync();
  if (ref) {
    const named = styles.find((s) => s.id === ref || s.name === ref);
    if (named) { note(log, "reused", named.name); return named; }
  }
  const hasFont = p.fontFamily || p.fontStyle || p.fontSize != null;
  if (!hasFont) {
    if (ref) throw new Error(`Text style not found: ${ref} (pass fontFamily/fontStyle/fontSize to create it)`);
    return null;
  }
  const family = p.fontFamily || "Inter";
  const fontStyle = p.fontStyle || "Regular";
  const size = p.fontSize != null ? Number(p.fontSize) : 14;
  const same = styles.find((s) => s.fontName.family === family && s.fontName.style === fontStyle && s.fontSize === size);
  if (same) { note(log, "reused", same.name); return same; }
  if (!ref) return null;
  await figma.loadFontAsync({ family, style: fontStyle });
  const style = figma.createTextStyle();
  style.name = ref;
  style.fontName = { family, style: fontStyle };
  style.fontSize = size;
  if (p.lineHeight != null) style.lineHeight = parseTextMeasure(p.lineHeight, true);
  if (p.letterSpacing != null) style.letterSpacing = parseTextMeasure(p.letterSpacing, false);
  if (p.textCase) style.textCase = p.textCase;
  if (p.textDecoration) style.textDecoration = p.textDecoration;
  note(log, "created", ref);
  return style;
};

export const effectName = (effects: readonly Effect[]) =>
  `Effect/${effects.map((e: any) => `${e.type.toLowerCase().replace("_", " ")} ${Math.round(e.radius ?? 0)}`).join(" + ")}`;

export const ensureEffectStyle = async (ref: string | undefined, effects: any[] | undefined, log?: TokenLog, auto = false): Promise<EffectStyle | null> => {
  const styles = await figma.getLocalEffectStylesAsync();
  if (ref) {
    const named = styles.find((s) => s.id === ref || s.name === ref);
    if (named) { note(log, "reused", named.name); return named; }
  }
  if (!Array.isArray(effects) || effects.length === 0) {
    if (ref) throw new Error(`Effect style not found: ${ref} (pass effects to create it)`);
    return null;
  }
  const figmaEffects = toFigmaEffects(effects);
  const key = effectKey(figmaEffects);
  const same = styles.find((s) => effectKey(s.effects) === key);
  if (same) { note(log, "reused", same.name); return same; }
  if (!ref && !auto) return null;
  const style = figma.createEffectStyle();
  style.name = ref ?? effectName(figmaEffects);
  style.effects = figmaEffects;
  note(log, "created", style.name);
  return style;
};

const measureKey = (m: any) => (m && m.unit && m.unit !== "AUTO" ? `${Math.round(m.value * 100) / 100}${m.unit === "PERCENT" ? "%" : ""}` : "auto");

// Links a TEXT node to the text style matching its current font, size, line height
// and letter spacing, creating "Text/<family> <style> <size>" when none matches.
export const autoTextStyle = async (node: any, log?: TokenLog): Promise<TextStyle | null> => {
  if (typeof node.fontName === "symbol" || typeof node.fontSize === "symbol" || typeof node.lineHeight === "symbol") return null;
  const key = (fn: FontName, size: number, lh: any, ls: any) =>
    `${fn.family}|${fn.style}|${size}|${measureKey(lh)}|${ls && ls.value ? measureKey(ls) : "0"}`;
  const want = key(node.fontName, node.fontSize, node.lineHeight, node.letterSpacing);
  const styles = await figma.getLocalTextStylesAsync();
  let style = styles.find((s) => key(s.fontName, s.fontSize, s.lineHeight, s.letterSpacing) === want) ?? null;
  if (style) {
    note(log, "reused", style.name);
  } else {
    const base = `Text/${node.fontName.family} ${node.fontName.style} ${node.fontSize}${measureKey(node.lineHeight) === "auto" ? "" : `/${measureKey(node.lineHeight)}`}`;
    const taken = new Set(styles.map((s) => s.name));
    let name = base;
    for (let i = 2; taken.has(name); i++) name = `${base}-${i}`;
    style = figma.createTextStyle();
    style.name = name;
    style.fontName = node.fontName;
    style.fontSize = node.fontSize;
    if (node.lineHeight) style.lineHeight = node.lineHeight;
    if (node.letterSpacing) style.letterSpacing = node.letterSpacing;
    note(log, "created", name);
  }
  await node.setTextStyleIdAsync(style.id);
  return style;
};

// ── binding ───────────────────────────────────────────────────────────────────

export const boundPaint = (variable: Variable, opacity?: number) => {
  const paint = figma.variables.setBoundVariableForPaint(makeSolidPaint("#000000"), "color", variable);
  return opacity != null && opacity !== 1 ? { ...paint, opacity: Number(opacity) } : paint;
};

// A solid paint bound to the colour variable for `hex` (named or matched), or null.
export const tokenPaint = async (ref: string | undefined, hex: string | undefined, opacity: number | undefined, link: boolean, log?: TokenLog) => {
  if (!ref && (!hex || !link)) return null;
  const rgba = hex ? hexToRgba(hex, opacity) : undefined;
  const auto = rgba && link ? `color/${colorKey(rgba).slice(1)}` : undefined;
  const variable = await ensureVariable(ref, "COLOR", rgba, log, undefined, auto);
  // The variable carries any alpha, so the paint opacity stays at 1.
  return variable ? boundPaint(variable, ref && !hex ? opacity : undefined) : null;
};

// Applies the token parameters shared by the create_* tools.
export const applyTokens = async (node: any, p: any, log: TokenLog) => {
  const link = p.link !== false;
  const fill = await tokenPaint(p.fillVariable, p.fillColor, p.opacity, link, log);
  if (fill) node.fills = [fill];
  if (p.strokeVariable || p.strokeColor) {
    const stroke = await tokenPaint(p.strokeVariable, p.strokeColor, undefined, link, log) ?? makeSolidPaint(p.strokeColor);
    node.strokes = [stroke];
    node.strokeWeight = p.strokeWeight != null ? Number(p.strokeWeight) : (node.strokeWeight || 1);
  }
  if ((p.radiusVariable || (link && p.cornerRadius > 0)) && "cornerRadius" in node) {
    const r = p.cornerRadius != null ? Number(p.cornerRadius) : undefined;
    const v = await ensureVariable(p.radiusVariable, "FLOAT", r, log, RADIUS_NAME, link && r ? `radius/${r}` : undefined);
    if (v) for (const corner of CORNERS) node.setBoundVariable(corner, v);
  }
  if (node.layoutMode && node.layoutMode !== "NONE") {
    const pads = PADDINGS.map((k) => (p[k] != null ? Number(p[k]) : undefined));
    if (p.paddingVariable) {
      const value = pads.find((v) => v != null);
      const v = await ensureVariable(p.paddingVariable, "FLOAT", value, log, SPACE_NAME, link && value ? `space/${value}` : undefined);
      if (v) for (const side of PADDINGS) node.setBoundVariable(side, v);
    } else if (link) {
      for (let i = 0; i < PADDINGS.length; i++) {
        if (!pads[i]) continue;
        const v = await ensureVariable(undefined, "FLOAT", pads[i], log, SPACE_NAME, `space/${pads[i]}`);
        if (v) node.setBoundVariable(PADDINGS[i], v);
      }
    }
    if (p.gapVariable || (link && p.itemSpacing > 0)) {
      const gap = p.itemSpacing != null ? Number(p.itemSpacing) : undefined;
      const v = await ensureVariable(p.gapVariable, "FLOAT", gap, log, SPACE_NAME, link && gap ? `space/${gap}` : undefined);
      if (v) node.setBoundVariable("itemSpacing", v);
    }
  }
  if (p.effectStyle || (link && Array.isArray(p.effects) && p.effects.length > 0)) {
    const style = await ensureEffectStyle(p.effectStyle, p.effects, log, link);
    if (style) await node.setEffectStyleIdAsync(style.id);
  }
};

// Links a TEXT node to a text style, loading the style's font first.
export const linkTextStyle = async (node: TextNode, style: TextStyle) => {
  await figma.loadFontAsync(style.fontName);
  await node.setTextStyleIdAsync(style.id);
};

export const logData = (log: TokenLog) =>
  log.created.length || log.reused.length ? { tokens: log } : {};
