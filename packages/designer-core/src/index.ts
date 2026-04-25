import { parseAndLowerXaml, serializeXamlDocumentNode } from '@ui-designer/xaml-parser';
import type { ColorRgba, Point as CorePoint } from '@ui-designer/ui-core';
import {
  XAML_LANGUAGE_NAMESPACE,
  XML_NAMESPACE,
  resolveXamlAttachedMember,
  resolveXamlDirective,
  resolveXamlMember,
  resolveXamlType,
  uiDesignerVocabularyRegistry,
  type XamlDiagnostic,
  type XamlDocument,
  type XamlDocumentNode,
  type XamlDottedMember,
  type XamlMarkupExtensionArgument,
  type XamlMarkupExtensionNode,
  type XamlMemberNode,
  type XamlNamespaceDeclaration,
  type XamlNode,
  type XamlObjectNode,
  type XamlPrimitive,
  type XamlQualifiedName,
  type XamlSourceSpan,
  type XamlTypeDefinition,
  type XamlValueNode
} from '@ui-designer/xaml-schema';

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

export interface DesignerDocument extends XamlDocument {
  readonly semanticInfoset?: XamlDocumentNode;
}

export type DesignerDocumentDiagnostic = XamlDiagnostic;

export interface DesignerDocumentParseResult {
  document: DesignerDocument | null;
  diagnostics: DesignerDocumentDiagnostic[];
  hasErrors: boolean;
}

export interface CloneXamlDocumentOptions {
  preserveSemanticInfoset?: boolean;
}

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

export function formatDesignerDocumentDiagnostic(diagnostic: DesignerDocumentDiagnostic): string {
  const location = diagnostic.span
    ? ` at ${diagnostic.span.start.line}:${diagnostic.span.start.column}`
    : '';
  const label = diagnostic.severity === 'error' ? 'Error' : 'Warning';
  return `${label} ${diagnostic.code}${location}: ${diagnostic.message}`;
}

export function parseDesignerDocumentWithDiagnostics(xaml: string): DesignerDocumentParseResult {
  const result = parseAndLowerXaml(xaml);
  const diagnostics = result.diagnostics;
  const hasErrors = result.hasErrors;

  if (!result.legacyDocument || hasErrors) {
    return {
      document: null,
      diagnostics,
      hasErrors: true
    };
  }

  return {
    document: {
      root: result.legacyDocument.root,
      semanticInfoset: result.document ?? undefined
    },
    diagnostics,
    hasErrors: false
  };
}

export function parseDesignerDocument(xaml: string): DesignerDocument {
  const result = parseDesignerDocumentWithDiagnostics(xaml);
  if (!result.document) {
    const reason = result.diagnostics.length > 0
      ? result.diagnostics.map(formatDesignerDocumentDiagnostic).join('\n')
      : 'Invalid XAML document.';
    throw new Error(reason);
  }

  return result.document;
}

export function cloneXamlNode(node: XamlNode): XamlNode {
  return {
    type: node.type,
    attributes: { ...node.attributes },
    children: node.children.map(cloneXamlNode),
    text: node.text
  };
}

function cloneXamlSourceSpan(span: XamlSourceSpan | undefined): XamlSourceSpan | undefined {
  return span
    ? {
        start: { ...span.start },
        end: { ...span.end }
      }
    : undefined;
}

function cloneXamlQualifiedName(name: XamlQualifiedName): XamlQualifiedName {
  return { ...name };
}

function cloneXamlNamespaceDeclaration(declaration: XamlNamespaceDeclaration): XamlNamespaceDeclaration {
  return {
    ...declaration,
    span: cloneXamlSourceSpan(declaration.span)
  };
}

function cloneXamlDottedMember(dotted: XamlDottedMember | undefined): XamlDottedMember | undefined {
  return dotted
    ? {
        owner: cloneXamlQualifiedName(dotted.owner),
        member: dotted.member
      }
    : undefined;
}

