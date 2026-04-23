import { parseXaml } from '@ui-designer/xaml-parser';
import type { ColorRgba, Point as CorePoint } from '@ui-designer/ui-core';
import type { XamlDocument, XamlNode, XamlPrimitive } from '@ui-designer/xaml-schema';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface DesignerOverrideSnapshot {
  offsets: Record<string, CorePoint>;
  sizes: Record<string, { width: number; height: number }>;
  colors: Record<string, ColorRgba>;
}

export interface DesignerTreeItem {
  id: string;
  type: string;
  label: string;
  depth: number;
  parentId: string | null;
}

export type DesignerDocument = XamlDocument;

export function createCameraState(): CameraState {
  return { x: 0, y: 0, zoom: 1 };
}

export function worldToScreen(point: Vec2, camera: CameraState): Vec2 {
  return {
    x: (point.x - camera.x) * camera.zoom,
    y: (point.y - camera.y) * camera.zoom
  };
}

export function screenToWorld(point: Vec2, camera: CameraState): Vec2 {
  return {
    x: point.x / camera.zoom + camera.x,
    y: point.y / camera.zoom + camera.y
  };
}

export interface DesignerCommand {
  id: string;
  apply(): void;
  undo(): void;
}

export class CommandStack {
  private readonly undoStack: DesignerCommand[] = [];
  private readonly redoStack: DesignerCommand[] = [];

  execute(command: DesignerCommand): void {
    command.apply();
    this.undoStack.push(command);
    this.redoStack.length = 0;
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.apply();
    this.undoStack.push(cmd);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

export function parseDesignerDocument(xaml: string): XamlDocument {
  return parseXaml(xaml);
}

export function cloneXamlNode(node: XamlNode): XamlNode {
  return {
    type: node.type,
    attributes: { ...node.attributes },
    children: node.children.map(cloneXamlNode),
    text: node.text
  };
}

export function cloneXamlDocument(document: XamlDocument): XamlDocument {
  return {
    root: cloneXamlNode(document.root)
  };
}

function findNodeInTree(node: XamlNode, targetId: string, currentId: string): XamlNode | null {
  if (currentId === targetId) {
    return node;
  }

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    const childId = `${currentId}.${index}`;
    const found = findNodeInTree(child, targetId, childId);
    if (found) {
      return found;
    }
  }

  return null;
}

export function findDocumentNodeById(document: XamlDocument, id: string): XamlNode | null {
  return findNodeInTree(document.root, id, 'root.0');
}

function parseDocumentPath(id: string): number[] | null {
  const segments = id.split('.');
  if (segments[0] !== 'root' || segments[1] !== '0') {
    return null;
  }

  const path = segments.slice(2).map((segment) => Number.parseInt(segment, 10));
  return path.every((index) => Number.isInteger(index) && index >= 0) ? path : null;
}

function findNodeByPath(root: XamlNode, path: number[]): XamlNode | null {
  let current: XamlNode = root;

  for (const index of path) {
    const next = current.children[index];
    if (!next) {
      return null;
    }
    current = next;
  }

  return current;
}

function findParentEntryByPath(root: XamlNode, path: number[]): { parent: XamlNode; index: number } | null {
  if (path.length === 0) {
    return null;
  }

  const parent = findNodeByPath(root, path.slice(0, -1));
  const index = path[path.length - 1];
  if (!parent || index < 0 || index >= parent.children.length) {
    return null;
  }

  return { parent, index };
}

function inferTreeLabel(node: XamlNode): string {
  const text = node.attributes.Text;
  if (typeof text === 'string' && text.trim()) {
    return `${node.type} "${text}"`;
  }

  const content = node.attributes.Content;
  if (typeof content === 'string' && content.trim()) {
    return `${node.type} "${content}"`;
  }

  const name = node.attributes.Name;
  if (typeof name === 'string' && name.trim()) {
    return `${node.type} ${name}`;
  }

  return node.type;
}

function walkDocumentTree(
  node: XamlNode,
  id: string,
  depth: number,
  parentId: string | null,
  items: DesignerTreeItem[]
): void {
  items.push({
    id,
    type: node.type,
    label: inferTreeLabel(node),
    depth,
    parentId
  });

  for (let index = 0; index < node.children.length; index += 1) {
    walkDocumentTree(node.children[index], `${id}.${index}`, depth + 1, id, items);
  }
}

export function buildDesignerTree(document: XamlDocument): DesignerTreeItem[] {
  const items: DesignerTreeItem[] = [];
  walkDocumentTree(document.root, 'root.0', 0, null, items);
  return items;
}

export function updateDocumentNodeAttributes(
  document: XamlDocument,
  id: string,
  patch: Record<string, XamlPrimitive | null | undefined>
): XamlDocument {
  const next = cloneXamlDocument(document);
  const node = findDocumentNodeById(next, id);
  if (!node) {
    return next;
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value == null) {
      delete node.attributes[key];
      continue;
    }

    node.attributes[key] = value;
  }

