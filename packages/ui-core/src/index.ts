import type { XamlNode } from '@ui-designer/xaml-schema';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutRect extends Size, Point {}

export interface UiElement {
  id: string;
  type: string;
  props: Record<string, unknown>;
  layout: LayoutRect;
  children: UiElement[];
}

export interface ColorRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface DrawBoundsCommand {
  kind: 'bounds';
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawRectCommand {
  kind: 'rect';
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: ColorRgba;
}

export type TextHorizontalAlign = 'left' | 'center' | 'right';

export type TextVerticalAlign = 'top' | 'middle' | 'bottom';

export type TextWrapMode = 'none' | 'wrap';

export type TextOverflowMode = 'visible' | 'clip' | 'ellipsis';

export type ImageStretchMode = 'fill' | 'uniform' | 'uniformToFill' | 'none';

export interface DrawTextCommand {
  kind: 'text';
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: ColorRgba;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  lineHeight: number;
  align: TextHorizontalAlign;
  verticalAlign: TextVerticalAlign;
  wrapping: TextWrapMode;
  overflow: TextOverflowMode;
}

export interface DrawImageCommand {
  kind: 'image';
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  source: string;
  opacity: number;
  stretch: ImageStretchMode;
}

export type DrawCommand = DrawBoundsCommand | DrawRectCommand | DrawTextCommand | DrawImageCommand;

export interface DrawCommandOptions {
  hoveredElementId?: string | null;
  selectedElementId?: string | null;
}

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  lineHeight: number;
}

interface MeasuredTextBlock {
  width: number;
  height: number;
  lineHeight: number;
}

interface TextMeasureOptions {
  maxWidth?: number;
  wrapping: TextWrapMode;
}

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface TextRenderConfig {
  text: string;
  style: TextStyle;
  align: TextHorizontalAlign;
  verticalAlign: TextVerticalAlign;
  wrapping: TextWrapMode;
  overflow: TextOverflowMode;
  insets: Insets;
  fallbackColor: ColorRgba;
  allowBackgroundColorFallback: boolean;
  minSize: Size;
}

interface ImageRenderConfig {
  source: string;
  opacity: number;
  stretch: ImageStretchMode;
  minSize: Size;
}

const DEFAULT_TEXT_FONT_FAMILY = '"Segoe UI", system-ui, sans-serif';
const DEFAULT_TEXT_FONT_SIZE = 16;
const DEFAULT_TEXT_FONT_WEIGHT = '400';
const DEFAULT_BUTTON_FONT_SIZE = 15;
const DEFAULT_BUTTON_FONT_WEIGHT = '600';
const DEFAULT_TEXT_FONT_STYLE = 'normal';
const DEFAULT_IMAGE_SIZE = { width: 220, height: 140 };

let measurementContext: CanvasRenderingContext2D | null | undefined;

function toUiElement(node: XamlNode, idPrefix: string, index: number): UiElement {
  const id = `${idPrefix}.${index}`;
  const children = node.children.map((child: XamlNode, childIndex: number) =>
    toUiElement(child, id, childIndex)
  );

  return {
    id,
    type: node.type,
    props: { ...node.attributes, text: node.text },
    layout: { x: 0, y: 0, width: 0, height: 0 },
    children
  };
}

export function buildUiTree(rootNode: XamlNode): UiElement {
  return toUiElement(rootNode, 'root', 0);
}

function clampSize(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function propNumber(props: Record<string, unknown>, key: string): number | null {
  return asNumber(props[key]);
}

function stringProp(props: Record<string, unknown>, key: string): string | null {
  const value = props[key];
  return typeof value === 'string' ? value : null;
}

function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (measurementContext !== undefined) {
    return measurementContext;
  }

  if (typeof document === 'undefined') {
    measurementContext = null;
    return measurementContext;
  }

  const canvas = document.createElement('canvas');
  measurementContext = canvas.getContext('2d');
  return measurementContext;
}