function cloneXamlMarkupExtensionArgument(
  argument: XamlMarkupExtensionArgument
): XamlMarkupExtensionArgument {
  return {
    ...argument,
    value:
      typeof argument.value === 'string'
        ? argument.value
        : cloneXamlMarkupExtensionNode(argument.value)
  };
}

function cloneXamlMarkupExtensionNode(node: XamlMarkupExtensionNode): XamlMarkupExtensionNode {
  return {
    kind: 'markupExtension',
    type: cloneXamlQualifiedName(node.type),
    arguments: node.arguments.map(cloneXamlMarkupExtensionArgument),
    raw: node.raw,
    span: cloneXamlSourceSpan(node.span)
  };
}

function cloneXamlValueNode(node: XamlValueNode): XamlValueNode {
  if (node.kind === 'object') {
    return cloneXamlObjectNode(node);
  }

  if (node.kind === 'markupExtension') {
    return cloneXamlMarkupExtensionNode(node);
  }

  return {
    kind: 'text',
    text: node.text,
    preservesXmlSpace: node.preservesXmlSpace,
    span: cloneXamlSourceSpan(node.span)
  };
}

function cloneXamlMemberNode(member: XamlMemberNode): XamlMemberNode {
  return {
    kind: 'member',
    name: cloneXamlQualifiedName(member.name),
    syntax: member.syntax,
    values: member.values.map(cloneXamlValueNode),
    isDirective: member.isDirective,
    isAttached: member.isAttached,
    dotted: cloneXamlDottedMember(member.dotted),
    span: cloneXamlSourceSpan(member.span)
  };
}

function cloneXamlObjectNode(node: XamlObjectNode): XamlObjectNode {
  return {
    kind: 'object',
    type: cloneXamlQualifiedName(node.type),
    members: node.members.map(cloneXamlMemberNode),
    namespaceDeclarations: node.namespaceDeclarations.map(cloneXamlNamespaceDeclaration),
    xmlLang: node.xmlLang,
    preservesXmlSpace: node.preservesXmlSpace,
    span: cloneXamlSourceSpan(node.span)
  };
}

function cloneXamlDocumentNode(document: XamlDocumentNode): XamlDocumentNode {
  return {
    kind: 'document',
    root: document.root ? cloneXamlObjectNode(document.root) : null,
    namespaces: document.namespaces.map(cloneXamlNamespaceDeclaration),
    diagnostics: document.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      span: cloneXamlSourceSpan(diagnostic.span)
    })),
    span: cloneXamlSourceSpan(document.span)
  };
}

export function cloneXamlDocument(
  document: DesignerDocument,
  options: CloneXamlDocumentOptions = {}
): DesignerDocument {
  const next: DesignerDocument = {
    root: cloneXamlNode(document.root)
  };

  if ((options.preserveSemanticInfoset ?? true) && document.semanticInfoset) {
    return {
      ...next,
      semanticInfoset: cloneXamlDocumentNode(document.semanticInfoset)
    };
  }

  return next;
}

function markDesignerDocumentEdited(document: DesignerDocument): DesignerDocument {
  return {
    root: document.root
  };
}

function syntheticQualifiedName(localName: string): XamlQualifiedName {
  return {
    rawName: localName,
    prefix: null,
    localName,
    namespaceUri: null
  };
}

function qualifiedNameForType(typeName: string, owner: XamlObjectNode | null): XamlQualifiedName {
  const prefix = owner?.type.prefix ?? null;
  const namespaceUri = owner?.type.namespaceUri ?? null;
  return {
    rawName: prefix ? `${prefix}:${typeName}` : typeName,
    prefix,
    localName: typeName,
    namespaceUri
  };
}

function hasNamespaceDeclaration(object: XamlObjectNode, prefix: string | null, namespaceUri: string): boolean {
  return object.namespaceDeclarations.some((declaration) => {
    return declaration.prefix === prefix && declaration.namespaceUri === namespaceUri;
  });
}

