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
export const UI_DESIGNER_NAMESPACE = 'https://liquidboy.dev/ui-designer';
export const DESIGNER_METADATA_NAMESPACE = 'https://liquidboy.dev/ui-designer/designer';

export type XamlTextSyntaxKind =
  | 'any'
  | 'string'
  | 'number'
  | 'boolean'
  | 'color'
  | 'thickness'
  | 'enum'
  | 'uri'
  | 'object';

export type XamlMemberKind = 'property' | 'attached' | 'directive';

export type XamlCollectionKind = 'none' | 'list' | 'dictionary';

export interface XamlVocabularyNamespace {
  prefix: string | null;
  namespaceUri: string | null;
  description: string;
}

export interface XamlMemberDefinition {
  name: string;
  namespaceUri: string | null;
  kind: XamlMemberKind;
  valueSyntax: XamlTextSyntaxKind;
  aliases?: readonly string[];
  allowedValues?: readonly string[];
  declaringType?: string;
  attachedOwner?: string;
  isContent?: boolean;
  isCollection?: boolean;
  isRuntimeSupported: boolean;
  description?: string;
}

export interface XamlTypeDefinition {
  name: ControlType;
  namespaceUri: string | null;
  members: readonly XamlMemberDefinition[];
  contentProperty?: string;
  collectionKind: XamlCollectionKind;
  allowsText: boolean;
  allowsChildren: boolean;
  isRuntimeSupported: boolean;
}

export interface XamlVocabularyRegistry {
  namespaces: readonly XamlVocabularyNamespace[];
  types: readonly XamlTypeDefinition[];
  attachedMembers: readonly XamlMemberDefinition[];
  directives: readonly XamlMemberDefinition[];
}