  return next;
}

export function insertDocumentChild(
  document: XamlDocument,
  parentId: string,
  node: XamlNode,
  index = Number.POSITIVE_INFINITY
): XamlDocument {
  const path = parseDocumentPath(parentId);
  if (path == null) {
    return cloneXamlDocument(document);
  }

  const next = cloneXamlDocument(document);
  const parent = findNodeByPath(next.root, path);
  if (!parent) {
    return next;
  }

  const insertIndex = Math.max(0, Math.min(parent.children.length, Math.floor(index)));
  parent.children.splice(insertIndex, 0, cloneXamlNode(node));
  return next;
}

export function removeDocumentNode(document: XamlDocument, id: string): XamlDocument {
  const path = parseDocumentPath(id);
  if (!path || path.length === 0) {
    return cloneXamlDocument(document);
  }

  const next = cloneXamlDocument(document);
  const entry = findParentEntryByPath(next.root, path);
  if (!entry) {
    return next;
  }

  entry.parent.children.splice(entry.index, 1);
  return next;
}

function formatPrimitive(value: XamlPrimitive): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function serializeNode(node: XamlNode, depth: number): string {
  const indent = '  '.repeat(depth);
  const attributes = Object.entries(node.attributes)
    .map(([key, value]) => `${key}="${formatPrimitive(value)}"`)
    .join(' ');
  const tagOpen = attributes ? `<${node.type} ${attributes}` : `<${node.type}`;

  if (node.children.length === 0 && !node.text) {
    return `${indent}${tagOpen} />`;
  }

  if (node.children.length === 0 && node.text) {
    return `${indent}${tagOpen}>${node.text}</${node.type}>`;
  }

  const children = node.children.map((child) => serializeNode(child, depth + 1)).join('\n');
  return `${indent}${tagOpen}>\n${children}\n${indent}</${node.type}>`;
}

export function serializeDesignerDocument(document: XamlDocument): string {
  return serializeNode(document.root, 0);
}

function colorToHex(color: ColorRgba): string {
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function inferColorAttribute(node: XamlNode): string {
  if ('Background' in node.attributes) {
    return 'Background';
  }

  if ('Fill' in node.attributes) {
    return 'Fill';
  }

  return node.type.toLowerCase() === 'rectangle' ? 'Fill' : 'Background';
}

export function applyOverrideSnapshotToDocument(
  document: XamlDocument,
  snapshot: DesignerOverrideSnapshot
): XamlDocument {
  let next = cloneXamlDocument(document);

  for (const [id, point] of Object.entries(snapshot.offsets ?? {})) {
    next = updateDocumentNodeAttributes(next, id, {
      'Designer.OffsetX': point.x === 0 ? null : Math.round(point.x),
      'Designer.OffsetY': point.y === 0 ? null : Math.round(point.y)
    });
  }

  for (const [id, size] of Object.entries(snapshot.sizes ?? {})) {
    next = updateDocumentNodeAttributes(next, id, {
      Width: Math.round(size.width),
      Height: Math.round(size.height)
    });
  }

  for (const [id, color] of Object.entries(snapshot.colors ?? {})) {
    const node = findDocumentNodeById(next, id);
    if (!node) {
      continue;
    }

    next = updateDocumentNodeAttributes(next, id, {
      [inferColorAttribute(node)]: colorToHex(color)
    });
  }

  return next;
}