function normalizeFontWeight(value: string | number | null, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${Math.max(100, Math.min(900, Math.round(value / 100) * 100))}`;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed === 'normal') {
    return '400';
  }

  if (trimmed === 'bold') {
    return '700';
  }

  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) {
    return `${Math.max(100, Math.min(900, Math.round(parsed / 100) * 100))}`;
  }

  return fallback;
}

function normalizeFontStyle(value: string | null, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'italic' || trimmed === 'oblique') {
    return trimmed;
  }

  if (trimmed === 'normal') {
    return 'normal';
  }

  return fallback;
}

function normalizeFontFamily(value: string | null, fallback: string): string {
  const base = value?.trim() || fallback;
  const normalized = base.toLowerCase();

  if (
    normalized.includes('system-ui') ||
    normalized.includes('sans-serif') ||
    normalized.includes('serif') ||
    normalized.includes('monospace') ||
    normalized.includes('cursive') ||
    normalized.includes('fantasy')
  ) {
    return base;
  }

  return `${base}, ${fallback}`;
}

function fontString(style: TextStyle): string {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
}

function textStyleFromProps(
  props: Record<string, unknown>,
  defaults: { fontSize: number; fontWeight: string; fontFamily?: string }
): TextStyle {
  const fontSize = Math.max(1, propNumber(props, 'FontSize') ?? defaults.fontSize);
  const fontWeight = normalizeFontWeight(props.FontWeight as string | number | null, defaults.fontWeight);
  const fontStyle = normalizeFontStyle(stringProp(props, 'FontStyle'), DEFAULT_TEXT_FONT_STYLE);
  const fontFamily = normalizeFontFamily(stringProp(props, 'FontFamily'), defaults.fontFamily || DEFAULT_TEXT_FONT_FAMILY);
  const lineHeight = Math.max(fontSize, propNumber(props, 'LineHeight') ?? Math.ceil(fontSize * 1.25));

  return {
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    lineHeight
  };
}

function measureTextWidth(text: string, style: TextStyle, context: CanvasRenderingContext2D | null): number {
  if (!text) {
    return 0;
  }

  if (context) {
    context.font = fontString(style);
    return context.measureText(text).width;
  }

  return text.length * style.fontSize * 0.58;
}

function splitLongToken(
  token: string,
  style: TextStyle,
  maxWidth: number,
  context: CanvasRenderingContext2D | null
): string[] {
  if (!token) {
    return [''];
  }

  const parts: string[] = [];
  let current = '';

  for (const character of [...token]) {
    const candidate = current + character;
    if (current && measureTextWidth(candidate, style, context) > maxWidth) {
      parts.push(current);
      current = character;
      continue;
    }

    current = candidate;
  }

  if (current) {
    parts.push(current);
  }

  return parts.length > 0 ? parts : [''];
}

function wrapParagraph(
  paragraph: string,
  style: TextStyle,
  maxWidth: number,
  context: CanvasRenderingContext2D | null
): string[] {
  if (maxWidth <= 0) {
    return paragraph ? [paragraph] : [''];
  }

  const tokens = paragraph.match(/\s+|\S+/g) ?? [];
  if (tokens.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    if (/^\s+$/.test(token) && current.length === 0) {
      continue;
    }

    const normalizedToken = current ? token : token.trimStart();
    if (!normalizedToken) {
      continue;
    }

    if (!current && measureTextWidth(normalizedToken, style, context) > maxWidth) {
      const pieces = splitLongToken(normalizedToken, style, maxWidth, context);
      for (let index = 0; index < pieces.length; index += 1) {
        const piece = pieces[index];
        if (index === pieces.length - 1) {
          current = piece;
        } else {
          lines.push(piece);
        }
      }
      continue;
    }

    const candidate = current + normalizedToken;
    if (!current || measureTextWidth(candidate, style, context) <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current.trimEnd());
    current = '';

    const trimmedToken = token.trimStart();
    if (!trimmedToken) {
      continue;
    }

    if (measureTextWidth(trimmedToken, style, context) <= maxWidth) {
      current = trimmedToken;
      continue;
    }

    const pieces = splitLongToken(trimmedToken, style, maxWidth, context);
    for (let index = 0; index < pieces.length; index += 1) {
      const piece = pieces[index];
      if (index === pieces.length - 1) {
        current = piece;
      } else {
        lines.push(piece);
      }
    }
  }

  if (current || lines.length === 0) {
    lines.push(current.trimEnd());
  }

  return lines;
}

function measureTextBlock(text: string, style: TextStyle, options: TextMeasureOptions): MeasuredTextBlock {
  const paragraphs = text.split(/\r?\n/);
  const context = getMeasurementContext();

  let width = 0;
  let ascent = Math.ceil(style.fontSize * 0.8);
  let descent = Math.ceil(style.fontSize * 0.2);

  if (context) {
    context.font = fontString(style);
    const probe = context.measureText('Hg');
    ascent = Math.max(ascent, Math.ceil(probe.actualBoundingBoxAscent || style.fontSize * 0.8));
    descent = Math.max(descent, Math.ceil(probe.actualBoundingBoxDescent || style.fontSize * 0.2));
  }

  const lines =
    options.wrapping === 'wrap' && Number.isFinite(options.maxWidth)
      ? paragraphs.flatMap((paragraph) => wrapParagraph(paragraph, style, Math.max(0, options.maxWidth ?? 0), context))
      : paragraphs;

  for (const line of lines) {
    width = Math.max(width, measureTextWidth(line || ' ', style, context));
  }

  const measuredLineHeight = Math.max(style.lineHeight, ascent + descent);
  return {
    width: Math.ceil(width),
    height: measuredLineHeight * Math.max(lines.length, 1),
    lineHeight: measuredLineHeight
  };
}

function textContentFromProps(props: Record<string, unknown>, key: string): string {
  return stringProp(props, key) ?? '';
}

function textAlignFromProps(props: Record<string, unknown>, fallback: TextHorizontalAlign): TextHorizontalAlign {
  const value = stringProp(props, 'TextAlignment');
  if (!value) {
    return fallback;
  }

  switch (value.trim().toLowerCase()) {
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    default:
      return 'left';
  }
}

function textWrapFromProps(props: Record<string, unknown>, fallback: TextWrapMode): TextWrapMode {
  const value = stringProp(props, 'TextWrapping');
  if (!value) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'wrap' ? 'wrap' : 'none';
}

function textOverflowFromProps(props: Record<string, unknown>, fallback: TextOverflowMode): TextOverflowMode {
  const explicit = stringProp(props, 'TextOverflow');
  if (explicit) {
    const normalized = explicit.trim().toLowerCase();
    if (normalized === 'visible' || normalized === 'clip' || normalized === 'ellipsis') {
      return normalized;
    }
  }

  const trimming = stringProp(props, 'TextTrimming');
  if (trimming?.trim().toLowerCase().includes('ellipsis')) {
    return 'ellipsis';
  }

  return fallback;
}

function imageStretchFromProps(props: Record<string, unknown>, fallback: ImageStretchMode): ImageStretchMode {
  const value = stringProp(props, 'Stretch');
  if (!value) {
    return fallback;
  }

  switch (value.trim().toLowerCase()) {
    case 'none':
      return 'none';
    case 'uniform':
      return 'uniform';
    case 'uniformtofill':
      return 'uniformToFill';
    default:
      return 'fill';
  }
}

function imageOpacityFromProps(props: Record<string, unknown>, fallback: number): number {
  const value = propNumber(props, 'Opacity');
  if (value == null) {
    return fallback;
  }

  return Math.max(0, Math.min(1, value));
}

function imageRenderConfigForElement(type: string, props: Record<string, unknown>): ImageRenderConfig | null {
  if (type.toLowerCase() !== 'image') {
    return null;
  }

  const source = stringProp(props, 'Source')?.trim() ?? '';
  if (!source) {
    return null;
  }

  return {
    source,
    opacity: imageOpacityFromProps(props, 1),
    stretch: imageStretchFromProps(props, 'uniformToFill'),
    minSize: DEFAULT_IMAGE_SIZE
  };
}

function textRenderConfigForElement(type: string, props: Record<string, unknown>): TextRenderConfig | null {
  const normalized = type.toLowerCase();

  if (normalized === 'textblock') {
    return {
      text: textContentFromProps(props, 'Text'),
      style: textStyleFromProps(props, {
        fontSize: DEFAULT_TEXT_FONT_SIZE,
        fontWeight: DEFAULT_TEXT_FONT_WEIGHT
      }),
      align: textAlignFromProps(props, 'left'),
      verticalAlign: 'top',
      wrapping: textWrapFromProps(props, 'none'),
      overflow: textOverflowFromProps(props, 'clip'),
      insets: { top: 4, right: 0, bottom: 4, left: 0 },
      fallbackColor: { r: 0.9, g: 0.93, b: 1, a: 0.95 },
      allowBackgroundColorFallback: true,
      minSize: { width: 80, height: 28 }
    };
  }

  if (normalized === 'button') {
    return {
      text: textContentFromProps(props, 'Content'),
      style: textStyleFromProps(props, {
        fontSize: DEFAULT_BUTTON_FONT_SIZE,
        fontWeight: DEFAULT_BUTTON_FONT_WEIGHT
      }),
      align: textAlignFromProps(props, 'center'),
      verticalAlign: 'middle',
      wrapping: textWrapFromProps(props, 'none'),
      overflow: textOverflowFromProps(props, 'ellipsis'),
      insets: { top: 6, right: 14, bottom: 6, left: 14 },
      fallbackColor: { r: 0.97, g: 0.98, b: 1, a: 0.98 },
      allowBackgroundColorFallback: false,
      minSize: { width: 120, height: 36 }
    };
  }

  return null;
}

function measureTextElementSize(config: TextRenderConfig, widthConstraint?: number): Size {
  const textBoxWidth =
    widthConstraint == null
      ? undefined
      : Math.max(0, widthConstraint - config.insets.left - config.insets.right);
  const measured = measureTextBlock(config.text, config.style, {
    maxWidth: textBoxWidth,
    wrapping: config.wrapping === 'wrap' && textBoxWidth != null ? 'wrap' : 'none'
  });

  return {
    width: Math.max(
      config.minSize.width,
      widthConstraint ?? Math.ceil(measured.width + config.insets.left + config.insets.right)
    ),
    height: Math.max(config.minSize.height, Math.ceil(measured.height + config.insets.top + config.insets.bottom))
  };
}

function defaultSizeFor(type: string, props: Record<string, unknown>): Size {
  const normalized = type.toLowerCase();
  const textConfig = textRenderConfigForElement(normalized, props);
  if (textConfig) {
    return measureTextElementSize(textConfig);
  }

  const imageConfig = imageRenderConfigForElement(normalized, props);
  if (imageConfig) {
    return imageConfig.minSize;
  }

  if (normalized === 'rectangle') {
    return { width: 140, height: 72 };
  }

  if (normalized === 'border') {
    return { width: 180, height: 96 };
  }

  return { width: 120, height: 64 };
}

function computeOwnSize(element: UiElement, available: Size): Size {
  const explicitWidth = propNumber(element.props, 'Width');
  const explicitHeight = propNumber(element.props, 'Height');
  const textConfig = textRenderConfigForElement(element.type, element.props);

  if (textConfig) {
    const widthConstraint = explicitWidth ?? (textConfig.wrapping === 'wrap' ? available.width : undefined);
    const measured = measureTextElementSize(textConfig, widthConstraint);
    const width = explicitWidth ?? measured.width;
    const height = explicitHeight ?? measured.height;

    return {
      width: clampSize(Math.min(width, available.width)),
      height: clampSize(Math.min(height, available.height))
    };
  }

  const fallback = defaultSizeFor(element.type, element.props);

  const width = explicitWidth ?? (element.children.length > 0 ? available.width : fallback.width);
  const height = explicitHeight ?? (element.children.length > 0 ? available.height : fallback.height);

  return {
    width: clampSize(Math.min(width, available.width)),
    height: clampSize(Math.min(height, available.height))
  };
}

function layoutCanvasChildren(element: UiElement): void {
  for (const child of element.children) {
    const childSize = computeOwnSize(child, {
      width: element.layout.width,
      height: element.layout.height
    });

    const x =
      propNumber(child.props, 'X') ??
      propNumber(child.props, 'Canvas.Left') ??
      propNumber(child.props, 'Left') ??
      0;
    const y =
      propNumber(child.props, 'Y') ??
      propNumber(child.props, 'Canvas.Top') ??
      propNumber(child.props, 'Top') ??
      0;

    layoutElement(child, {
      x: element.layout.x + x,
      y: element.layout.y + y,
      width: Math.max(0, element.layout.width - x),
      height: Math.max(0, element.layout.height - y)
    });

    child.layout.width = childSize.width;
    child.layout.height = childSize.height;
  }
}

function layoutStackPanelChildren(element: UiElement): void {
  const spacing = propNumber(element.props, 'Spacing') ?? 8;
  let cursorY = element.layout.y;

  for (const child of element.children) {
    const childSize = computeOwnSize(child, {
      width: element.layout.width,
      height: Math.max(0, element.layout.height - (cursorY - element.layout.y))
    });

    layoutElement(child, {
      x: element.layout.x,
      y: cursorY,
      width: element.layout.width,
      height: childSize.height
    });

    child.layout.width = childSize.width;
    child.layout.height = childSize.height;

    cursorY += child.layout.height + spacing;
  }

  if (propNumber(element.props, 'Height') == null) {
    const used = cursorY - element.layout.y - (element.children.length > 0 ? spacing : 0);
    element.layout.height = clampSize(used);
  }
}

function layoutGridChildren(element: UiElement): void {
  const rows = Math.max(1, Math.floor(propNumber(element.props, 'Rows') ?? 1));
  const columns = Math.max(1, Math.floor(propNumber(element.props, 'Columns') ?? 1));
  const cellWidth = element.layout.width / columns;
  const cellHeight = element.layout.height / rows;

  for (const child of element.children) {
    const row = Math.max(0, Math.floor(propNumber(child.props, 'Grid.Row') ?? 0));
    const column = Math.max(0, Math.floor(propNumber(child.props, 'Grid.Column') ?? 0));

    const cellX = element.layout.x + Math.min(column, columns - 1) * cellWidth;
    const cellY = element.layout.y + Math.min(row, rows - 1) * cellHeight;

    layoutElement(child, {
      x: cellX,
      y: cellY,
      width: cellWidth,
      height: cellHeight
    });
  }
}

function layoutBorderChild(element: UiElement): void {
  const child = element.children[0];
  if (!child) {
    return;
  }

  const padding = propNumber(element.props, 'Padding') ?? 10;
  layoutElement(child, {
    x: element.layout.x + padding,
    y: element.layout.y + padding,
    width: Math.max(0, element.layout.width - padding * 2),
    height: Math.max(0, element.layout.height - padding * 2)
  });
}

function layoutElement(element: UiElement, availableRect: LayoutRect): void {
  const own = computeOwnSize(element, { width: availableRect.width, height: availableRect.height });
  const offsetX = propNumber(element.props, 'Designer.OffsetX') ?? 0;
  const offsetY = propNumber(element.props, 'Designer.OffsetY') ?? 0;

  element.layout = {
    x: availableRect.x + offsetX,
    y: availableRect.y + offsetY,
    width: own.width,
    height: own.height
  };

  const normalized = element.type.toLowerCase();

  if (normalized === 'canvas') {
    layoutCanvasChildren(element);
    return;
  }

  if (normalized === 'stackpanel') {
    layoutStackPanelChildren(element);
    return;
  }

  if (normalized === 'grid') {
    layoutGridChildren(element);
    return;
  }

  if (normalized === 'border') {
    layoutBorderChild(element);
  }
}

export function runLayout(root: UiElement, availableSize: Size): UiElement {
  layoutElement(root, {
    x: 0,
    y: 0,
    width: availableSize.width,
    height: availableSize.height
  });

  return root;
}

function colorFromHex(value: string): ColorRgba | null {
  const hex = value.trim();

  if (!hex.startsWith('#')) {
    return null;
  }

  const raw = hex.slice(1);

  if (raw.length === 3) {
    const r = Number.parseInt(raw[0] + raw[0], 16);
    const g = Number.parseInt(raw[1] + raw[1], 16);
    const b = Number.parseInt(raw[2] + raw[2], 16);
    return { r: r / 255, g: g / 255, b: b / 255, a: 1 };
  }

  if (raw.length === 6 || raw.length === 8) {
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    const a = raw.length === 8 ? Number.parseInt(raw.slice(6, 8), 16) / 255 : 1;

    if ([r, g, b, a].some((part) => Number.isNaN(part))) {
      return null;
    }

    return { r: r / 255, g: g / 255, b: b / 255, a };
  }

  return null;
}

function colorFromProps(
  props: Record<string, unknown>,
  fallback: ColorRgba,
  keys: readonly string[] = ['Background', 'Fill']
): ColorRgba {
  for (const key of keys) {
    const candidate = props[key];
    if (typeof candidate === 'string') {
      const color = colorFromHex(candidate);
      if (color) {
        return color;
      }
    }
  }

  return fallback;
}

function optionalColorFromProps(
  props: Record<string, unknown>,
  keys: readonly string[] = ['Background', 'Fill']
): ColorRgba | null {
  for (const key of keys) {
    const candidate = props[key];
    if (typeof candidate === 'string') {
      const color = colorFromHex(candidate);
      if (color) {
        return color;
      }
    }
  }

  return null;
}

function textColorFromProps(
  props: Record<string, unknown>,
  fallback: ColorRgba,
  allowBackgroundFallback = false
): ColorRgba {
  const keys = allowBackgroundFallback ? ['Foreground', 'Color', 'Background', 'Fill'] : ['Foreground', 'Color'];
  return colorFromProps(props, fallback, keys);
}

function pushBounds(commands: DrawCommand[], elementId: string, rect: LayoutRect): void {
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  commands.push({
    kind: 'bounds',
    elementId,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  });
}

function pushRect(commands: DrawCommand[], elementId: string, rect: LayoutRect, color: ColorRgba): void {
  if (rect.width <= 0 || rect.height <= 0 || color.a <= 0) {
    return;
  }

  commands.push({
    kind: 'rect',
    elementId,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color
  });
}

function pushText(
  commands: DrawCommand[],
  elementId: string,
  rect: LayoutRect,
  text: string,
  color: ColorRgba,
  style: TextStyle,
  align: TextHorizontalAlign,
  verticalAlign: TextVerticalAlign,
  wrapping: TextWrapMode,
  overflow: TextOverflowMode
): void {
  if (rect.width <= 0 || rect.height <= 0 || color.a <= 0 || !text) {
    return;
  }

  commands.push({
    kind: 'text',
    elementId,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    text,
    color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    align,
    verticalAlign,
    wrapping,
    overflow
  });
}

function pushImage(
  commands: DrawCommand[],
  elementId: string,
  rect: LayoutRect,
  source: string,
  opacity: number,
  stretch: ImageStretchMode
): void {
  if (rect.width <= 0 || rect.height <= 0 || opacity <= 0 || !source) {
    return;
  }

  commands.push({
    kind: 'image',
    elementId,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    source,
    opacity,
    stretch
  });
}

function emitOutline(
  commands: DrawCommand[],
  element: UiElement,
  color: ColorRgba,
  thickness: number
): void {
  const t = Math.max(1, thickness);
  const r = element.layout;

  pushRect(commands, element.id, { x: r.x, y: r.y, width: r.width, height: t }, color);
  pushRect(commands, element.id, { x: r.x, y: r.y + r.height - t, width: r.width, height: t }, color);
  pushRect(commands, element.id, { x: r.x, y: r.y, width: t, height: r.height }, color);
  pushRect(commands, element.id, { x: r.x + r.width - t, y: r.y, width: t, height: r.height }, color);
}

function emitElementCommands(commands: DrawCommand[], element: UiElement, options: DrawCommandOptions): void {
  const t = element.type.toLowerCase();
  pushBounds(commands, element.id, element.layout);
  const textConfig = textRenderConfigForElement(t, element.props);
  const imageConfig = imageRenderConfigForElement(t, element.props);

  if (t === 'canvas') {
    pushRect(
      commands,
      element.id,
      element.layout,
      colorFromProps(element.props, { r: 0.1, g: 0.12, b: 0.16, a: 1 })
    );
  } else if (t === 'grid') {
    pushRect(
      commands,
      element.id,
      element.layout,
      colorFromProps(element.props, { r: 0.14, g: 0.17, b: 0.22, a: 1 })
    );
  } else if (t === 'stackpanel') {
    pushRect(
      commands,
      element.id,
      element.layout,
      colorFromProps(element.props, { r: 0.12, g: 0.15, b: 0.2, a: 0.9 })
    );
  } else if (t === 'border') {
    pushRect(
      commands,
      element.id,
      element.layout,
      colorFromProps(element.props, { r: 0.2, g: 0.23, b: 0.29, a: 1 })
    );
  } else if (t === 'rectangle') {
    pushRect(
      commands,
      element.id,
      element.layout,
      colorFromProps(element.props, { r: 0.34, g: 0.48, b: 0.92, a: 1 })
    );
  } else if (t === 'button') {
    pushRect(
      commands,
      element.id,
      element.layout,
      colorFromProps(element.props, { r: 0.2, g: 0.41, b: 0.8, a: 1 })
    );
  } else if (t === 'image') {
    pushRect(
      commands,
      element.id,
      element.layout,
      optionalColorFromProps(element.props) ?? { r: 0.12, g: 0.15, b: 0.2, a: 0.72 }
    );
  }

  if (textConfig) {
    pushText(
      commands,
      element.id,
      {
        x: element.layout.x + textConfig.insets.left,
        y: element.layout.y + textConfig.insets.top,
        width: Math.max(0, element.layout.width - textConfig.insets.left - textConfig.insets.right),
        height: Math.max(0, element.layout.height - textConfig.insets.top - textConfig.insets.bottom)
      },
      textConfig.text,
      textColorFromProps(element.props, textConfig.fallbackColor, textConfig.allowBackgroundColorFallback),
      textConfig.style,
      textConfig.align,
      textConfig.verticalAlign,
      textConfig.wrapping,
      textConfig.overflow
    );
  }

  if (imageConfig) {
    pushImage(commands, element.id, element.layout, imageConfig.source, imageConfig.opacity, imageConfig.stretch);
  }

  if (options.hoveredElementId === element.id) {
    emitOutline(commands, element, { r: 0.96, g: 0.83, b: 0.3, a: 0.95 }, 2);
  }

  if (options.selectedElementId === element.id) {
    emitOutline(commands, element, { r: 0.35, g: 0.86, b: 0.98, a: 1 }, 3);
  }

  for (const child of element.children) {
    emitElementCommands(commands, child, options);
  }
}

export function buildDrawCommands(root: UiElement, options: DrawCommandOptions = {}): DrawCommand[] {
  const commands: DrawCommand[] = [];
  emitElementCommands(commands, root, options);
  return commands;
}

function containsPoint(rect: LayoutRect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

export function hitTest(root: UiElement, point: Point): UiElement | null {
  function walk(node: UiElement): UiElement | null {
    if (!containsPoint(node.layout, point)) {
      return null;
    }

    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      const candidate = walk(node.children[i]);
      if (candidate) {
        return candidate;
      }
    }

    return node;
  }

  return walk(root);
}

export function findElementById(root: UiElement, id: string): UiElement | null {
  function walk(node: UiElement): UiElement | null {
    if (node.id === id) {
      return node;
    }

    for (const child of node.children) {
      const found = walk(child);
      if (found) {
        return found;
      }
    }

    return null;
  }

  return walk(root);
}