export interface XamlValidationResult {
  diagnostics: XamlDiagnostic[];
  hasErrors: boolean;
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

type MemberOptions = Omit<XamlMemberDefinition, 'name' | 'namespaceUri' | 'kind' | 'valueSyntax' | 'isRuntimeSupported'> & {
  namespaceUri?: string | null;
  kind?: XamlMemberKind;
  isRuntimeSupported?: boolean;
};

function member(name: string, valueSyntax: XamlTextSyntaxKind, options: MemberOptions = {}): XamlMemberDefinition {
  return {
    name,
    namespaceUri: options.namespaceUri ?? null,
    kind: options.kind ?? 'property',
    valueSyntax,
    aliases: options.aliases,
    allowedValues: options.allowedValues,
    declaringType: options.declaringType,
    attachedOwner: options.attachedOwner,
    isContent: options.isContent,
    isCollection: options.isCollection,
    isRuntimeSupported: options.isRuntimeSupported ?? true,
    description: options.description
  };
}

const commonLayoutMembers = [
  member('Width', 'number'),
  member('Height', 'number'),
  member('Margin', 'thickness', { isRuntimeSupported: false }),
  member('Padding', 'thickness'),
  member('HorizontalAlignment', 'enum', {
    allowedValues: ['Left', 'Center', 'Right', 'Stretch'],
    isRuntimeSupported: false
  }),
  member('VerticalAlignment', 'enum', {
    allowedValues: ['Top', 'Center', 'Bottom', 'Stretch'],
    isRuntimeSupported: false
  }),
  member('Opacity', 'number'),
  member('Visibility', 'enum', {
    allowedValues: ['Visible', 'Hidden', 'Collapsed'],
    isRuntimeSupported: false
  }),
  member('X', 'number'),
  member('Y', 'number')
] as const;

const visualMembers = [
  member('Background', 'color'),
  member('BorderBrush', 'color'),
  member('BorderThickness', 'thickness')
] as const;

const textMembers = [
  member('Text', 'string'),
  member('Content', 'any', { isContent: true }),
  member('Foreground', 'color'),
  member('FontSize', 'number'),
  member('FontWeight', 'string'),
  member('FontFamily', 'string'),
  member('FontSource', 'uri'),
  member('FontStyle', 'enum', { allowedValues: ['Normal', 'Italic', 'Oblique'] }),
  member('LineHeight', 'number'),
  member('TextAlignment', 'enum', { allowedValues: ['Left', 'Center', 'Right'] }),
  member('TextWrapping', 'enum', { allowedValues: ['NoWrap', 'Wrap'] }),
  member('TextOverflow', 'enum', { allowedValues: ['Visible', 'Clip', 'Ellipsis'] }),
  member('TextTrimming', 'enum', { allowedValues: ['None', 'CharacterEllipsis'] }),
  member('FlowDirection', 'enum', { allowedValues: ['Auto', 'LeftToRight', 'RightToLeft'] }),
  member('Direction', 'enum', {
    aliases: ['FlowDirection'],
    allowedValues: ['Auto', 'LeftToRight', 'RightToLeft']
  })
] as const;

const imageMembers = [
  member('Source', 'uri'),
  member('Stretch', 'enum', { allowedValues: ['Fill', 'Uniform', 'UniformToFill', 'None'] })
] as const;

const eventMembers = [
  member('PointerDown', 'string', { isRuntimeSupported: false }),
  member('PointerMove', 'string', { isRuntimeSupported: false }),
  member('PointerUp', 'string', { isRuntimeSupported: false }),
  member('Click', 'string', { isRuntimeSupported: false })
] as const;

function typeDefinition(
  name: ControlType,
  options: Pick<XamlTypeDefinition, 'members' | 'contentProperty' | 'allowsText' | 'allowsChildren'> & {
    isRuntimeSupported?: boolean;
  }
): XamlTypeDefinition {
  return {
    name,
    namespaceUri: UI_DESIGNER_NAMESPACE,
    members: options.members,
    contentProperty: options.contentProperty,
    collectionKind: 'none',
    allowsText: options.allowsText,
    allowsChildren: options.allowsChildren,
    isRuntimeSupported: options.isRuntimeSupported ?? true
  };
}

export const uiDesignerAttachedMembers = [
  member('Row', 'number', { kind: 'attached', attachedOwner: 'Grid' }),
  member('Column', 'number', { kind: 'attached', attachedOwner: 'Grid' }),
  member('RowSpan', 'number', { kind: 'attached', attachedOwner: 'Grid' }),
  member('ColumnSpan', 'number', { kind: 'attached', attachedOwner: 'Grid' }),
  member('Left', 'number', { kind: 'attached', attachedOwner: 'Canvas', isRuntimeSupported: false }),
  member('Top', 'number', { kind: 'attached', attachedOwner: 'Canvas', isRuntimeSupported: false }),
  member('OffsetX', 'number', {
    namespaceUri: DESIGNER_METADATA_NAMESPACE,
    kind: 'attached',
    attachedOwner: 'Designer'
  }),
  member('OffsetY', 'number', {
    namespaceUri: DESIGNER_METADATA_NAMESPACE,
    kind: 'attached',
    attachedOwner: 'Designer'
  })
] as const;

export const xamlIntrinsicDirectives = [
  member('Name', 'string', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('Key', 'string', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('Class', 'string', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('Uid', 'string', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('TypeArguments', 'string', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('lang', 'string', {
    namespaceUri: XML_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('space', 'enum', {
    namespaceUri: XML_NAMESPACE,
    kind: 'directive',
    allowedValues: ['default', 'preserve'],
    isRuntimeSupported: false
  })
] as const;

export const uiDesignerTypes = [
  typeDefinition('Canvas', {
    members: [...commonLayoutMembers, ...eventMembers],
    contentProperty: 'Children',
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('StackPanel', {
    members: [...commonLayoutMembers, member('Spacing', 'number'), member('Orientation', 'enum', {
      allowedValues: ['Vertical', 'Horizontal'],
      isRuntimeSupported: false
    }), ...eventMembers],
    contentProperty: 'Children',
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Grid', {
    members: [...commonLayoutMembers, member('Rows', 'number'), member('Columns', 'number'), ...eventMembers],
    contentProperty: 'Children',
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Border', {
    members: [...commonLayoutMembers, ...visualMembers, member('Child', 'object', { isContent: true }), ...eventMembers],
    contentProperty: 'Child',
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Rectangle', {
    members: [...commonLayoutMembers, member('Fill', 'color'), ...eventMembers],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('TextBlock', {
    members: [...commonLayoutMembers, ...textMembers, ...eventMembers],
    contentProperty: 'Text',
    allowsText: true,
    allowsChildren: false
  }),
  typeDefinition('Image', {
    members: [...commonLayoutMembers, ...imageMembers, member('Background', 'color'), ...eventMembers],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('Button', {
    members: [...commonLayoutMembers, ...visualMembers, ...textMembers, ...eventMembers],
    contentProperty: 'Content',
    allowsText: true,
    allowsChildren: true
  })
] as const;

export const uiDesignerVocabularyRegistry: XamlVocabularyRegistry = {
  namespaces: [
    {
      prefix: null,
      namespaceUri: null,
      description: 'Legacy unqualified ui-designer vocabulary.'
    },
    {
      prefix: 'ui',
      namespaceUri: UI_DESIGNER_NAMESPACE,
      description: 'Explicit ui-designer vocabulary namespace.'
    },
    {
      prefix: 'x',
      namespaceUri: XAML_LANGUAGE_NAMESPACE,
      description: 'Intrinsic XAML language namespace.'
    },
    {
      prefix: 'xml',
      namespaceUri: XML_NAMESPACE,
      description: 'XML intrinsic namespace.'
    },
    {
      prefix: 'Designer',
      namespaceUri: DESIGNER_METADATA_NAMESPACE,
      description: 'ui-designer authoring metadata namespace.'
    }
  ],
  types: uiDesignerTypes,
  attachedMembers: uiDesignerAttachedMembers,
  directives: xamlIntrinsicDirectives
};

function namespacesMatch(actual: string | null, expected: string | null): boolean {
  return actual === expected || (actual == null && expected === UI_DESIGNER_NAMESPACE);
}

function localNameOf(name: string | XamlQualifiedName): string {
  return typeof name === 'string' ? name : name.localName;
}

function namespaceOf(name: string | XamlQualifiedName): string | null {
  return typeof name === 'string' ? null : name.namespaceUri;
}

export function resolveXamlType(
  name: string | XamlQualifiedName,
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry
): XamlTypeDefinition | null {
  const localName = localNameOf(name);
  const namespaceUri = namespaceOf(name);

  return registry.types.find((type) => type.name === localName && namespacesMatch(namespaceUri, type.namespaceUri)) ?? null;
}

export function resolveXamlDirective(
  name: string | XamlQualifiedName,
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry
): XamlMemberDefinition | null {
  const localName = localNameOf(name);
  const namespaceUri = namespaceOf(name);

  return registry.directives.find((directive) => directive.name === localName && directive.namespaceUri === namespaceUri) ?? null;
}

export function resolveXamlAttachedMember(
  ownerName: string,
  memberName: string,
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry
): XamlMemberDefinition | null {
  return (
    registry.attachedMembers.find((memberDefinition) => {
      return memberDefinition.attachedOwner === ownerName && memberDefinition.name === memberName;
    }) ?? null
  );
}

export function resolveXamlMember(
  typeName: string | XamlQualifiedName,
  memberName: string | XamlQualifiedName,
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry
): XamlMemberDefinition | null {
  const type = resolveXamlType(typeName, registry);
  if (!type) {
    return null;
  }

  const localName = localNameOf(memberName);
  return (
    type.members.find((memberDefinition) => {
      return memberDefinition.name === localName || memberDefinition.aliases?.includes(localName);
    }) ?? null
  );
}

function formatQualifiedName(name: string | XamlQualifiedName): string {
  if (typeof name === 'string') {
    return name;
  }

  return name.prefix ? `${name.prefix}:${name.localName}` : name.localName;
}

function registryHasNamespace(namespaceUri: string | null, registry: XamlVocabularyRegistry): boolean {
  return registry.namespaces.some((namespace) => namespace.namespaceUri === namespaceUri);
}

function validationDiagnostic(
  severity: XamlDiagnosticSeverity,
  code: string,
  message: string,
  node?: { span?: XamlSourceSpan }
): XamlDiagnostic {
  return {
    severity,
    code,
    message,
    span: node?.span
  };
}

function textFromValues(values: readonly XamlValueNode[]): string {
  return values
    .filter((value): value is XamlTextNode => value.kind === 'text')
    .map((value) => value.text)
    .join('');
}

function hasObjectValue(values: readonly XamlValueNode[]): boolean {
  return values.some((value) => value.kind === 'object');
}

function validateTextSyntax(member: XamlMemberNode, definition: XamlMemberDefinition, diagnostics: XamlDiagnostic[]): void {
  if (definition.valueSyntax === 'any') {
    return;
  }

  const text = textFromValues(member.values).trim();
  const hasObjects = hasObjectValue(member.values);

  if (hasObjects && definition.valueSyntax !== 'object') {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-member-object-value',
      `Member "${definition.name}" does not accept object values.`,
      member
    ));
  }

  if (!text) {
    return;
  }

  if (definition.valueSyntax === 'number' && !Number.isFinite(Number(text))) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-number-value',
      `Member "${definition.name}" expects a numeric value.`,
      member
    ));
  }

  if (definition.valueSyntax === 'boolean' && text !== 'true' && text !== 'false') {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-boolean-value',
      `Member "${definition.name}" expects "true" or "false".`,
      member
    ));
  }

  if (definition.valueSyntax === 'enum' && definition.allowedValues && !definition.allowedValues.includes(text)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-enum-value',
      `Member "${definition.name}" expects one of: ${definition.allowedValues.join(', ')}.`,
      member
    ));
  }
}

function warnUnsupportedMember(member: XamlMemberNode, definition: XamlMemberDefinition, diagnostics: XamlDiagnostic[]): void {
  if (definition.isRuntimeSupported) {
    return;
  }

  diagnostics.push(validationDiagnostic(
    'warning',
    definition.kind === 'directive' ? 'unsupported-directive' : 'unrenderable-member',
    `Member "${formatQualifiedName(member.name)}" is schema-valid but not runtime-supported yet.`,
    member
  ));
}

function validateResolvedMember(
  member: XamlMemberNode,
  definition: XamlMemberDefinition,
  diagnostics: XamlDiagnostic[]
): void {
  validateTextSyntax(member, definition, diagnostics);
  warnUnsupportedMember(member, definition, diagnostics);
}

function memberDuplicateKey(member: XamlMemberNode, definition: XamlMemberDefinition): string | null {
  if (definition.isCollection || member.syntax === 'content') {
    return null;
  }

  if (definition.kind === 'attached') {
    return `attached:${definition.attachedOwner ?? ''}.${definition.name}`;
  }

  return `${definition.kind}:${definition.namespaceUri ?? ''}:${definition.name}`;
}

function validateContentMember(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  member: XamlMemberNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry
): void {
  for (const value of member.values) {
    if (value.kind === 'object') {
      if (!type.allowsChildren) {
        diagnostics.push(validationDiagnostic(
          'error',
          'content-children-not-allowed',
          `Type "${type.name}" does not allow child objects.`,
          value
        ));
      }

      validateObjectNode(value, diagnostics, registry);
      continue;
    }

    if (value.text.trim() && !type.allowsText) {
      diagnostics.push(validationDiagnostic(
        'error',
        'content-text-not-allowed',
        `Type "${type.name}" does not allow text content.`,
        value
      ));
    }
  }

  if (!type.contentProperty && member.values.length > 0) {
    diagnostics.push(validationDiagnostic(
      'warning',
      'implicit-content-without-schema-member',
      `Type "${type.name}" received content, but no content property is declared yet.`,
      object
    ));
  }
}

function validateObjectNode(
  object: XamlObjectNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry
): void {
  if (!registryHasNamespace(object.type.namespaceUri, registry)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'unknown-namespace',
      `Unknown namespace "${object.type.namespaceUri}" for type "${formatQualifiedName(object.type)}".`,
      object
    ));
    return;
  }

  const type = resolveXamlType(object.type, registry);
  if (!type) {
    diagnostics.push(validationDiagnostic(
      'error',
      'unknown-type',
      `Unknown type "${formatQualifiedName(object.type)}".`,
      object
    ));
    return;
  }

  const assignedMembers = new Set<string>();

  for (const memberNode of object.members) {
    if (memberNode.syntax === 'content') {
      validateContentMember(object, type, memberNode, diagnostics, registry);
      continue;
    }

    let definition: XamlMemberDefinition | null = null;

    if (memberNode.isDirective) {
      definition = resolveXamlDirective(memberNode.name, registry);
      if (!definition) {
        diagnostics.push(validationDiagnostic(
          'error',
          'unknown-directive',
          `Unknown directive "${formatQualifiedName(memberNode.name)}".`,
          memberNode
        ));
        continue;
      }
    } else if (memberNode.dotted) {
      if (memberNode.dotted.owner.localName === type.name) {
        definition = resolveXamlMember(type.name, memberNode.dotted.member, registry);
      } else {
        definition = resolveXamlAttachedMember(memberNode.dotted.owner.localName, memberNode.dotted.member, registry);
      }

      if (!definition) {
        diagnostics.push(validationDiagnostic(
          'error',
          memberNode.dotted.owner.localName === type.name ? 'unknown-member' : 'unknown-attached-member',
          `Unknown member "${memberNode.dotted.owner.localName}.${memberNode.dotted.member}".`,
          memberNode
        ));
        continue;
      }
    } else {
      definition = resolveXamlMember(type.name, memberNode.name, registry);
      if (!definition) {
        diagnostics.push(validationDiagnostic(
          'error',
          'unknown-member',
          `Unknown member "${formatQualifiedName(memberNode.name)}" on type "${type.name}".`,
          memberNode
        ));
        continue;
      }
    }

    const duplicateKey = memberDuplicateKey(memberNode, definition);
    if (duplicateKey && assignedMembers.has(duplicateKey)) {
      diagnostics.push(validationDiagnostic(
        'error',
        'duplicate-member',
        `Member "${formatQualifiedName(memberNode.name)}" is assigned more than once.`,
        memberNode
      ));
      continue;
    }

    if (duplicateKey) {
      assignedMembers.add(duplicateKey);
    }

    validateResolvedMember(memberNode, definition, diagnostics);

    for (const value of memberNode.values) {
      if (value.kind === 'object') {
        validateObjectNode(value, diagnostics, registry);
      }
    }
  }
}

export function validateXamlDocument(
  document: XamlDocumentNode,
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry
): XamlValidationResult {
  const diagnostics = [...document.diagnostics];

  if (!document.root) {
    diagnostics.push({
      severity: 'error',
      code: 'missing-root',
      message: 'XAML document is missing a root object.'
    });
  } else {
    validateObjectNode(document.root, diagnostics, registry);
  }

  return {
    diagnostics,
    hasErrors: diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  };
}
