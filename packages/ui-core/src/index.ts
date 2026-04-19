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

export interface DrawRectCommand {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: ColorRgba;
}

export type DrawCommand = DrawRectCommand;

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

function defaultSizeFor(type: string, props: Record<string, unknown>): Size {
  const normalized = type.toLowerCase();

  if (normalized === 'textblock') {
    const text = typeof props.Text === 'string' ? props.Text : '';
    const width = Math.max(80, text.length * 8 + 16);
    return { width, height: 28 };
  }

  if (normalized === 'button') {
    const content = typeof props.Content === 'string' ? props.Content : '';
    const width = Math.max(120, content.length * 8 + 28);
    return { width, height: 36 };
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

  element.layout = {
    x: availableRect.x,
    y: availableRect.y,
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

function colorFromProps(props: Record<string, unknown>, fallback: ColorRgba): ColorRgba {
  const candidate = props.Background ?? props.Fill;
  if (typeof candidate === 'string') {
    return colorFromHex(candidate) ?? fallback;
  }

  return fallback;
}

function pushRect(commands: DrawCommand[], rect: LayoutRect, color: ColorRgba): void {
  if (rect.width <= 0 || rect.height <= 0 || color.a <= 0) {
    return;
  }

  commands.push({
    kind: 'rect',
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color
  });
}

function emitElementCommands(commands: DrawCommand[], element: UiElement): void {
  const t = element.type.toLowerCase();

  if (t === 'canvas') {
    pushRect(commands, element.layout, colorFromProps(element.props, { r: 0.1, g: 0.12, b: 0.16, a: 1 }));
  } else if (t === 'grid') {
    pushRect(commands, element.layout, colorFromProps(element.props, { r: 0.14, g: 0.17, b: 0.22, a: 1 }));
  } else if (t === 'stackpanel') {
    pushRect(commands, element.layout, colorFromProps(element.props, { r: 0.12, g: 0.15, b: 0.2, a: 0.9 }));
  } else if (t === 'border') {
    pushRect(commands, element.layout, colorFromProps(element.props, { r: 0.2, g: 0.23, b: 0.29, a: 1 }));
  } else if (t === 'rectangle') {
    pushRect(commands, element.layout, colorFromProps(element.props, { r: 0.34, g: 0.48, b: 0.92, a: 1 }));
  } else if (t === 'button') {
    pushRect(commands, element.layout, colorFromProps(element.props, { r: 0.2, g: 0.41, b: 0.8, a: 1 }));

    const labelBar: LayoutRect = {
      x: element.layout.x + 10,
      y: element.layout.y + element.layout.height / 2 - 3,
      width: Math.max(28, element.layout.width - 20),
      height: 6
    };
    pushRect(commands, labelBar, { r: 0.92, g: 0.95, b: 1, a: 0.8 });
  } else if (t === 'textblock') {
    const line: LayoutRect = {
      x: element.layout.x,
      y: element.layout.y + element.layout.height / 2 - 3,
      width: Math.max(24, element.layout.width),
      height: 6
    };

    pushRect(commands, line, colorFromProps(element.props, { r: 0.9, g: 0.93, b: 1, a: 0.95 }));
  }

  for (const child of element.children) {
    emitElementCommands(commands, child);
  }
}

export function buildDrawCommands(root: UiElement): DrawCommand[] {
  const commands: DrawCommand[] = [];
  emitElementCommands(commands, root);
  return commands;
}
