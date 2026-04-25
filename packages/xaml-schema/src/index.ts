export type XamlPrimitive = string | number | boolean | null;

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

export type XamlLegacyPrimitive = XamlPrimitive;

export type XamlLegacyAttributeMap = XamlAttributeMap;

export type XamlLegacyNode = XamlNode;

export type XamlLegacyDocument = XamlDocument;

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

export type XamlInfosetNode =
  | XamlDocumentNode
  | XamlObjectNode
  | XamlMemberNode
  | XamlTextNode
  | XamlMarkupExtensionNode;

export type XamlValueNode = XamlObjectNode | XamlTextNode | XamlMarkupExtensionNode;

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

export type XamlMarkupExtensionValue = string | XamlMarkupExtensionNode;

export type XamlMarkupExtensionArgument = XamlMarkupExtensionNamedArgument | XamlMarkupExtensionPositionalArgument;

export interface XamlMarkupExtensionNode {
  kind: 'markupExtension';
  type: XamlQualifiedName;
  arguments: XamlMarkupExtensionArgument[];
  raw: string;
  span?: XamlSourceSpan;
}

export interface XamlMarkupExtensionNamedArgument {
  kind: 'named';
  name: string;
  value: XamlMarkupExtensionValue;
}

export interface XamlMarkupExtensionPositionalArgument {
  kind: 'positional';
  value: XamlMarkupExtensionValue;
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
export const DESIGNER_THEME_NAMESPACE = 'https://liquidboy.dev/ui-designer/designer-theme';
export const DESIGNER_CHROME_NAMESPACE = 'https://liquidboy.dev/ui-designer/designer-chrome';
export const DESIGNER_PANELS_NAMESPACE = 'https://liquidboy.dev/ui-designer/designer-panels';

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
  name: string;
  namespaceUri: string | null;
  members: readonly XamlMemberDefinition[];
  contentProperty?: string;
  collectionKind: XamlCollectionKind;
  allowedContentTypes?: readonly string[];
  dictionaryKeyProperty?: string;
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

const runtimeControlContentTypes = [...controlCatalog] as const;

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

const resourceMembers = [
  member('Resources', 'object')
] as const;

type TypeDefinitionOptions = Pick<XamlTypeDefinition, 'members' | 'contentProperty' | 'allowsText' | 'allowsChildren'> & {
  namespaceUri?: string | null;
  collectionKind?: XamlCollectionKind;
  allowedContentTypes?: readonly string[];
  dictionaryKeyProperty?: string;
  isRuntimeSupported?: boolean;
};

function typeDefinition(name: string, options: TypeDefinitionOptions): XamlTypeDefinition {
  return {
    name,
    namespaceUri: options.namespaceUri ?? UI_DESIGNER_NAMESPACE,
    members: options.members,
    contentProperty: options.contentProperty,
    collectionKind: options.collectionKind ?? 'none',
    allowedContentTypes: options.allowedContentTypes,
    dictionaryKeyProperty: options.dictionaryKeyProperty,
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
  typeDefinition('ResourceDictionary', {
    members: [],
    contentProperty: 'Children',
    collectionKind: 'dictionary',
    allowedContentTypes: ['Color', 'Number', 'String'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Color', {
    members: [member('Value', 'color', { isContent: true })],
    contentProperty: 'Value',
    allowsText: true,
    allowsChildren: false
  }),
  typeDefinition('Number', {
    members: [member('Value', 'number', { isContent: true })],
    contentProperty: 'Value',
    allowsText: true,
    allowsChildren: false
  }),
  typeDefinition('String', {
    members: [member('Value', 'string', { isContent: true })],
    contentProperty: 'Value',
    allowsText: true,
    allowsChildren: false
  }),
  typeDefinition('Canvas', {
    members: [...commonLayoutMembers, ...resourceMembers, ...eventMembers],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: runtimeControlContentTypes,
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('StackPanel', {
    members: [...commonLayoutMembers, ...resourceMembers, member('Spacing', 'number'), member('Orientation', 'enum', {
      allowedValues: ['Vertical', 'Horizontal'],
      isRuntimeSupported: false
    }), ...eventMembers],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: runtimeControlContentTypes,
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Grid', {
    members: [...commonLayoutMembers, ...resourceMembers, member('Rows', 'number'), member('Columns', 'number'), ...eventMembers],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: runtimeControlContentTypes,
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Border', {
    members: [...commonLayoutMembers, ...resourceMembers, ...visualMembers, member('Child', 'object', { isContent: true }), ...eventMembers],
    contentProperty: 'Child',
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Rectangle', {
    members: [...commonLayoutMembers, ...resourceMembers, member('Fill', 'color'), ...eventMembers],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('TextBlock', {
    members: [...commonLayoutMembers, ...resourceMembers, ...textMembers, ...eventMembers],
    contentProperty: 'Text',
    allowsText: true,
    allowsChildren: false
  }),
  typeDefinition('Image', {
    members: [...commonLayoutMembers, ...resourceMembers, ...imageMembers, member('Background', 'color'), ...eventMembers],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('Button', {
    members: [...commonLayoutMembers, ...resourceMembers, ...visualMembers, ...textMembers, ...eventMembers],
    contentProperty: 'Content',
    allowsText: true,
    allowsChildren: true
  })
] as const;

export const designerThemeTypes = [
  typeDefinition('DesignerTheme', {
    namespaceUri: DESIGNER_THEME_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['Colors'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Colors', {
    namespaceUri: DESIGNER_THEME_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'dictionary',
    allowedContentTypes: ['Color'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Color', {
    namespaceUri: DESIGNER_THEME_NAMESPACE,
    members: [member('Id', 'string'), member('Value', 'color')],
    dictionaryKeyProperty: 'Id',
    allowsText: false,
    allowsChildren: false
  })
] as const;

export const designerChromeTypes = [
  typeDefinition('DesignerChrome', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['TopMenu', 'CommandBar', 'DockTabs', 'DocumentTabs', 'ToolStrip', 'SourceTabs', 'StatusBar'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('TopMenu', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['MenuItem'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('MenuItem', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [member('Id', 'string'), member('Label', 'string')],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('CommandBar', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['Command'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Command', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [member('Id', 'string'), member('Label', 'string')],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('DockTabs', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [member('Slot', 'enum', { allowedValues: ['left', 'inspector'] })],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['DockTab'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('DockTab', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [member('Id', 'string'), member('Label', 'string'), member('Active', 'boolean')],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('DocumentTabs', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['DocumentTab'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('DocumentTab', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [
      member('Id', 'string'),
      member('Label', 'string'),
      member('LabelBinding', 'string'),
      member('Active', 'boolean')
    ],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('ToolStrip', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['Tool'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Tool', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [
      member('Id', 'string'),
      member('Label', 'string'),
      member('Glyph', 'string'),
      member('Active', 'boolean')
    ],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('SourceTabs', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['SourceTab'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('SourceTab', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [member('Id', 'string'), member('Label', 'string'), member('Active', 'boolean')],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('StatusBar', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['StatusSegment'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('StatusSegment', {
    namespaceUri: DESIGNER_CHROME_NAMESPACE,
    members: [member('Id', 'string'), member('Label', 'string'), member('ValueBinding', 'string')],
    allowsText: false,
    allowsChildren: false
  })
] as const;

export const designerPanelsTypes = [
  typeDefinition('DesignerPanels', {
    namespaceUri: DESIGNER_PANELS_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['LeftRail', 'InspectorGroups'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('LeftRail', {
    namespaceUri: DESIGNER_PANELS_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['Panel'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Panel', {
    namespaceUri: DESIGNER_PANELS_NAMESPACE,
    members: [
      member('Id', 'string'),
      member('DockTab', 'string'),
      member('Title', 'string'),
      member('Caption', 'string')
    ],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('InspectorGroups', {
    namespaceUri: DESIGNER_PANELS_NAMESPACE,
    members: [],
    contentProperty: 'Children',
    collectionKind: 'list',
    allowedContentTypes: ['Group'],
    allowsText: false,
    allowsChildren: true
  }),
  typeDefinition('Group', {
    namespaceUri: DESIGNER_PANELS_NAMESPACE,
    members: [member('Id', 'string'), member('Title', 'string')],
    allowsText: false,
    allowsChildren: false
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
    },
    {
      prefix: 'theme',
      namespaceUri: DESIGNER_THEME_NAMESPACE,
      description: 'Designer theme configuration vocabulary.'
    },
    {
      prefix: 'chrome',
      namespaceUri: DESIGNER_CHROME_NAMESPACE,
      description: 'Designer chrome configuration vocabulary.'
    },
    {
      prefix: 'panels',
      namespaceUri: DESIGNER_PANELS_NAMESPACE,
      description: 'Designer panel configuration vocabulary.'
    }
  ],
  types: [...uiDesignerTypes, ...designerThemeTypes, ...designerChromeTypes, ...designerPanelsTypes],
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
  typeName: string | XamlQualifiedName | XamlTypeDefinition,
  memberName: string | XamlQualifiedName,
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry
): XamlMemberDefinition | null {
  const type =
    typeof typeName === 'object' && 'members' in typeName
      ? typeName
      : resolveXamlType(typeName, registry);
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

function scalarTextFromValues(values: readonly XamlValueNode[]): string {
  return values
    .map((value) => {
      if (value.kind === 'text') {
        return value.text;
      }

      if (value.kind === 'markupExtension') {
        return value.raw;
      }

      return '';
    })
    .join('');
}

function hasObjectValue(values: readonly XamlValueNode[]): boolean {
  return values.some((value) => value.kind === 'object');
}

function visitMarkupExtensionValue(
  value: XamlMarkupExtensionValue,
  visit: (node: XamlMarkupExtensionNode) => void
): void {
  if (typeof value === 'string') {
    return;
  }

  visit(value);

  for (const argument of value.arguments) {
    visitMarkupExtensionValue(argument.value, visit);
  }
}

function markupExtensionsFromValues(values: readonly XamlValueNode[]): XamlMarkupExtensionNode[] {
  const extensions: XamlMarkupExtensionNode[] = [];

  for (const value of values) {
    if (value.kind !== 'markupExtension') {
      continue;
    }

    visitMarkupExtensionValue(value, (extension) => {
      extensions.push(extension);
    });
  }

  return extensions;
}

function isRuntimeSupportedMarkupExtension(extension: XamlMarkupExtensionNode): boolean {
  return (
    (extension.type.localName === 'Binding' && extension.type.namespaceUri == null) ||
    (extension.type.localName === 'StaticResource' && extension.type.namespaceUri == null) ||
    (extension.type.localName === 'Null' && extension.type.namespaceUri === XAML_LANGUAGE_NAMESPACE)
  );
}

function warnUnsupportedMarkupExtensions(member: XamlMemberNode, diagnostics: XamlDiagnostic[]): void {
  for (const extension of markupExtensionsFromValues(member.values)) {
    if (isRuntimeSupportedMarkupExtension(extension)) {
      continue;
    }

    diagnostics.push(validationDiagnostic(
      'warning',
      'unsupported-markup-extension',
      `Markup extension "${formatQualifiedName(extension.type)}" is parsed structurally but not runtime-evaluated yet.`,
      extension.span ? extension : member
    ));
  }
}

interface XamlValidationContext {
  rootObject: XamlObjectNode;
  documentNamescope: Map<string, XamlMemberNode>;
  dictionaryKeyMembers: WeakSet<XamlMemberNode>;
}

function errorCount(diagnostics: readonly XamlDiagnostic[]): number {
  return diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
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
  warnUnsupportedMarkupExtensions(member, diagnostics);
}

function validateDirectiveSemantics(
  object: XamlObjectNode,
  member: XamlMemberNode,
  definition: XamlMemberDefinition,
  diagnostics: XamlDiagnostic[],
  context: XamlValidationContext
): void {
  const textValue = textFromValues(member.values).trim();

  if (definition.namespaceUri !== XAML_LANGUAGE_NAMESPACE && definition.namespaceUri !== XML_NAMESPACE) {
    return;
  }

  if (definition.name === 'Name') {
    if (!textValue) {
      return;
    }

    const existing = context.documentNamescope.get(textValue);
    if (existing && existing !== member) {
      diagnostics.push(validationDiagnostic(
        'error',
        'namescope-collision',
        `x:Name "${textValue}" is already defined within the current namescope.`,
        member
      ));
      return;
    }

    context.documentNamescope.set(textValue, member);
    return;
  }

  if (definition.name === 'Key') {
    if (!context.dictionaryKeyMembers.has(member)) {
      diagnostics.push(validationDiagnostic(
        'error',
        'invalid-directive-placement',
        'Directive "x:Key" is only valid on dictionary items.',
        member
      ));
    }
    return;
  }

  if (definition.name === 'Class' && object !== context.rootObject) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-directive-placement',
      'Directive "x:Class" is only valid on the document root object.',
      member
    ));
  }
}

function validateResolvedDirective(
  object: XamlObjectNode,
  member: XamlMemberNode,
  definition: XamlMemberDefinition,
  diagnostics: XamlDiagnostic[],
  context: XamlValidationContext
): void {
  const startingErrors = errorCount(diagnostics);
  const isValidatedDictionaryKey =
    definition.namespaceUri === XAML_LANGUAGE_NAMESPACE &&
    definition.name === 'Key' &&
    context.dictionaryKeyMembers.has(member);

  validateTextSyntax(member, definition, diagnostics);
  validateDirectiveSemantics(object, member, definition, diagnostics, context);

  if (isValidatedDictionaryKey) {
    warnUnsupportedMarkupExtensions(member, diagnostics);
    return;
  }

  if (errorCount(diagnostics) === startingErrors) {
    warnUnsupportedMember(member, definition, diagnostics);
  }

  warnUnsupportedMarkupExtensions(member, diagnostics);
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

function isXamlKeyDirective(member: XamlMemberNode): boolean {
  return (
    member.isDirective &&
    member.name.namespaceUri === XAML_LANGUAGE_NAMESPACE &&
    member.name.localName === 'Key'
  );
}

function findXamlKeyDirective(object: XamlObjectNode): XamlMemberNode | undefined {
  return object.members.find(isXamlKeyDirective);
}

function findResolvedPropertyMember(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  memberName: string,
  registry: XamlVocabularyRegistry
): XamlMemberNode | undefined {
  return object.members.find((memberNode) => {
    if (memberNode.syntax === 'content' || memberNode.isDirective) {
      return false;
    }

    return resolveXamlMember(type, memberNode.name, registry)?.name === memberName;
  });
}

function isAllowedCollectionItemType(
  collectionType: XamlTypeDefinition,
  item: XamlObjectNode,
  registry: XamlVocabularyRegistry
): boolean {
  if (!collectionType.allowedContentTypes || collectionType.allowedContentTypes.length === 0) {
    return true;
  }

  const itemType = resolveXamlType(item.type, registry);
  return !itemType || collectionType.allowedContentTypes.includes(itemType.name);
}

function validateAllowedCollectionItemType(
  collectionType: XamlTypeDefinition,
  item: XamlObjectNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry
): void {
  if (isAllowedCollectionItemType(collectionType, item, registry)) {
    return;
  }

  diagnostics.push(validationDiagnostic(
    'error',
    'invalid-collection-item-type',
    `Type "${collectionType.name}" does not allow "${formatQualifiedName(item.type)}" items.`,
    item
  ));
}

function validateDictionaryItemKeys(
  dictionaryType: XamlTypeDefinition,
  items: readonly XamlObjectNode[],
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
): void {
  const assignedKeys = new Map<string, XamlMemberNode | XamlObjectNode>();

  for (const item of items) {
    if (!isAllowedCollectionItemType(dictionaryType, item, registry)) {
      continue;
    }

    const itemType = resolveXamlType(item.type, registry);
    const explicitKey = findXamlKeyDirective(item);
    if (explicitKey) {
      context.dictionaryKeyMembers.add(explicitKey);
    }

    const implicitKey = itemType?.dictionaryKeyProperty
      ? findResolvedPropertyMember(item, itemType, itemType.dictionaryKeyProperty, registry)
      : undefined;
    const keyMember = explicitKey ?? implicitKey;
    const key = keyMember ? scalarTextFromValues(keyMember.values).trim() : '';

    if (!key) {
      diagnostics.push(validationDiagnostic(
        'error',
        'missing-dictionary-key',
        `Dictionary item "${formatQualifiedName(item.type)}" in "${dictionaryType.name}" must define x:Key or an implicit key property.`,
        keyMember ?? item
      ));
      continue;
    }

    const existing = assignedKeys.get(key);
    if (existing) {
      diagnostics.push(validationDiagnostic(
        'error',
        'duplicate-dictionary-key',
        `Dictionary "${dictionaryType.name}" already contains an item keyed "${key}".`,
        keyMember
      ));
      continue;
    }

    assignedKeys.set(key, keyMember ?? item);
  }
}

function validateContentMember(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  member: XamlMemberNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
): void {
  let hasInvalidContent = false;
  const objectValues = member.values.filter((value): value is XamlObjectNode => value.kind === 'object');

  if (type.collectionKind !== 'none') {
    for (const value of objectValues) {
      validateAllowedCollectionItemType(type, value, diagnostics, registry);
    }
  }

  if (type.collectionKind === 'dictionary') {
    validateDictionaryItemKeys(type, objectValues, diagnostics, registry, context);
  }

  for (const value of member.values) {
    if (value.kind === 'object') {
      if (!type.allowsChildren) {
        hasInvalidContent = true;
        diagnostics.push(validationDiagnostic(
          'error',
          'content-children-not-allowed',
          `Type "${type.name}" does not allow child objects.`,
          value
        ));
      }

      validateObjectNode(value, diagnostics, registry, context);
      continue;
    }

    if (value.kind === 'text' && value.text.trim() && !type.allowsText) {
      hasInvalidContent = true;
      diagnostics.push(validationDiagnostic(
        'error',
        'content-text-not-allowed',
        `Type "${type.name}" does not allow text content.`,
        value
      ));
    }
  }

  if (!hasInvalidContent && !type.contentProperty && member.values.length > 0) {
    diagnostics.push(validationDiagnostic(
      'warning',
      'implicit-content-without-schema-member',
      `Type "${type.name}" received content, but no content property is declared yet.`,
      object
    ));
  }

  warnUnsupportedMarkupExtensions(member, diagnostics);
}

function validateObjectNode(
  object: XamlObjectNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
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
      validateContentMember(object, type, memberNode, diagnostics, registry, context);
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
        definition = resolveXamlMember(type, memberNode.dotted.member, registry);
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
      definition = resolveXamlMember(type, memberNode.name, registry);
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

    if (definition.kind === 'directive') {
      validateResolvedDirective(object, memberNode, definition, diagnostics, context);
    } else {
      validateResolvedMember(memberNode, definition, diagnostics);
    }

    for (const value of memberNode.values) {
      if (value.kind === 'object') {
        validateObjectNode(value, diagnostics, registry, context);
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
    const context: XamlValidationContext = {
      rootObject: document.root,
      documentNamescope: new Map(),
      dictionaryKeyMembers: new WeakSet()
    };
    validateObjectNode(document.root, diagnostics, registry, context);
  }

  return {
    diagnostics,
    hasErrors: diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  };
}
