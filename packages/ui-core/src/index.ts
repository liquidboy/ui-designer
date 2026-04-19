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

export function runLayout(root: UiElement, availableSize: Size): UiElement {
  root.layout = {
    x: 0,
    y: 0,
    width: availableSize.width,
    height: availableSize.height
  };

  for (const child of root.children) {
    child.layout = {
      x: 16,
      y: 16,
      width: Math.max(0, availableSize.width - 32),
      height: 56
    };
  }

  return root;
}
