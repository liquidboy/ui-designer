export type XamlPrimitive = string | number | boolean;

export interface XamlAttributeMap {
  [key: string]: XamlPrimitive;
}

export interface XamlNode {
  type: string;
  attributes: XamlAttributeMap;
  children: XamlNode[];
  text?: string;
}

export interface XamlDocument {
  root: XamlNode;
}

export const controlCatalog = [
  'Canvas',
  'StackPanel',
  'Grid',
  'Border',
  'Rectangle',
  'TextBlock',
  'Image',
  'Button'
] as const;

export type ControlType = (typeof controlCatalog)[number];