function ensureNamespaceDeclaration(
  document: XamlDocumentNode,
  object: XamlObjectNode,
  prefix: string | null,
  namespaceUri: string
): void {
  if (!hasNamespaceDeclaration(object, prefix, namespaceUri)) {
    object.namespaceDeclarations.push({ prefix, namespaceUri });
  }

  if (
    !document.namespaces.some((declaration) => {
      return declaration.prefix === prefix && declaration.namespaceUri === namespaceUri;
    })
  ) {
    document.namespaces.push({ prefix, namespaceUri });
  }
}

function primitiveToText(value: XamlPrimitive): string {
  return formatPrimitive(value);
}

function textValueNode(value: XamlPrimitive): XamlValueNode {
  return {
    kind: 'text',
    text: primitiveToText(value)
  };
}

function isXamlPrimitiveValue(value: unknown): value is XamlPrimitive {
  return value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function semanticLowerDirectiveName(member: XamlMemberNode): string {
  return resolveXamlDirective(member.name, uiDesignerVocabularyRegistry)?.name ?? qualifiedNameToString(member.name);
}

function qualifiedNameToString(name: XamlQualifiedName): string {
  return name.prefix ? `${name.prefix}:${name.localName}` : name.localName;
}

function semanticLowerMemberName(member: XamlMemberNode, ownerType: XamlTypeDefinition | null): string {
  if (member.isDirective) {
    return semanticLowerDirectiveName(member);
  }

  if (member.dotted) {
    if (ownerType && member.dotted.owner.localName === ownerType.name) {
      return resolveXamlMember(ownerType, member.dotted.member, uiDesignerVocabularyRegistry)?.name ?? member.dotted.member;
    }

    const attached = resolveXamlAttachedMember(
      member.dotted.owner.localName,
      member.dotted.member,
      uiDesignerVocabularyRegistry
    );
    return attached ? `${attached.attachedOwner}.${attached.name}` : `${member.dotted.owner.localName}.${member.dotted.member}`;
  }

  return ownerType
    ? resolveXamlMember(ownerType, member.name, uiDesignerVocabularyRegistry)?.name ?? qualifiedNameToString(member.name)
    : qualifiedNameToString(member.name);
}

function semanticMemberMatchesLegacyKey(
  member: XamlMemberNode,
  ownerType: XamlTypeDefinition | null,
  key: string
): boolean {
  if (semanticLowerMemberName(member, ownerType) === key) {
    return true;
  }

  return member.syntax === 'content' && ownerType?.contentProperty === key;
}

interface SemanticObjectChildEntry {
  kind: 'object';
  object: XamlObjectNode;
  ownerObject: XamlObjectNode;
  member: XamlMemberNode;
  valueIndex: number;
}

interface SemanticWrapperChildEntry {
  kind: 'wrapper';
  ownerObject: XamlObjectNode;
  member: XamlMemberNode;
}

type SemanticChildEntry = SemanticObjectChildEntry | SemanticWrapperChildEntry;

interface SemanticObjectTarget {
  kind: 'object';
  object: XamlObjectNode;
}

interface SemanticMemberValuesTarget {
  kind: 'memberValues';
  ownerObject: XamlObjectNode;
  member: XamlMemberNode;
}

type SemanticPathTarget = SemanticObjectTarget | SemanticMemberValuesTarget;

function objectValueEntries(
  ownerObject: XamlObjectNode,
  member: XamlMemberNode
): SemanticObjectChildEntry[] {
  return member.values.flatMap((value, valueIndex) => {
    return value.kind === 'object'
      ? [{
          kind: 'object' as const,
          object: value,
          ownerObject,
          member,
          valueIndex
        }]
      : [];
  });
}

function semanticLegacyChildEntriesForObject(object: XamlObjectNode): SemanticChildEntry[] {
  const ownerType = resolveXamlType(object.type, uiDesignerVocabularyRegistry);
  const entries: SemanticChildEntry[] = [];

  for (const member of object.members) {
    if (member.syntax === 'content') {
      entries.push(...objectValueEntries(object, member));
      continue;
    }

    if (member.syntax !== 'propertyElement') {
      continue;
    }

    const valueObjects = objectValueEntries(object, member);
    if (valueObjects.length === 0) {
      continue;
    }

    if (ownerType?.contentProperty === semanticLowerMemberName(member, ownerType)) {
      entries.push(...valueObjects);
      continue;
    }

    entries.push({
      kind: 'wrapper',
      ownerObject: object,
      member
    });
  }

  return entries;
}

function semanticLegacyChildEntriesForTarget(target: SemanticPathTarget): SemanticChildEntry[] {
  if (target.kind === 'object') {
    return semanticLegacyChildEntriesForObject(target.object);
  }

  return objectValueEntries(target.ownerObject, target.member);
}

function semanticTargetFromChildEntry(entry: SemanticChildEntry): SemanticPathTarget {
  return entry.kind === 'object'
    ? {
        kind: 'object',
        object: entry.object
      }
    : {
        kind: 'memberValues',
        ownerObject: entry.ownerObject,
        member: entry.member
      };
}

function findSemanticTargetByPath(root: XamlObjectNode, path: number[]): SemanticPathTarget | null {
  let target: SemanticPathTarget = {
    kind: 'object',
    object: root
  };

  for (const segment of path) {
    const entries = semanticLegacyChildEntriesForTarget(target);
    const entry = entries[segment];
    if (!entry) {
      return null;
    }

    target = semanticTargetFromChildEntry(entry);
  }

  return target;
}

function findSemanticChildEntryByPath(root: XamlObjectNode, path: number[]): SemanticChildEntry | null {
  if (path.length === 0) {
    return null;
  }

  const parentTarget = findSemanticTargetByPath(root, path.slice(0, -1));
  if (!parentTarget) {
    return null;
  }

  return semanticLegacyChildEntriesForTarget(parentTarget)[path[path.length - 1]] ?? null;
}

function removeSemanticChildEntry(entry: SemanticChildEntry): boolean {
  if (entry.kind === 'wrapper') {
    const index = entry.ownerObject.members.indexOf(entry.member);
    if (index < 0) {
      return false;
    }

    entry.ownerObject.members.splice(index, 1);
    return true;
  }

  if (entry.member.values[entry.valueIndex] !== entry.object) {
    return false;
  }

  entry.member.values.splice(entry.valueIndex, 1);
  if (entry.member.syntax === 'content' && entry.member.values.length === 0) {
    const memberIndex = entry.ownerObject.members.indexOf(entry.member);
    if (memberIndex >= 0) {
      entry.ownerObject.members.splice(memberIndex, 1);
    }
  }

  return true;
}

function findContentMember(object: XamlObjectNode): XamlMemberNode | null {
  return object.members.find((member) => member.syntax === 'content') ?? null;
}

function getOrCreateContentMember(object: XamlObjectNode): XamlMemberNode {
  const existing = findContentMember(object);
  if (existing) {
    return existing;
  }

  const member: XamlMemberNode = {
    kind: 'member',
    name: syntheticQualifiedName('Content'),
    syntax: 'content',
    values: [],
    isDirective: false,
    isAttached: false
  };
  object.members.push(member);
  return member;
}

function contentMemberValueIndexForLegacyInsertion(
  object: XamlObjectNode,
  member: XamlMemberNode,
  legacyIndex: number
): number {
  const entries = semanticLegacyChildEntriesForObject(object);
  const boundedIndex = Math.max(0, Math.min(entries.length, Math.floor(legacyIndex)));
  const objectEntries = objectValueEntries(object, member);
  const objectInsertIndex = entries.slice(0, boundedIndex).filter((entry) => {
    return entry.kind === 'object' && entry.member === member;
  }).length;

  if (objectInsertIndex >= objectEntries.length) {
    return member.values.length;
  }

  return objectEntries[objectInsertIndex].valueIndex;
}

function semanticMemberValueIndexForInsertion(member: XamlMemberNode, index: number): number {
  const objects = member.values.flatMap((value, valueIndex) => {
    return value.kind === 'object' ? [valueIndex] : [];
  });
  const boundedIndex = Math.max(0, Math.min(objects.length, Math.floor(index)));
  return boundedIndex >= objects.length ? member.values.length : objects[boundedIndex];
}

function insertSemanticObjectIntoTarget(
  target: SemanticPathTarget,
  node: XamlNode,
  index: number,
  document: XamlDocumentNode
): boolean {
  if (target.kind === 'memberValues') {
    const ownerObject = target.ownerObject;
    const valueIndex = semanticMemberValueIndexForInsertion(target.member, index);
    target.member.values.splice(valueIndex, 0, xamlNodeToSemanticObject(node, ownerObject, document));
    return true;
  }

  const member = getOrCreateContentMember(target.object);
  const valueIndex = contentMemberValueIndexForLegacyInsertion(target.object, member, index);
  member.values.splice(valueIndex, 0, xamlNodeToSemanticObject(node, target.object, document));
  return true;
}

function insertExistingSemanticObjectIntoTarget(
  target: SemanticPathTarget,
  object: XamlObjectNode,
  index: number
): boolean {
  if (target.kind === 'memberValues') {
    const valueIndex = semanticMemberValueIndexForInsertion(target.member, index);
    target.member.values.splice(valueIndex, 0, object);
    return true;
  }

  const member = getOrCreateContentMember(target.object);
  const valueIndex = contentMemberValueIndexForLegacyInsertion(target.object, member, index);
  member.values.splice(valueIndex, 0, object);
  return true;
}

function directiveQualifiedNameForLegacyKey(
  key: string,
  document: XamlDocumentNode,
  object: XamlObjectNode
): XamlQualifiedName | null {
  if (['Name', 'Key', 'Class', 'Uid', 'TypeArguments'].includes(key)) {
    ensureNamespaceDeclaration(document, object, 'x', XAML_LANGUAGE_NAMESPACE);
    return {
      rawName: `x:${key}`,
      prefix: 'x',
      localName: key,
      namespaceUri: XAML_LANGUAGE_NAMESPACE
    };
  }

  if (key === 'lang' || key === 'space') {
    return {
      rawName: `xml:${key}`,
      prefix: 'xml',
      localName: key,
      namespaceUri: XML_NAMESPACE
    };
  }

  return null;
}

function createDottedMemberFromLegacyKey(key: string): XamlDottedMember | undefined {
  const dotIndex = key.indexOf('.');
  if (dotIndex <= 0 || dotIndex === key.length - 1) {
    return undefined;
  }

  const ownerName = key.slice(0, dotIndex);
  return {
    owner: syntheticQualifiedName(ownerName),
    member: key.slice(dotIndex + 1)
  };
}

function createSemanticMemberForLegacyKey(
  key: string,
  value: XamlPrimitive,
  document: XamlDocumentNode,
  object: XamlObjectNode
): XamlMemberNode {
  const directiveName = directiveQualifiedNameForLegacyKey(key, document, object);
  const name = directiveName ?? syntheticQualifiedName(key);
  const dotted = directiveName ? undefined : createDottedMemberFromLegacyKey(key);

  return {
    kind: 'member',
    name,
    syntax: 'attribute',
    values: [textValueNode(value)],
    isDirective: Boolean(directiveName),
    isAttached: Boolean(dotted),
    dotted
  };
}

function updateSemanticObjectAttribute(
  object: XamlObjectNode,
  key: string,
  value: XamlPrimitive | null | undefined,
  document: XamlDocumentNode
): boolean {
  const ownerType = resolveXamlType(object.type, uiDesignerVocabularyRegistry);
  const matchingMembers = object.members.filter((member) => semanticMemberMatchesLegacyKey(member, ownerType, key));

  if (value == null) {
    object.members = object.members.filter((member) => !matchingMembers.includes(member));
    return true;
  }

  if (matchingMembers.length > 0) {
    for (const member of matchingMembers) {
      member.values = [textValueNode(value)];
    }
    return true;
  }

  object.members.push(createSemanticMemberForLegacyKey(key, value, document, object));
  return true;
}

function xamlNodeToSemanticObject(
  node: XamlNode,
  owner: XamlObjectNode | null,
  document: XamlDocumentNode
): XamlObjectNode {
  const object: XamlObjectNode = {
    kind: 'object',
    type: qualifiedNameForType(node.type, owner),
    members: [],
    namespaceDeclarations: [],
    span: undefined
  };

  for (const [key, value] of Object.entries(node.attributes)) {
    if (value != null && isXamlPrimitiveValue(value)) {
      object.members.push(createSemanticMemberForLegacyKey(key, value, document, object));
    }
  }

  const contentValues: XamlValueNode[] = node.children.map((child) => xamlNodeToSemanticObject(child, object, document));
  if (node.text != null && !Object.prototype.hasOwnProperty.call(node.attributes, 'Text') && !Object.prototype.hasOwnProperty.call(node.attributes, 'Content')) {
    contentValues.unshift({
      kind: 'text',
      text: node.text
    });
  }

  if (contentValues.length > 0) {
    object.members.push({
      kind: 'member',
      name: syntheticQualifiedName('Content'),
      syntax: 'content',
      values: contentValues,
      isDirective: false,
      isAttached: false
    });
  }

  return object;
}

function syncSemanticAttributes(
  document: DesignerDocument,
  path: number[],
  patch: Record<string, XamlPrimitive | null | undefined>
): boolean {
  const semanticDocument = document.semanticInfoset;
  if (!semanticDocument?.root) {
    return !semanticDocument;
  }

  const target = findSemanticTargetByPath(semanticDocument.root, path);
  if (!target || target.kind !== 'object') {
    return false;
  }

  for (const [key, value] of Object.entries(patch)) {
    if (!updateSemanticObjectAttribute(target.object, key, value, semanticDocument)) {
      return false;
    }
  }

  return true;
}

function syncSemanticInsert(
  document: DesignerDocument,
  parentPath: number[],
  node: XamlNode,
  index: number
): boolean {
  const semanticDocument = document.semanticInfoset;
  if (!semanticDocument?.root) {
    return !semanticDocument;
  }

  const target = findSemanticTargetByPath(semanticDocument.root, parentPath);
  return target ? insertSemanticObjectIntoTarget(target, node, index, semanticDocument) : false;
}

function syncSemanticRemove(document: DesignerDocument, path: number[]): boolean {
  const semanticDocument = document.semanticInfoset;
  if (!semanticDocument?.root) {
    return !semanticDocument;
  }

  const entry = findSemanticChildEntryByPath(semanticDocument.root, path);
  return entry ? removeSemanticChildEntry(entry) : false;
}

function syncSemanticMove(
  document: DesignerDocument,
  sourcePath: number[],
  targetParentPath: number[],
  targetIndex: number
): boolean {
  const semanticDocument = document.semanticInfoset;
  if (!semanticDocument?.root) {
    return !semanticDocument;
  }

  const sourceEntry = findSemanticChildEntryByPath(semanticDocument.root, sourcePath);
  if (!sourceEntry || sourceEntry.kind !== 'object') {
    return false;
  }

  const movingObject = sourceEntry.object;
  if (!removeSemanticChildEntry(sourceEntry)) {
    return false;
  }

  const target = findSemanticTargetByPath(semanticDocument.root, targetParentPath);
  return target ? insertExistingSemanticObjectIntoTarget(target, movingObject, targetIndex) : false;
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

function pathStartsWith(path: number[], prefix: number[]): boolean {
  if (prefix.length > path.length) {
    return false;
  }

  for (let index = 0; index < prefix.length; index += 1) {
    if (path[index] !== prefix[index]) {
      return false;
    }
  }

  return true;
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((segment, index) => segment === b[index]);
}

function adjustPathAfterRemoval(path: number[], removedPath: number[]): number[] {
  if (removedPath.length === 0) {
    return [...path];
  }

  const compareDepth = removedPath.length - 1;
  const sharesParent = removedPath.slice(0, compareDepth).every((segment, index) => path[index] === segment);

  if (!sharesParent || path.length <= compareDepth) {
    return [...path];
  }

  const next = [...path];
  const removedIndex = removedPath[compareDepth];
  if (next[compareDepth] > removedIndex) {
    next[compareDepth] -= 1;
  }

  return next;
}

function documentIdFromPath(path: number[]): string {
  return ['root', '0', ...path.map(String)].join('.');
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
  document: DesignerDocument,
  id: string,
  patch: Record<string, XamlPrimitive | null | undefined>
): DesignerDocument {
  const path = parseDocumentPath(id);
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

  return path && syncSemanticAttributes(next, path, patch) ? next : markDesignerDocumentEdited(next);
}

export function insertDocumentChild(
  document: DesignerDocument,
  parentId: string,
  node: XamlNode,
  index = Number.POSITIVE_INFINITY
): DesignerDocument {
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
  return syncSemanticInsert(next, path, node, insertIndex) ? next : markDesignerDocumentEdited(next);
}

export function removeDocumentNode(document: DesignerDocument, id: string): DesignerDocument {
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
  return syncSemanticRemove(next, path) ? next : markDesignerDocumentEdited(next);
}

export function moveDocumentNode(
  document: DesignerDocument,
  sourceId: string,
  targetParentId: string,
  targetIndex: number
): { document: DesignerDocument; movedId: string } | null {
  const sourcePath = parseDocumentPath(sourceId);
  const targetParentPath = parseDocumentPath(targetParentId);
  if (!sourcePath || !targetParentPath || sourcePath.length === 0) {
    return null;
  }

  if (pathStartsWith(targetParentPath, sourcePath)) {
    return null;
  }

  const sourceNode = findDocumentNodeById(document, sourceId);
  if (!sourceNode) {
    return null;
  }

  const sourceParentPath = sourcePath.slice(0, -1);
  const sourceIndex = sourcePath[sourcePath.length - 1];
  const sameParent = pathsEqual(sourceParentPath, targetParentPath);
  const adjustedTargetIndex = sameParent && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const nextTargetParentPath = adjustPathAfterRemoval(targetParentPath, sourcePath);

  const next = cloneXamlDocument(document);
  const nextSourceEntry = findParentEntryByPath(next.root, sourcePath);
  if (!nextSourceEntry) {
    return null;
  }

  const [movingNode] = nextSourceEntry.parent.children.splice(nextSourceEntry.index, 1);
  const targetParent = findNodeByPath(next.root, nextTargetParentPath);
  if (!targetParent) {
    return null;
  }

  const boundedIndex = Math.max(0, Math.min(targetParent.children.length, Math.floor(adjustedTargetIndex)));
  targetParent.children.splice(boundedIndex, 0, movingNode);
  const semanticSynced = syncSemanticMove(next, sourcePath, nextTargetParentPath, boundedIndex);

  return {
    document: semanticSynced ? next : markDesignerDocumentEdited(next),
    movedId: documentIdFromPath([...nextTargetParentPath, boundedIndex])
  };
}

function formatPrimitive(value: XamlPrimitive): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function formatAttributeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatAttributeValue).join(',');
  }

  if (value && typeof value === 'object' && 'type' in value) {
    return `[${String((value as XamlNode).type)}]`;
  }

  return isXamlPrimitiveValue(value) ? formatPrimitive(value) : String(value);
}

function serializeNode(node: XamlNode, depth: number): string {
  const indent = '  '.repeat(depth);
  const attributes = Object.entries(node.attributes)
    .map(([key, value]) => `${key}="${formatAttributeValue(value)}"`)
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

export function serializeDesignerDocument(document: DesignerDocument): string {
  if (document.semanticInfoset) {
    return serializeXamlDocumentNode(document.semanticInfoset);
  }

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

export function applyOverrideSnapshotToDocument(
  document: DesignerDocument,
  snapshot: DesignerOverrideSnapshot
): DesignerDocument {
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
