import { cloneXamlNode, type DesignerDocument } from '@ui-designer/designer-core';
import { getImageNaturalSize, type ColorRgba, type UiElement } from '@ui-designer/ui-core';
import type { XamlNode } from '@ui-designer/xaml-schema';
import type { PaletteTemplate } from './presets';

export type TreeDropIntent = 'before' | 'inside' | 'after';

export interface DocumentFontEntry {
  family: string;
  source: string | null;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function colorToHex(color: ColorRgba | null): string | null {
  if (!color) {
    return null;
  }

  const r = Math.round(clamp01(color.r) * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(clamp01(color.g) * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(clamp01(color.b) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function parseHexColor(input: string): ColorRgba | null {
  const value = input.trim();
  const normalized = value.startsWith('#') ? value.slice(1) : value;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return { r, g, b, a: 1 };
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function isTextNode(node: XamlNode | null): node is XamlNode {
  const type = node?.type.toLowerCase();
  return type === 'textblock' || type === 'button';
}

export function isImageNode(node: XamlNode | null): node is XamlNode {
  return node?.type.toLowerCase() === 'image';
}

export function readStringAttribute(node: XamlNode | null, key: string): string {
  const value = node?.attributes[key];
  return typeof value === 'string' ? value : '';
}

export function walkDocumentNodes(node: XamlNode, visit: (current: XamlNode) => void): void {
  visit(node);
  for (const child of node.children) {
    walkDocumentNodes(child, visit);
  }
}

export function collectDocumentImageSources(document: DesignerDocument | null): string[] {
  if (!document) {
    return [];
  }

  const sources = new Set<string>();
  walkDocumentNodes(document.root, (node) => {
    if (!isImageNode(node)) {
      return;
    }

    const source = readStringAttribute(node, 'Source').trim();
    if (source) {
      sources.add(source);
    }
  });

  return Array.from(sources);
}

export function collectDocumentFontEntries(document: DesignerDocument | null): DocumentFontEntry[] {
  if (!document) {
    return [];
  }

  const entries = new Map<string, DocumentFontEntry>();
  walkDocumentNodes(document.root, (node) => {
    if (!isTextNode(node)) {
      return;
    }

    const family = readStringAttribute(node, 'FontFamily').trim();
    if (!family) {
      return;
    }

    const source = readStringAttribute(node, 'FontSource').trim() || null;
    const key = `${family}\u0000${source ?? ''}`;
    entries.set(key, { family, source });
  });

  return Array.from(entries.values());
}

export function collectDocumentFontFamilies(document: DesignerDocument | null): string[] {
  return collectDocumentFontEntries(document).map((entry) => entry.family);
}

export function resolveImageAspectRatio(node: XamlNode | null, element: UiElement | null): number {
  const source = readStringAttribute(node, 'Source').trim();
  const natural = source ? getImageNaturalSize(source) : null;
  const width = natural?.width ?? asFiniteNumber(node?.attributes.Width) ?? element?.layout.width ?? 220;
  const height = natural?.height ?? asFiniteNumber(node?.attributes.Height) ?? element?.layout.height ?? 140;

  if (width > 0 && height > 0) {
    return width / height;
  }

  return 220 / 140;
}

export function resolveAspectLockedSize(
  width: number,
  height: number,
  aspectRatio: number,
  previousWidth: number,
  previousHeight: number
): { width: number; height: number } {
  const widthDelta = Math.abs(width - previousWidth) / Math.max(previousWidth, 1);
  const heightDelta = Math.abs(height - previousHeight) / Math.max(previousHeight, 1);

  if (widthDelta >= heightDelta) {
    return {
      width,
      height: width / aspectRatio
    };
  }

  return {
    width: height * aspectRatio,
    height
  };
}

export function inferColorAttribute(
  node: { type: string; attributes: Record<string, unknown> }
): 'Background' | 'Fill' | 'Foreground' {
  if ('Foreground' in node.attributes) {
    return 'Foreground';
  }

  if ('Background' in node.attributes) {
    return 'Background';
  }

  if ('Fill' in node.attributes) {
    return 'Fill';
  }

  return node.type.toLowerCase() === 'textblock' ? 'Foreground' : node.type.toLowerCase() === 'rectangle' ? 'Fill' : 'Background';
}

export function canHostAdditionalChildren(node: XamlNode | null): boolean {
  if (!node) {
    return false;
  }

  switch (node.type.toLowerCase()) {
    case 'canvas':
    case 'grid':
    case 'stackpanel':
      return true;
    case 'border':
      return node.children.length === 0;
    default:
      return false;
  }
}

export function canInsertTemplateIntoParent(template: PaletteTemplate, parentNode: XamlNode | null): boolean {
  if (!parentNode || !canHostAdditionalChildren(parentNode)) {
    return false;
  }

  if (!template.parentTypes) {
    return true;
  }

  return template.parentTypes.includes(parentNode.type.toLowerCase());
}

export function applyContainerPlacement(parentNode: XamlNode, node: XamlNode, index: number): XamlNode {
  const next = cloneXamlNode(node);
  const parentType = parentNode.type.toLowerCase();

  delete next.attributes['Designer.OffsetX'];
  delete next.attributes['Designer.OffsetY'];
  delete next.attributes.X;
  delete next.attributes.Y;
  delete next.attributes['Canvas.Left'];
  delete next.attributes['Canvas.Top'];
  delete next.attributes.Left;
  delete next.attributes.Top;
  delete next.attributes['Grid.Row'];
  delete next.attributes['Grid.Column'];

  if (parentType === 'canvas') {
    next.attributes.X = 72 + (index % 4) * 196;
    next.attributes.Y = 72 + Math.floor(index / 4) * 144;
    return next;
  }

  if (parentType === 'grid') {
    const columns = Math.max(1, asFiniteNumber(parentNode.attributes.Columns) ?? 1);
    next.attributes['Grid.Row'] = Math.floor(index / columns);
    next.attributes['Grid.Column'] = index % columns;
  }

  return next;
}

export function createTemplateNode(template: PaletteTemplate, parentNode: XamlNode, index: number): XamlNode {
  return applyContainerPlacement(parentNode, template.build(index), index);
}

export function normalizeFileName(fileName: string | null | undefined, fallback: string): string {
  const value = fileName?.trim();
  return value ? value : fallback;
}

export function inferDropIntent(itemId: string, rect: DOMRect, clientY: number): TreeDropIntent {
  if (itemId === 'root.0') {
    return 'inside';
  }

  const relativeY = (clientY - rect.top) / Math.max(rect.height, 1);
  if (relativeY <= 0.28) {
    return 'before';
  }

  if (relativeY >= 0.72) {
    return 'after';
  }

  return 'inside';
}

export function getNodeIndexFromId(id: string): number | null {
  const segments = id.split('.');
  if (segments.length < 2) {
    return null;
  }

  const index = Number.parseInt(segments[segments.length - 1], 10);
  return Number.isInteger(index) && index >= 0 ? index : null;
}
