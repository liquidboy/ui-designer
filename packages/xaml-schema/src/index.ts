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

export type XamlDiagnosticSeverity = 'error' | 'warning';

export interface XamlSourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface XamlSourceSpan {
  start: XamlSourcePosition;
  end: XamlSourcePosition;
}

export interface XamlDiagnostic {
  severity: XamlDiagnosticSeverity;
  code: string;
  message: string;
  span?: XamlSourceSpan;
}

export type XamlParseDiagnostic = XamlDiagnostic;

export interface XamlQualifiedName {
  rawName: string;
  prefix: string | null;
  localName: string;
  namespaceUri: string | null;
}

export interface XamlNamespaceDeclaration {
  prefix: string | null;
  namespaceUri: string;
  span?: XamlSourceSpan;
}

export type XamlInfosetNode = XamlDocumentNode | XamlObjectNode | XamlMemberNode | XamlTextNode;

export type XamlValueNode = XamlObjectNode | XamlTextNode;

export type XamlMemberSyntax = 'attribute' | 'propertyElement' | 'content';

export interface XamlDottedMember {
  owner: XamlQualifiedName;
  member: string;
}

export interface XamlDocumentNode {
  kind: 'document';
  root: XamlObjectNode | null;
  namespaces: XamlNamespaceDeclaration[];
  diagnostics: XamlDiagnostic[];
  span?: XamlSourceSpan;
}

export interface XamlObjectNode {
  kind: 'object';
  type: XamlQualifiedName;
  members: XamlMemberNode[];
  namespaceDeclarations: XamlNamespaceDeclaration[];
  span?: XamlSourceSpan;
}

export interface XamlMemberNode {
  kind: 'member';
  name: XamlQualifiedName;
  syntax: XamlMemberSyntax;
  values: XamlValueNode[];
  isDirective: boolean;
  isAttached: boolean;
  dotted?: XamlDottedMember;
  span?: XamlSourceSpan;
}

export interface XamlTextNode {
  kind: 'text';
  text: string;
  span?: XamlSourceSpan;
}

export interface XamlParseOptions {
  preserveWhitespace?: boolean;
  sourceName?: string;
}

export interface XamlParseResult {
  document: XamlDocumentNode | null;
  diagnostics: XamlDiagnostic[];
}

export const XAML_LANGUAGE_NAMESPACE = 'http://schemas.microsoft.com/winfx/2006/xaml';
export const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
export const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

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
