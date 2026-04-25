export type XamlPrimitive = string | number | boolean | null;

export type XamlRuntimeArrayValue = XamlRuntimeValue[];

export type XamlRuntimeValue = XamlPrimitive | XamlNode | XamlRuntimeArrayValue;

export type XamlAttributeValue = XamlPrimitive | XamlRuntimeArrayValue;

export interface XamlAttributeMap {
  [key: string]: XamlAttributeValue;
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
  xmlLang?: string;
  preservesXmlSpace?: boolean;
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
  namespaceDeclarations?: XamlNamespaceDeclaration[];
  span?: XamlSourceSpan;
}

export interface XamlTextNode {
  kind: 'text';
  text: string;
  isRawXml?: boolean;
  preservesXmlSpace?: boolean;
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
  | 'decimal'
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
  createsNamescope: boolean;
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

type XamlNamespaceScope = ReadonlyMap<string | null, string>;

export interface XamlValidationResult {
  diagnostics: XamlDiagnostic[];
  hasErrors: boolean;
}

const XAML_HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const XAML_DECIMAL_PATTERN = /^[+-]?(?:(?:\d+)(?:\.\d*)?|\.\d+)$/;

export function coerceXamlTextValue(value: string, syntax: XamlTextSyntaxKind): XamlPrimitive {
  const trimmed = value.trim();

  if (syntax === 'number' && trimmed) {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (syntax === 'decimal') {
    return trimmed || value;
  }

  if (syntax === 'boolean') {
    if (trimmed === 'true') {
      return true;
    }

    if (trimmed === 'false') {
      return false;
    }
  }

  return value;
}

export function isValidXamlTextValue(
  value: string,
  syntax: XamlTextSyntaxKind,
  allowedValues?: readonly string[]
): boolean {
  const trimmed = value.trim();

  if (!trimmed) {
    return true;
  }

  if (syntax === 'number') {
    return Number.isFinite(Number(trimmed));
  }

  if (syntax === 'decimal') {
    return XAML_DECIMAL_PATTERN.test(trimmed);
  }

  if (syntax === 'boolean') {
    return trimmed === 'true' || trimmed === 'false';
  }

  if (syntax === 'color') {
    return XAML_HEX_COLOR_PATTERN.test(trimmed);
  }

  if (syntax === 'enum' && allowedValues) {
    return allowedValues.includes(value);
  }

  return true;
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

const templateHostMembers = [
  member('Template', 'object', { isRuntimeSupported: false }),
  member('ContentTemplate', 'object', { isRuntimeSupported: false })
] as const;

const templateVisualTreeMembers = [
  member('VisualTree', 'object', { isContent: true, isRuntimeSupported: false })
] as const;

const templateVocabularyTypes = ['ControlTemplate', 'DataTemplate', 'ObjectIsland'] as const;

type TypeDefinitionOptions = Pick<XamlTypeDefinition, 'members' | 'contentProperty' | 'allowsText' | 'allowsChildren'> & {
  namespaceUri?: string | null;
  collectionKind?: XamlCollectionKind;
  allowedContentTypes?: readonly string[];
  dictionaryKeyProperty?: string;
  createsNamescope?: boolean;
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
    createsNamescope: options.createsNamescope ?? false,
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
  member('Subclass', 'string', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('ClassModifier', 'string', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('FieldModifier', 'string', {
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
  member('FactoryMethod', 'string', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('Arguments', 'object', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('ConstructorArgs', 'object', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('InitializationText', 'string', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    kind: 'directive',
    isRuntimeSupported: false
  }),
  member('Members', 'object', {
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

const xamlPrimitiveTypeSyntax = {
  String: 'string',
  Boolean: 'boolean',
  Byte: 'number',
  SByte: 'number',
  Int16: 'number',
  Int32: 'number',
  Int64: 'number',
  UInt16: 'number',
  UInt32: 'number',
  UInt64: 'number',
  Single: 'number',
  Double: 'number',
  Decimal: 'decimal'
} as const satisfies Record<string, XamlTextSyntaxKind>;

const xamlPrimitiveIntegerRanges = {
  Byte: { min: 0n, max: 255n },
  SByte: { min: -128n, max: 127n },
  Int16: { min: -32768n, max: 32767n },
  Int32: { min: -2147483648n, max: 2147483647n },
  Int64: { min: -9223372036854775808n, max: 9223372036854775807n },
  UInt16: { min: 0n, max: 65535n },
  UInt32: { min: 0n, max: 4294967295n },
  UInt64: { min: 0n, max: 18446744073709551615n }
} as const;

const XAML_SINGLE_MAX_VALUE = 3.4028234663852886e38;
const XAML_DECIMAL_MAX_SCALE = 28;
const XAML_DECIMAL_MAX_UNSCALED = 79228162514264337593543950335n;
const CLR_NAMESPACE_PREFIX = 'clr-namespace:';
const supportedClrPrimitiveNamespaces = new Set(['System']);
const supportedClrPrimitiveAssemblies = new Set(['mscorlib', 'System', 'System.Runtime', 'System.Private.CoreLib', 'netstandard']);
const supportedClrPrimitiveStaticMembers: Readonly<Record<string, readonly string[]>> = {
  Boolean: ['FalseString', 'TrueString'],
  Byte: ['MaxValue', 'MinValue'],
  SByte: ['MaxValue', 'MinValue'],
  Int16: ['MaxValue', 'MinValue'],
  Int32: ['MaxValue', 'MinValue'],
  Int64: ['MaxValue', 'MinValue'],
  UInt16: ['MaxValue', 'MinValue'],
  UInt32: ['MaxValue', 'MinValue'],
  UInt64: ['MaxValue', 'MinValue'],
  Single: ['Epsilon', 'MaxValue', 'MinValue', 'NaN', 'NegativeInfinity', 'PositiveInfinity'],
  Double: ['Epsilon', 'MaxValue', 'MinValue', 'NaN', 'NegativeInfinity', 'PositiveInfinity'],
  Decimal: ['MaxValue', 'MinValue', 'MinusOne', 'One', 'Zero'],
  String: ['Empty']
};

function xamlPrimitiveTypeDefinition(name: keyof typeof xamlPrimitiveTypeSyntax): XamlTypeDefinition {
  return typeDefinition(name, {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [member('Value', xamlPrimitiveTypeSyntax[name], { isContent: true })],
    contentProperty: 'Value',
    allowsText: true,
    allowsChildren: false
  });
}

export const xamlIntrinsicTypes = [
  typeDefinition('Null', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('NullExtension', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('Array', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [
      member('Type', 'string'),
      member('Items', 'object', { isContent: true, isCollection: true })
    ],
    contentProperty: 'Items',
    collectionKind: 'list',
    allowsText: true,
    allowsChildren: true
  }),
  typeDefinition('Code', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [
      member('Value', 'string', { isContent: true, isRuntimeSupported: false })
    ],
    contentProperty: 'Value',
    allowsText: true,
    allowsChildren: false,
    isRuntimeSupported: false
  }),
  typeDefinition('XData', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [
      member('Xml', 'string', { isContent: true, isRuntimeSupported: false })
    ],
    contentProperty: 'Xml',
    allowsText: true,
    allowsChildren: false,
    isRuntimeSupported: false
  }),
  typeDefinition('Member', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [
      member('Name', 'string', { isRuntimeSupported: false }),
      member('Type', 'string', { isRuntimeSupported: false })
    ],
    allowsText: false,
    allowsChildren: false,
    isRuntimeSupported: false
  }),
  typeDefinition('Property', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [
      member('Name', 'string', { isRuntimeSupported: false }),
      member('Type', 'string', { isRuntimeSupported: false })
    ],
    allowsText: false,
    allowsChildren: false,
    isRuntimeSupported: false
  }),
  xamlPrimitiveTypeDefinition('String'),
  xamlPrimitiveTypeDefinition('Boolean'),
  xamlPrimitiveTypeDefinition('Byte'),
  xamlPrimitiveTypeDefinition('SByte'),
  xamlPrimitiveTypeDefinition('Int16'),
  xamlPrimitiveTypeDefinition('Int32'),
  xamlPrimitiveTypeDefinition('Int64'),
  xamlPrimitiveTypeDefinition('UInt16'),
  xamlPrimitiveTypeDefinition('UInt32'),
  xamlPrimitiveTypeDefinition('UInt64'),
  xamlPrimitiveTypeDefinition('Single'),
  xamlPrimitiveTypeDefinition('Double'),
  xamlPrimitiveTypeDefinition('Decimal'),
  typeDefinition('Type', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [
      member('TypeName', 'string', { aliases: ['Type'] })
    ],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('TypeExtension', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [
      member('TypeName', 'string', { aliases: ['Type'] })
    ],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('Static', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [member('Member', 'string')],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('StaticExtension', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [member('Member', 'string')],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('Reference', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [member('Name', 'string')],
    allowsText: false,
    allowsChildren: false
  }),
  typeDefinition('ReferenceExtension', {
    namespaceUri: XAML_LANGUAGE_NAMESPACE,
    members: [member('Name', 'string')],
    allowsText: false,
    allowsChildren: false
  })
] as const;

export const uiDesignerTypes = [
  typeDefinition('ResourceDictionary', {
    members: [],
    contentProperty: 'Children',
    collectionKind: 'dictionary',
    allowedContentTypes: ['Color', 'Number', 'String', 'Array', ...runtimeControlContentTypes, ...templateVocabularyTypes],
    createsNamescope: true,
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
  typeDefinition('ControlTemplate', {
    members: [
      member('TargetType', 'string', { isRuntimeSupported: false }),
      ...templateVisualTreeMembers
    ],
    contentProperty: 'VisualTree',
    createsNamescope: true,
    allowsText: false,
    allowsChildren: true,
    isRuntimeSupported: false
  }),
  typeDefinition('DataTemplate', {
    members: [
      member('DataType', 'string', { isRuntimeSupported: false }),
      ...templateVisualTreeMembers
    ],
    contentProperty: 'VisualTree',
    createsNamescope: true,
    allowsText: false,
    allowsChildren: true,
    isRuntimeSupported: false
  }),
  typeDefinition('ObjectIsland', {
    members: [
      member('Content', 'object', { isContent: true, isRuntimeSupported: false })
    ],
    contentProperty: 'Content',
    createsNamescope: true,
    allowsText: false,
    allowsChildren: true,
    isRuntimeSupported: false
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
    members: [
      ...commonLayoutMembers,
      ...resourceMembers,
      ...visualMembers,
      ...textMembers,
      ...templateHostMembers,
      ...eventMembers
    ],
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
  types: [...xamlIntrinsicTypes, ...uiDesignerTypes, ...designerThemeTypes, ...designerChromeTypes, ...designerPanelsTypes],
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

function isXamlTypeExtension(extension: XamlMarkupExtensionNode): boolean {
  return (
    (extension.type.localName === 'Type' || extension.type.localName === 'TypeExtension') &&
    extension.type.namespaceUri === XAML_LANGUAGE_NAMESPACE
  );
}

function isXamlStaticExtension(extension: XamlMarkupExtensionNode): boolean {
  return (
    (extension.type.localName === 'Static' || extension.type.localName === 'StaticExtension') &&
    extension.type.namespaceUri === XAML_LANGUAGE_NAMESPACE
  );
}

function isXamlReferenceExtension(extension: XamlMarkupExtensionNode): boolean {
  return (
    (extension.type.localName === 'Reference' || extension.type.localName === 'ReferenceExtension') &&
    extension.type.namespaceUri === XAML_LANGUAGE_NAMESPACE
  );
}

function isXamlObjectElement(object: XamlObjectNode, names: readonly string[]): boolean {
  return object.type.namespaceUri === XAML_LANGUAGE_NAMESPACE && names.includes(object.type.localName);
}

function isXamlScalarIntrinsicObject(object: XamlObjectNode): boolean {
  return isXamlObjectElement(object, ['Null', 'NullExtension', 'Type', 'TypeExtension', 'Static', 'StaticExtension']);
}

function isAllowedObjectValueForMember(value: XamlObjectNode, definition: XamlMemberDefinition): boolean {
  if (definition.valueSyntax === 'object' || definition.valueSyntax === 'any') {
    return true;
  }

  return isXamlScalarIntrinsicObject(value);
}

function xamlTypeNameFromExtension(extension: XamlMarkupExtensionNode): string {
  const namedType = extension.arguments.find((argument) => {
    return (
      argument.kind === 'named' &&
      ['type', 'typename'].includes(argument.name.toLowerCase()) &&
      typeof argument.value === 'string'
    );
  });
  if (namedType?.kind === 'named' && typeof namedType.value === 'string') {
    return namedType.value.trim();
  }

  const positionalType = extension.arguments.find((argument) => {
    return argument.kind === 'positional' && typeof argument.value === 'string';
  });
  return positionalType?.kind === 'positional' && typeof positionalType.value === 'string'
    ? positionalType.value.trim()
    : '';
}

function xamlTypeNameFromObjectElement(object: XamlObjectNode): string {
  if (!isXamlObjectElement(object, ['Type', 'TypeExtension'])) {
    return '';
  }

  const typeMember = object.members.find((member) => {
    if (member.isDirective || member.syntax === 'content') {
      return false;
    }

    return member.name.localName === 'TypeName' || member.name.localName === 'Type' || member.dotted?.member === 'TypeName';
  });
  return typeMember ? scalarTextFromValues(typeMember.values).trim() : '';
}

function xamlTypeNameFromValues(values: readonly XamlValueNode[]): string {
  if (values.length === 1 && values[0].kind === 'markupExtension' && isXamlTypeExtension(values[0])) {
    return xamlTypeNameFromExtension(values[0]);
  }

  if (values.length === 1 && values[0].kind === 'object') {
    const typeName = xamlTypeNameFromObjectElement(values[0]);
    if (typeName) {
      return typeName;
    }
  }

  return scalarTextFromValues(values).trim();
}

function valuesContainStructuredXamlTypeReference(values: readonly XamlValueNode[]): boolean {
  return values.some((value) => {
    return (
      (value.kind === 'markupExtension' && isXamlTypeExtension(value)) ||
      (value.kind === 'object' && isXamlObjectElement(value, ['Type', 'TypeExtension']))
    );
  });
}

interface XamlTypeNameParts {
  rawName: string;
  prefix: string | null;
  localName: string;
  clrNamespace: string | null;
}

interface ClrNamespaceMapping {
  clrNamespace: string;
  assembly: string | null;
}

interface XamlTypeNameResolution {
  localName: string;
  namespaceUri: string | null;
  isPrimitive: boolean;
}

interface StaticMemberReference {
  ownerTypeName: string;
  memberName: string;
}

function parseXamlTypeNameText(value: string): XamlTypeNameParts | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('{')) {
    return null;
  }

  const separator = trimmed.indexOf(':');
  const prefix = separator >= 0 ? trimmed.slice(0, separator) : null;
  const unprefixed = separator >= 0 ? trimmed.slice(separator + 1) : trimmed;
  const dot = unprefixed.lastIndexOf('.');
  const localName = dot >= 0 ? unprefixed.slice(dot + 1) : unprefixed;
  if (!localName) {
    return null;
  }

  return {
    rawName: trimmed,
    prefix,
    localName,
    clrNamespace: dot >= 0 ? unprefixed.slice(0, dot) : null
  };
}

function localTypeNameFromTextSyntax(value: string): string | null {
  return parseXamlTypeNameText(value)?.localName ?? null;
}

function typeNameHasExplicitQualifier(value: string): boolean {
  const typeName = parseXamlTypeNameText(value);
  return Boolean(typeName?.prefix || typeName?.clrNamespace);
}

function parseClrNamespaceUri(namespaceUri: string | null): ClrNamespaceMapping | null {
  if (!namespaceUri?.startsWith(CLR_NAMESPACE_PREFIX)) {
    return null;
  }

  const [namespacePart, ...optionParts] = namespaceUri.split(';');
  const clrNamespace = namespacePart.slice(CLR_NAMESPACE_PREFIX.length).trim();
  if (!clrNamespace) {
    return null;
  }

  const assemblyOption = optionParts.find((part) => part.trim().toLowerCase().startsWith('assembly='));
  const assembly = assemblyOption ? assemblyOption.slice(assemblyOption.indexOf('=') + 1).trim() : null;
  return {
    clrNamespace,
    assembly: assembly || null
  };
}

function isSupportedClrPrimitiveNamespace(mapping: ClrNamespaceMapping): boolean {
  return (
    supportedClrPrimitiveNamespaces.has(mapping.clrNamespace) &&
    (mapping.assembly == null || supportedClrPrimitiveAssemblies.has(mapping.assembly))
  );
}

function resolveClrPrimitiveTypeName(parts: XamlTypeNameParts, mapping: ClrNamespaceMapping): XamlTypeNameResolution | null {
  if (!isSupportedClrPrimitiveNamespace(mapping) || !(parts.localName in xamlPrimitiveTypeSyntax)) {
    return null;
  }

  return {
    localName: parts.localName,
    namespaceUri: null,
    isPrimitive: true
  };
}

function resolveRegistryTypeName(
  localName: string,
  namespaceUri: string | null,
  registry: XamlVocabularyRegistry
): XamlTypeNameResolution | null {
  const type = registry.types.find((candidate) => {
    return candidate.name === localName && namespacesMatch(namespaceUri, candidate.namespaceUri);
  });

  return type
    ? {
        localName: type.name,
        namespaceUri: type.namespaceUri,
        isPrimitive: type.namespaceUri === XAML_LANGUAGE_NAMESPACE && type.name in xamlPrimitiveTypeSyntax
      }
    : null;
}

function resolveXamlTypeNameReference(
  typeName: string,
  registry: XamlVocabularyRegistry,
  context?: XamlValidationContext
): XamlTypeNameResolution | null {
  const parts = parseXamlTypeNameText(typeName);
  if (!parts) {
    return null;
  }

  if (parts.prefix) {
    if (!context?.namespaceScope.has(parts.prefix)) {
      return null;
    }

    const namespaceUri = context.namespaceScope.get(parts.prefix) ?? null;
    const clrMapping = parseClrNamespaceUri(namespaceUri);
    if (clrMapping) {
      return resolveClrPrimitiveTypeName(parts, clrMapping);
    }

    return resolveRegistryTypeName(parts.localName, namespaceUri, registry);
  }

  if (parts.clrNamespace) {
    return resolveClrPrimitiveTypeName(parts, {
      clrNamespace: parts.clrNamespace,
      assembly: null
    });
  }

  if (parts.localName !== 'String' && parts.localName in xamlPrimitiveTypeSyntax) {
    return {
      localName: parts.localName,
      namespaceUri: null,
      isPrimitive: true
    };
  }

  return resolveRegistryTypeName(parts.localName, null, registry);
}

function primitiveTextSyntaxFromTypeName(
  typeName: string,
  registry: XamlVocabularyRegistry,
  context?: XamlValidationContext
): XamlTextSyntaxKind | null {
  const resolution = resolveXamlTypeNameReference(typeName, registry, context);
  if (!resolution?.isPrimitive || !(resolution.localName in xamlPrimitiveTypeSyntax)) {
    return null;
  }

  if (resolution.localName === 'String' && !typeNameHasExplicitQualifier(typeName)) {
    return null;
  }

  return xamlPrimitiveTypeSyntax[resolution.localName as keyof typeof xamlPrimitiveTypeSyntax];
}

function isPrimitiveXamlTypeName(
  typeName: string,
  registry: XamlVocabularyRegistry,
  context?: XamlValidationContext
): boolean {
  return primitiveTextSyntaxFromTypeName(typeName, registry, context) != null;
}

function resolveTypeDefinitionFromTypeNameReference(
  typeName: string,
  registry: XamlVocabularyRegistry,
  context?: XamlValidationContext
): XamlTypeDefinition | null {
  const resolution = resolveXamlTypeNameReference(typeName, registry, context);
  if (!resolution) {
    return null;
  }

  const namespaceUri = resolution.isPrimitive ? XAML_LANGUAGE_NAMESPACE : resolution.namespaceUri;
  return registry.types.find((type) => {
    return type.name === resolution.localName && namespacesMatch(namespaceUri, type.namespaceUri);
  }) ?? null;
}

function isPrimitiveXamlObject(object: XamlObjectNode): boolean {
  return object.type.namespaceUri === XAML_LANGUAGE_NAMESPACE && object.type.localName in xamlPrimitiveTypeSyntax;
}

function primitiveObjectTextValue(object: XamlObjectNode, registry: XamlVocabularyRegistry): string {
  const type = resolveXamlType(object.type, registry);
  const contentProperty = type?.contentProperty;
  if (!type || !contentProperty) {
    return textFromValues(object.members.find((member) => member.syntax === 'content')?.values ?? []).trim();
  }

  return scalarTextFromValues(valuesForResolvedMember(object, type, contentProperty, registry)).trim();
}

function parseIntegerText(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return null;
  }

  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

function parseDecimalText(value: string): { unscaled: bigint; scale: number } | null {
  const trimmed = value.trim();
  if (!XAML_DECIMAL_PATTERN.test(trimmed)) {
    return null;
  }

  const unsigned = trimmed.startsWith('-') || trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  const [wholePart = '', fractionalPart = ''] = unsigned.split('.');
  const digits = `${wholePart}${fractionalPart}`.replace(/^0+(?=\d)/, '') || '0';
  let unscaled = BigInt(digits);
  let scale = fractionalPart.length;

  while (scale > 0 && unscaled % 10n === 0n) {
    unscaled /= 10n;
    scale -= 1;
  }

  return {
    unscaled,
    scale
  };
}

function isValidDecimalRangeValue(value: string): boolean {
  const decimal = parseDecimalText(value);
  return (
    decimal != null &&
    decimal.scale <= XAML_DECIMAL_MAX_SCALE &&
    decimal.unscaled <= XAML_DECIMAL_MAX_UNSCALED
  );
}

function isValidPrimitiveRangeValue(typeName: string, value: string): boolean {
  const localName = localTypeNameFromTextSyntax(typeName);
  if (!localName) {
    return true;
  }

  if (localName in xamlPrimitiveIntegerRanges) {
    const integer = parseIntegerText(value);
    if (integer == null) {
      return false;
    }

    const range = xamlPrimitiveIntegerRanges[localName as keyof typeof xamlPrimitiveIntegerRanges];
    return integer >= range.min && integer <= range.max;
  }

  if (localName === 'Single') {
    const number = Number(value.trim());
    return Number.isFinite(number) && Math.abs(number) <= XAML_SINGLE_MAX_VALUE;
  }

  if (localName === 'Decimal') {
    return isValidDecimalRangeValue(value);
  }

  return true;
}

function registryHasTypeName(
  typeName: string,
  registry: XamlVocabularyRegistry,
  context?: XamlValidationContext
): boolean {
  if (isPrimitiveXamlTypeName(typeName, registry, context)) {
    return true;
  }

  return resolveXamlTypeNameReference(typeName, registry, context) != null;
}

function splitTopLevelTypeArgumentList(value: string): string[] | null {
  const items: string[] = [];
  let depth = 0;
  let segmentStart = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === '(') {
      depth += 1;
      continue;
    }

    if (character === ')') {
      if (depth === 0) {
        return null;
      }

      depth -= 1;
      continue;
    }

    if (character === ',' && depth === 0) {
      const segment = value.slice(segmentStart, index).trim();
      if (!segment) {
        return null;
      }

      items.push(segment);
      segmentStart = index + 1;
    }
  }

  if (depth !== 0) {
    return null;
  }

  const finalSegment = value.slice(segmentStart).trim();
  if (!finalSegment) {
    return null;
  }

  items.push(finalSegment);
  return items;
}

function firstTopLevelTypeArgumentOpen(value: string): number {
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '(') {
      if (depth === 0) {
        return index;
      }

      depth += 1;
      continue;
    }

    if (character === ')' && depth > 0) {
      depth -= 1;
    }
  }

  return -1;
}

function pushInvalidTypeArgumentsDiagnostic(
  diagnostics: XamlDiagnostic[],
  node: { span?: XamlSourceSpan }
): void {
  diagnostics.push(validationDiagnostic(
    'error',
    'invalid-type-arguments',
    'Directive "x:TypeArguments" expects a comma-separated list of type names.',
    node
  ));
}

function validateTypeArgumentExpression(
  value: string,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext,
  node: { span?: XamlSourceSpan }
): boolean {
  const openIndex = firstTopLevelTypeArgumentOpen(value);
  const typeName = openIndex >= 0 ? value.slice(0, openIndex).trim() : value.trim();
  if (!typeName || !registryHasTypeName(typeName, registry, context)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'unknown-xaml-type',
      `Directive "x:TypeArguments" references unknown type "${typeName || value}".`,
      node
    ));
    return false;
  }

  if (openIndex < 0) {
    return true;
  }

  if (!value.endsWith(')')) {
    pushInvalidTypeArgumentsDiagnostic(diagnostics, node);
    return false;
  }

  return validateTypeArgumentList(value.slice(openIndex + 1, -1), diagnostics, registry, context, node);
}

function validateTypeArgumentList(
  value: string,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext,
  node: { span?: XamlSourceSpan }
): boolean {
  const items = splitTopLevelTypeArgumentList(value.trim());
  if (!items) {
    pushInvalidTypeArgumentsDiagnostic(diagnostics, node);
    return false;
  }

  return items.every((item) => validateTypeArgumentExpression(item, diagnostics, registry, context, node));
}

function validateXamlTypeArgumentsDirective(
  member: XamlMemberNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
): void {
  const textValue = textFromValues(member.values).trim();
  if (!textValue) {
    pushInvalidTypeArgumentsDiagnostic(diagnostics, member);
    return;
  }

  validateTypeArgumentList(textValue, diagnostics, registry, context, member);
}

function xamlStaticMemberFromExtension(extension: XamlMarkupExtensionNode): string {
  const namedMember = extension.arguments.find((argument) => {
    return argument.kind === 'named' && argument.name.toLowerCase() === 'member' && typeof argument.value === 'string';
  });
  if (namedMember?.kind === 'named' && typeof namedMember.value === 'string') {
    return namedMember.value.trim();
  }

  const positionalMember = extension.arguments.find((argument) => {
    return argument.kind === 'positional' && typeof argument.value === 'string';
  });
  return positionalMember?.kind === 'positional' && typeof positionalMember.value === 'string'
    ? positionalMember.value.trim()
    : '';
}

function parseStaticMemberReference(memberName: string): StaticMemberReference | null {
  const separator = memberName.lastIndexOf('.');
  if (separator <= 0 || separator === memberName.length - 1) {
    return null;
  }

  return {
    ownerTypeName: memberName.slice(0, separator),
    memberName: memberName.slice(separator + 1)
  };
}

function isSupportedPrimitiveStaticMember(typeName: string, memberName: string): boolean {
  return supportedClrPrimitiveStaticMembers[typeName]?.includes(memberName) === true;
}

function validateXamlStaticMemberReference(
  memberName: string,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext,
  node: { span?: XamlSourceSpan },
  intrinsicName: string
): void {
  const reference = parseStaticMemberReference(memberName);
  if (!reference) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-static-member-reference',
      `${intrinsicName} requires a type-qualified member reference, such as "Type.Member".`,
      node
    ));
    return;
  }

  const ownerType = resolveTypeDefinitionFromTypeNameReference(reference.ownerTypeName, registry, context);
  if (!ownerType) {
    diagnostics.push(validationDiagnostic(
      'error',
      'unknown-xaml-type',
      `${intrinsicName} references unknown owner type "${reference.ownerTypeName}".`,
      node
    ));
    return;
  }

  if (ownerType.namespaceUri === XAML_LANGUAGE_NAMESPACE && ownerType.name in xamlPrimitiveTypeSyntax) {
    if (isSupportedPrimitiveStaticMember(ownerType.name, reference.memberName)) {
      return;
    }
  } else if (
    resolveXamlMember(ownerType, reference.memberName, registry) ||
    resolveXamlAttachedMember(ownerType.name, reference.memberName, registry)
  ) {
    return;
  }

  diagnostics.push(validationDiagnostic(
    'error',
    'unknown-static-member',
    `${intrinsicName} references unknown member "${reference.memberName}" on type "${reference.ownerTypeName}".`,
    node
  ));
}

function xamlReferenceNameFromExtension(extension: XamlMarkupExtensionNode): string {
  const namedReference = extension.arguments.find((argument) => {
    return argument.kind === 'named' && argument.name.toLowerCase() === 'name' && typeof argument.value === 'string';
  });
  if (namedReference?.kind === 'named' && typeof namedReference.value === 'string') {
    return namedReference.value.trim();
  }

  const positionalReference = extension.arguments.find((argument) => {
    return argument.kind === 'positional' && typeof argument.value === 'string';
  });
  return positionalReference?.kind === 'positional' && typeof positionalReference.value === 'string'
    ? positionalReference.value.trim()
    : '';
}

function isRuntimeSupportedMarkupExtension(extension: XamlMarkupExtensionNode): boolean {
  return (
    (extension.type.localName === 'Binding' && extension.type.namespaceUri == null) ||
    (extension.type.localName === 'StaticResource' && extension.type.namespaceUri == null) ||
    (extension.type.localName === 'DynamicResource' && extension.type.namespaceUri == null) ||
    (extension.type.localName === 'Null' && extension.type.namespaceUri === XAML_LANGUAGE_NAMESPACE) ||
    isXamlTypeExtension(extension) ||
    isXamlStaticExtension(extension) ||
    isXamlReferenceExtension(extension)
  );
}

function validateXamlTypeExtension(
  extension: XamlMarkupExtensionNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext,
  fallbackNode: XamlMemberNode
): void {
  const typeName = xamlTypeNameFromExtension(extension);
  if (!typeName) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-markup-extension-argument',
      'Markup extension "x:Type" requires a type name.',
      extension.span ? extension : fallbackNode
    ));
    return;
  }

  if (!registryHasTypeName(typeName, registry, context)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'unknown-xaml-type',
      `Markup extension "x:Type" references unknown type "${typeName}".`,
      extension.span ? extension : fallbackNode
    ));
  }
}

function validateXamlStaticExtension(
  extension: XamlMarkupExtensionNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext,
  fallbackNode: XamlMemberNode
): void {
  const memberName = xamlStaticMemberFromExtension(extension);
  if (!memberName) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-markup-extension-argument',
      'Markup extension "x:Static" requires a member name.',
      extension.span ? extension : fallbackNode
    ));
    return;
  }

  validateXamlStaticMemberReference(
    memberName,
    diagnostics,
    registry,
    context,
    extension.span ? extension : fallbackNode,
    'Markup extension "x:Static"'
  );
}

function validateXamlReferenceExtension(
  extension: XamlMarkupExtensionNode,
  diagnostics: XamlDiagnostic[],
  context: XamlValidationContext,
  fallbackNode: XamlMemberNode
): void {
  const referenceName = xamlReferenceNameFromExtension(extension);
  if (!referenceName) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-markup-extension-argument',
      'Markup extension "x:Reference" requires a Name value.',
      extension.span ? extension : fallbackNode
    ));
    return;
  }

  if (!context.knownNames.has(referenceName)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'unknown-reference-name',
      `Markup extension "x:Reference" references unknown x:Name "${referenceName}".`,
      extension.span ? extension : fallbackNode
    ));
  }
}

function validateMarkupExtensions(
  member: XamlMemberNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
): void {
  for (const extension of markupExtensionsFromValues(member.values)) {
    if (isXamlTypeExtension(extension)) {
      validateXamlTypeExtension(extension, diagnostics, registry, context, member);
      continue;
    }

    if (isXamlStaticExtension(extension)) {
      validateXamlStaticExtension(extension, diagnostics, registry, context, member);
      continue;
    }

    if (isXamlReferenceExtension(extension)) {
      validateXamlReferenceExtension(extension, diagnostics, context, member);
      continue;
    }

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
  knownNames: Set<string>;
  namescope: Map<string, XamlMemberNode>;
  dictionaryKeyMembers: WeakSet<XamlMemberNode>;
  namespaceScope: XamlNamespaceScope;
}

function errorCount(diagnostics: readonly XamlDiagnostic[]): number {
  return diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
}

function validateTextSyntax(member: XamlMemberNode, definition: XamlMemberDefinition, diagnostics: XamlDiagnostic[]): void {
  if (definition.valueSyntax === 'any') {
    return;
  }

  const text = textFromValues(member.values).trim();
  const invalidObjectValue = member.values.find((value): value is XamlObjectNode => {
    return value.kind === 'object' && !isAllowedObjectValueForMember(value, definition);
  });

  if (invalidObjectValue) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-member-object-value',
      `Member "${definition.name}" does not accept object values.`,
      invalidObjectValue
    ));
  }

  if (!text) {
    return;
  }

  if (definition.valueSyntax === 'number' && !isValidXamlTextValue(text, definition.valueSyntax)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-number-value',
      `Member "${definition.name}" expects a numeric value.`,
      member
    ));
  }

  if (definition.valueSyntax === 'decimal' && !isValidXamlTextValue(text, definition.valueSyntax)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-decimal-value',
      `Member "${definition.name}" expects decimal text.`,
      member
    ));
  }

  if (definition.valueSyntax === 'boolean' && !isValidXamlTextValue(text, definition.valueSyntax)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-boolean-value',
      `Member "${definition.name}" expects "true" or "false".`,
      member
    ));
  }

  if (definition.valueSyntax === 'color' && !isValidXamlTextValue(text, definition.valueSyntax)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-color-value',
      `Member "${definition.name}" expects a hex color value such as "#67c7ff".`,
      member
    ));
  }

  if (
    definition.valueSyntax === 'enum' &&
    definition.allowedValues &&
    !isValidXamlTextValue(text, definition.valueSyntax, definition.allowedValues)
  ) {
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

function warnUnsupportedType(object: XamlObjectNode, type: XamlTypeDefinition, diagnostics: XamlDiagnostic[]): void {
  if (type.isRuntimeSupported) {
    return;
  }

  diagnostics.push(validationDiagnostic(
    'warning',
    'unrenderable-type',
    `Type "${formatQualifiedName(object.type)}" is schema-valid but not runtime-supported yet.`,
    object
  ));
}

function validateResolvedMember(
  member: XamlMemberNode,
  definition: XamlMemberDefinition,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
): void {
  validateTextSyntax(member, definition, diagnostics);
  warnUnsupportedMember(member, definition, diagnostics);
  validateMarkupExtensions(member, diagnostics, registry, context);
}

function validateDirectiveSemantics(
  object: XamlObjectNode,
  member: XamlMemberNode,
  definition: XamlMemberDefinition,
  diagnostics: XamlDiagnostic[],
  context: XamlValidationContext,
  registry: XamlVocabularyRegistry
): void {
  const textValue = textFromValues(member.values).trim();

  if (definition.namespaceUri !== XAML_LANGUAGE_NAMESPACE && definition.namespaceUri !== XML_NAMESPACE) {
    return;
  }

  if (definition.name === 'Name') {
    if (!textValue) {
      return;
    }

    const existing = context.namescope.get(textValue);
    if (existing && existing !== member) {
      diagnostics.push(validationDiagnostic(
        'error',
        'namescope-collision',
        `x:Name "${textValue}" is already defined within the current namescope.`,
        member
      ));
      return;
    }

    context.namescope.set(textValue, member);
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

  if (definition.name === 'TypeArguments') {
    validateXamlTypeArgumentsDirective(member, diagnostics, registry, context);
    return;
  }

  if (definition.name === 'ClassModifier' || definition.name === 'FieldModifier') {
    validateXamlMarkupCompileDirective(object, member, definition, diagnostics, context);
    return;
  }

  if (definition.name === 'Subclass' || definition.name === 'Members') {
    validateXamlDeclarationDirective(object, member, definition, diagnostics, context);
    return;
  }

  if (
    definition.name === 'FactoryMethod' ||
    definition.name === 'Arguments' ||
    definition.name === 'ConstructorArgs'
  ) {
    validateXamlConstructionDirective(object, member, definition, diagnostics);
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
  context: XamlValidationContext,
  registry: XamlVocabularyRegistry
): void {
  const startingErrors = errorCount(diagnostics);
  const isValidatedDictionaryKey =
    definition.namespaceUri === XAML_LANGUAGE_NAMESPACE &&
    definition.name === 'Key' &&
    context.dictionaryKeyMembers.has(member);

  validateTextSyntax(member, definition, diagnostics);
  validateDirectiveSemantics(object, member, definition, diagnostics, context, registry);

  if (isValidatedDictionaryKey) {
    validateMarkupExtensions(member, diagnostics, registry, context);
    return;
  }

  if (errorCount(diagnostics) === startingErrors) {
    warnUnsupportedMember(member, definition, diagnostics);
  }

  validateMarkupExtensions(member, diagnostics, registry, context);
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

function isXamlNameDirective(member: XamlMemberNode): boolean {
  return isXamlDirectiveNamed(member, 'Name');
}

function isXamlDirectiveNamed(member: XamlMemberNode, name: string): boolean {
  return (
    member.isDirective &&
    member.name.namespaceUri === XAML_LANGUAGE_NAMESPACE &&
    member.name.localName === name
  );
}

function hasXamlDirective(object: XamlObjectNode, name: string): boolean {
  return object.members.some((member) => isXamlDirectiveNamed(member, name));
}

const constructionArgumentDirectiveNames = new Set(['Arguments', 'ConstructorArgs']);

function isConstructionArgumentsDirective(member: XamlMemberNode): boolean {
  return (
    member.isDirective &&
    member.name.namespaceUri === XAML_LANGUAGE_NAMESPACE &&
    constructionArgumentDirectiveNames.has(member.name.localName)
  );
}

function validateRequiredDirectiveText(
  member: XamlMemberNode,
  directiveName: string,
  diagnostics: XamlDiagnostic[]
): void {
  if (textFromValues(member.values).trim()) {
    return;
  }

  diagnostics.push(validationDiagnostic(
    'error',
    'missing-directive-value',
    `Directive "x:${directiveName}" requires a value.`,
    member
  ));
}

function validateXamlMarkupCompileDirective(
  object: XamlObjectNode,
  member: XamlMemberNode,
  definition: XamlMemberDefinition,
  diagnostics: XamlDiagnostic[],
  context: XamlValidationContext
): void {
  validateRequiredDirectiveText(member, definition.name, diagnostics);

  if (definition.name === 'ClassModifier') {
    if (object !== context.rootObject) {
      diagnostics.push(validationDiagnostic(
        'error',
        'invalid-directive-placement',
        'Directive "x:ClassModifier" is only valid on the document root object.',
        member
      ));
      return;
    }

    if (!hasXamlDirective(object, 'Class')) {
      diagnostics.push(validationDiagnostic(
        'error',
        'missing-required-directive',
        'Directive "x:ClassModifier" requires x:Class on the same root object.',
        member
      ));
    }
    return;
  }

  if (!hasXamlDirective(context.rootObject, 'Class')) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-required-directive',
      'Directive "x:FieldModifier" requires x:Class on the document root object.',
      member
    ));
  }

  if (!hasXamlDirective(object, 'Name')) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-required-directive',
      'Directive "x:FieldModifier" requires x:Name on the same object.',
      member
    ));
  }
}

function isXamlMembersDirective(member: XamlMemberNode): boolean {
  return isXamlDirectiveNamed(member, 'Members');
}

function isXamlDeclarationMemberObject(object: XamlObjectNode): boolean {
  return isXamlObjectElement(object, ['Member', 'Property']);
}

function validateXamlDeclarationDirective(
  object: XamlObjectNode,
  member: XamlMemberNode,
  definition: XamlMemberDefinition,
  diagnostics: XamlDiagnostic[],
  context: XamlValidationContext
): void {
  if (definition.name === 'Subclass') {
    validateRequiredDirectiveText(member, definition.name, diagnostics);

    if (object !== context.rootObject) {
      diagnostics.push(validationDiagnostic(
        'error',
        'invalid-directive-placement',
        'Directive "x:Subclass" is only valid on the document root object.',
        member
      ));
      return;
    }

    if (!hasXamlDirective(object, 'Class')) {
      diagnostics.push(validationDiagnostic(
        'error',
        'missing-required-directive',
        'Directive "x:Subclass" requires x:Class on the same root object.',
        member
      ));
    }
    return;
  }

  if (definition.name !== 'Members') {
    return;
  }

  if (member.syntax !== 'propertyElement') {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-directive-placement',
      'Directive "x:Members" is only valid as a property element.',
      member
    ));
    return;
  }

  if (object !== context.rootObject) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-directive-placement',
      'Directive "x:Members" is only valid on the document root object.',
      member
    ));
    return;
  }

  if (!hasXamlDirective(object, 'Class')) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-required-directive',
      'Directive "x:Members" requires x:Class on the document root object.',
      member
    ));
  }

  const declarationValues = member.values.filter((value): value is XamlObjectNode => value.kind === 'object');
  if (declarationValues.length === 0) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-member-declarations',
      'Directive "x:Members" requires one or more x:Member or x:Property declarations.',
      member
    ));
  }

  const textValue = member.values.find((value): value is XamlTextNode => {
    return value.kind === 'text' && Boolean(value.text.trim());
  });
  if (textValue) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-member-declaration-value',
      'Directive "x:Members" expects x:Member or x:Property object values.',
      textValue
    ));
  }

  for (const declaration of declarationValues) {
    if (!isXamlDeclarationMemberObject(declaration)) {
      diagnostics.push(validationDiagnostic(
        'error',
        'invalid-member-declaration-value',
        'Directive "x:Members" only allows x:Member or x:Property object values.',
        declaration
      ));
    }
  }
}

function validateXamlConstructionDirective(
  object: XamlObjectNode,
  member: XamlMemberNode,
  definition: XamlMemberDefinition,
  diagnostics: XamlDiagnostic[]
): void {
  if (definition.name === 'FactoryMethod') {
    if (!textFromValues(member.values).trim()) {
      diagnostics.push(validationDiagnostic(
        'error',
        'missing-construction-directive-value',
        'Directive "x:FactoryMethod" requires a factory method name.',
        member
      ));
    }
    return;
  }

  if (definition.name !== 'Arguments' && definition.name !== 'ConstructorArgs') {
    return;
  }

  if (member.syntax !== 'propertyElement') {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-directive-placement',
      `Directive "x:${definition.name}" is only valid as a property element.`,
      member
    ));
    return;
  }

  const argumentDirectives = object.members.filter(isConstructionArgumentsDirective);
  if (argumentDirectives.length > 1 && argumentDirectives[0] !== member) {
    diagnostics.push(validationDiagnostic(
      'error',
      'duplicate-construction-arguments',
      'An object can define only one construction argument directive.',
      member
    ));
    return;
  }

  const hasArgumentValue = member.values.some((value) => value.kind !== 'text' || value.text.trim());
  if (!hasArgumentValue) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-construction-arguments',
      `Directive "x:${definition.name}" requires one or more argument values.`,
      member
    ));
    return;
  }

  const textArgument = member.values.find((value): value is XamlTextNode => {
    return value.kind === 'text' && Boolean(value.text.trim());
  });
  if (textArgument) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-construction-argument-value',
      `Directive "x:${definition.name}" expects object or markup-extension argument values.`,
      textArgument
    ));
  }
}

function createsNamescopeBoundary(
  object: XamlObjectNode,
  registry: XamlVocabularyRegistry
): boolean {
  return resolveXamlType(object.type, registry)?.createsNamescope === true;
}

function collectKnownNamesForScope(
  object: XamlObjectNode,
  names: Set<string>,
  registry: XamlVocabularyRegistry
): void {
  const nameMember = object.members.find(isXamlNameDirective);
  const name = nameMember ? textFromValues(nameMember.values).trim() : '';
  if (name) {
    names.add(name);
  }

  for (const member of object.members) {
    for (const value of member.values) {
      if (value.kind === 'object') {
        if (!createsNamescopeBoundary(value, registry)) {
          collectKnownNamesForScope(value, names, registry);
        }
      }
    }
  }
}

function namespaceScopeWithObjectDeclarations(
  parentScope: XamlNamespaceScope,
  object: XamlObjectNode
): XamlNamespaceScope {
  if (object.namespaceDeclarations.length === 0) {
    return parentScope;
  }

  const namespaceScope = new Map(parentScope);
  for (const declaration of object.namespaceDeclarations) {
    namespaceScope.set(declaration.prefix, declaration.namespaceUri);
  }

  return namespaceScope;
}

function namespaceScopeWithMemberDeclarations(
  parentScope: XamlNamespaceScope,
  member: XamlMemberNode
): XamlNamespaceScope {
  if (!member.namespaceDeclarations || member.namespaceDeclarations.length === 0) {
    return parentScope;
  }

  const namespaceScope = new Map(parentScope);
  for (const declaration of member.namespaceDeclarations) {
    namespaceScope.set(declaration.prefix, declaration.namespaceUri);
  }

  return namespaceScope;
}

function withObjectNamespaceScope(context: XamlValidationContext, object: XamlObjectNode): XamlValidationContext {
  const namespaceScope = namespaceScopeWithObjectDeclarations(context.namespaceScope, object);
  return namespaceScope === context.namespaceScope
    ? context
    : {
        ...context,
        namespaceScope
      };
}

function withMemberNamespaceScope(context: XamlValidationContext, member: XamlMemberNode): XamlValidationContext {
  const namespaceScope = namespaceScopeWithMemberDeclarations(context.namespaceScope, member);
  return namespaceScope === context.namespaceScope
    ? context
    : {
        ...context,
        namespaceScope
      };
}

function createNamescopeContext(
  object: XamlObjectNode,
  registry: XamlVocabularyRegistry,
  parentContext: XamlValidationContext | null
): XamlValidationContext {
  const knownNames = new Set<string>();
  collectKnownNamesForScope(object, knownNames, registry);

  return {
    rootObject: parentContext?.rootObject ?? object,
    knownNames,
    namescope: new Map(),
    dictionaryKeyMembers: parentContext?.dictionaryKeyMembers ?? new WeakSet(),
    namespaceScope: parentContext?.namespaceScope ?? namespaceScopeWithObjectDeclarations(new Map(), object)
  };
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

    if (memberNode.dotted) {
      return (
        memberNode.dotted.owner.localName === type.name &&
        resolveXamlMember(type, memberNode.dotted.member, registry)?.name === memberName
      );
    }

    return resolveXamlMember(type, memberNode.name, registry)?.name === memberName;
  });
}

function valuesForResolvedMember(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  memberName: string,
  registry: XamlVocabularyRegistry
): XamlValueNode[] {
  return object.members.flatMap((memberNode) => {
    if (memberNode.syntax === 'attribute' || memberNode.isDirective) {
      return [];
    }

    const isContentMember = memberNode.syntax === 'content' && type.contentProperty === memberName;
    const isNamedMember = memberNode.dotted
      ? memberNode.dotted.owner.localName === type.name &&
        resolveXamlMember(type, memberNode.dotted.member, registry)?.name === memberName
      : resolveXamlMember(type, memberNode.name, registry)?.name === memberName;

    if (!isContentMember && !isNamedMember) {
      return [];
    }

    return memberNode.values;
  });
}

function objectValuesForResolvedMember(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  memberName: string,
  registry: XamlVocabularyRegistry
): XamlObjectNode[] {
  return valuesForResolvedMember(object, type, memberName, registry)
    .filter((value): value is XamlObjectNode => value.kind === 'object');
}

function validateXamlArraySemantics(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
): void {
  if (type.namespaceUri !== XAML_LANGUAGE_NAMESPACE || type.name !== 'Array') {
    return;
  }

  const typeMember = findResolvedPropertyMember(object, type, 'Type', registry);
  const typeText = typeMember ? xamlTypeNameFromValues(typeMember.values) : '';

  if (!typeText) {
    if (typeMember) {
      return;
    }

    diagnostics.push(validationDiagnostic(
      'error',
      'missing-required-member',
      'Intrinsic "x:Array" requires a Type member.',
      object
    ));
    return;
  }

  const itemTypeName = localTypeNameFromTextSyntax(typeText);
  if (!itemTypeName) {
    return;
  }

  if (!registryHasTypeName(typeText, registry, context)) {
    if (!valuesContainStructuredXamlTypeReference(typeMember?.values ?? [])) {
      diagnostics.push(validationDiagnostic(
        'error',
        'unknown-xaml-type',
        `Intrinsic "x:Array" references unknown item type "${typeText}".`,
        typeMember ?? object
      ));
    }
    return;
  }

  const primitiveSyntax = primitiveTextSyntaxFromTypeName(typeText, registry, context);
  const itemValues = valuesForResolvedMember(object, type, 'Items', registry);

  if (primitiveSyntax) {
    for (const value of itemValues) {
      if (value.kind === 'text') {
        const text = value.text.trim();
        if (text) {
          if (!isValidXamlTextValue(text, primitiveSyntax)) {
            diagnostics.push(validationDiagnostic(
              'error',
              'invalid-array-item-value',
              `x:Array Type="${typeText}" contains a primitive item that is not valid ${primitiveSyntax} text.`,
              value
            ));
          } else if (!isValidPrimitiveRangeValue(typeText, text)) {
            diagnostics.push(validationDiagnostic(
              'error',
              'invalid-array-item-range',
              `x:Array Type="${typeText}" contains a primitive item outside the supported range.`,
              value
            ));
          }
        }
        continue;
      }

      if (value.kind !== 'object') {
        continue;
      }

      if (isXamlObjectElement(value, ['Null', 'NullExtension'])) {
        continue;
      }

      if (!isPrimitiveXamlObject(value) || value.type.localName !== itemTypeName) {
        diagnostics.push(validationDiagnostic(
          'error',
          'invalid-array-item-type',
          `x:Array Type="${typeText}" does not allow "${formatQualifiedName(value.type)}" items.`,
          value
        ));
      }
    }
    return;
  }

  for (const value of itemValues) {
    if (value.kind === 'text') {
      if (value.text.trim()) {
        diagnostics.push(validationDiagnostic(
          'error',
          'invalid-array-item-type',
          `x:Array Type="${typeText}" does not allow primitive text items.`,
          value
        ));
      }
      continue;
    }

    if (value.kind !== 'object') {
      continue;
    }

    const item = value;
    const resolvedItemType = resolveXamlType(item.type, registry);
    if (!resolvedItemType || resolvedItemType.name === itemTypeName) {
      continue;
    }

    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-array-item-type',
      `x:Array Type="${typeText}" does not allow "${formatQualifiedName(item.type)}" items.`,
      item
    ));
  }
}

function textFromRequiredMember(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  memberName: string,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry
): string {
  const memberNode = findResolvedPropertyMember(object, type, memberName, registry);
  const text = memberNode ? scalarTextFromValues(memberNode.values).trim() : '';
  if (text) {
    return text;
  }

  diagnostics.push(validationDiagnostic(
    'error',
    'missing-required-member',
    `Intrinsic "x:${type.name}" requires a ${memberName} member.`,
    memberNode ?? object
  ));
  return '';
}

function validateXamlPrimitiveObjectSemantics(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry
): void {
  if (!isPrimitiveXamlObject(object)) {
    return;
  }

  const syntax = xamlPrimitiveTypeSyntax[type.name as keyof typeof xamlPrimitiveTypeSyntax];
  const text = primitiveObjectTextValue(object, registry);
  if (!text || !isValidXamlTextValue(text, syntax)) {
    return;
  }

  if (!isValidPrimitiveRangeValue(type.name, text)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-primitive-range',
      `Intrinsic "x:${type.name}" value is outside the supported range.`,
      object
    ));
  }
}

function validateXamlIntrinsicObjectSemantics(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
): void {
  if (type.namespaceUri !== XAML_LANGUAGE_NAMESPACE) {
    return;
  }

  validateXamlPrimitiveObjectSemantics(object, type, diagnostics, registry);

  if (type.name === 'Type' || type.name === 'TypeExtension') {
    const typeName = textFromRequiredMember(object, type, 'TypeName', diagnostics, registry);
    if (typeName && !registryHasTypeName(typeName, registry, context)) {
      diagnostics.push(validationDiagnostic(
        'error',
        'unknown-xaml-type',
        `Intrinsic "x:${type.name}" references unknown type "${typeName}".`,
        object
      ));
    }
    return;
  }

  if (type.name === 'Static' || type.name === 'StaticExtension') {
    const memberName = textFromRequiredMember(object, type, 'Member', diagnostics, registry);
    if (memberName) {
      validateXamlStaticMemberReference(
        memberName,
        diagnostics,
        registry,
        context,
        object,
        `Intrinsic "x:${type.name}"`
      );
    }
    return;
  }

  if (type.name === 'Reference' || type.name === 'ReferenceExtension') {
    const referenceName = textFromRequiredMember(object, type, 'Name', diagnostics, registry);
    if (referenceName && !context.knownNames.has(referenceName)) {
      diagnostics.push(validationDiagnostic(
        'error',
        'unknown-reference-name',
        `Intrinsic "x:${type.name}" references unknown x:Name "${referenceName}".`,
        object
      ));
    }
  }
}

function isAllowedCollectionItemType(
  collectionType: XamlTypeDefinition,
  item: XamlObjectNode,
  registry: XamlVocabularyRegistry
): boolean {
  if (isXamlObjectElement(item, ['Code'])) {
    return true;
  }

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

function objectContentText(object: XamlObjectNode, registry: XamlVocabularyRegistry): string {
  const type = resolveXamlType(object.type, registry);
  if (!type?.contentProperty) {
    return '';
  }

  return textFromValues(valuesForResolvedMember(object, type, type.contentProperty, registry));
}

function objectMemberText(
  object: XamlObjectNode,
  type: XamlTypeDefinition,
  memberName: string,
  registry: XamlVocabularyRegistry
): string {
  const memberNode = findResolvedPropertyMember(object, type, memberName, registry);
  return memberNode ? scalarTextFromValues(memberNode.values).trim() : '';
}

function validateDeclarationMemberObject(
  parentMember: XamlMemberNode,
  object: XamlObjectNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
): void {
  if (!isXamlDeclarationMemberObject(object)) {
    return;
  }

  if (!isXamlMembersDirective(parentMember)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-directive-placement',
      `Intrinsic "x:${object.type.localName}" is only valid inside x:Members.`,
      object
    ));
    return;
  }

  const type = resolveXamlType(object.type, registry);
  if (!type) {
    return;
  }

  if (!objectMemberText(object, type, 'Name', registry)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-required-member',
      `Intrinsic "x:${type.name}" requires a Name member.`,
      object
    ));
  }

  const declarationType = objectMemberText(object, type, 'Type', registry);
  if (!declarationType) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-required-member',
      `Intrinsic "x:${type.name}" requires a Type member.`,
      object
    ));
    return;
  }

  const declarationContext = withObjectNamespaceScope(context, object);
  if (!registryHasTypeName(declarationType, registry, declarationContext)) {
    diagnostics.push(validationDiagnostic(
      'error',
      'unknown-xaml-type',
      `Intrinsic "x:${type.name}" references unknown declaration type "${declarationType}".`,
      object
    ));
  }
}

function validateCodeAdjacentIntrinsicObjectPlacement(
  parent: XamlObjectNode,
  member: XamlMemberNode,
  object: XamlObjectNode,
  diagnostics: XamlDiagnostic[],
  registry: XamlVocabularyRegistry,
  context: XamlValidationContext
): void {
  if (isXamlObjectElement(object, ['Code'])) {
    if (parent !== context.rootObject || member.syntax !== 'content') {
      diagnostics.push(validationDiagnostic(
        'error',
        'invalid-directive-placement',
        'Intrinsic "x:Code" is only valid as direct content of the document root object.',
        object
      ));
      return;
    }

    if (!hasXamlDirective(context.rootObject, 'Class')) {
      diagnostics.push(validationDiagnostic(
        'error',
        'missing-required-directive',
        'Intrinsic "x:Code" requires x:Class on the document root object.',
        object
      ));
    }

    if (!objectContentText(object, registry).trim()) {
      diagnostics.push(validationDiagnostic(
        'error',
        'missing-code-content',
        'Intrinsic "x:Code" requires code text.',
        object
      ));
    }
    return;
  }

  if (!isXamlObjectElement(object, ['XData'])) {
    return;
  }

  if (member.syntax === 'content') {
    diagnostics.push(validationDiagnostic(
      'error',
      'invalid-directive-placement',
      'Intrinsic "x:XData" must be supplied as a member value, not direct object content.',
      object
    ));
    return;
  }

  if (!objectContentText(object, registry).trim()) {
    diagnostics.push(validationDiagnostic(
      'error',
      'missing-xdata-content',
      'Intrinsic "x:XData" requires XML content.',
      object
    ));
  }
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
    const explicitKey = findXamlKeyDirective(item);
    if (explicitKey) {
      context.dictionaryKeyMembers.add(explicitKey);
    }

    if (!isAllowedCollectionItemType(dictionaryType, item, registry)) {
      continue;
    }

    const itemType = resolveXamlType(item.type, registry);
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
  const memberContext = withMemberNamespaceScope(context, member);
  let hasInvalidContent = false;
  const objectValues = member.values.filter((value): value is XamlObjectNode => value.kind === 'object');

  if (type.collectionKind !== 'none') {
    for (const value of objectValues) {
      validateAllowedCollectionItemType(type, value, diagnostics, registry);
    }
  }

  if (type.collectionKind === 'dictionary') {
    validateDictionaryItemKeys(type, objectValues, diagnostics, registry, memberContext);
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

      validateDeclarationMemberObject(member, value, diagnostics, registry, memberContext);
      validateCodeAdjacentIntrinsicObjectPlacement(object, member, value, diagnostics, registry, memberContext);
      validateObjectNode(value, diagnostics, registry, memberContext);
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

  const contentDefinition = type.contentProperty
    ? resolveXamlMember(type, type.contentProperty, registry)
    : null;
  if (contentDefinition) {
    validateTextSyntax(member, contentDefinition, diagnostics);
  }

  validateMarkupExtensions(member, diagnostics, registry, memberContext);
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

  warnUnsupportedType(object, type, diagnostics);

  const namespaceContext = withObjectNamespaceScope(context, object);
  const localContext = object !== context.rootObject && type.createsNamescope
    ? createNamescopeContext(object, registry, namespaceContext)
    : namespaceContext;
  const assignedMembers = new Set<string>();

  for (const memberNode of object.members) {
    if (memberNode.syntax === 'content') {
      validateContentMember(object, type, memberNode, diagnostics, registry, localContext);
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

    const memberContext = withMemberNamespaceScope(localContext, memberNode);
    if (definition.kind === 'directive') {
      validateResolvedDirective(object, memberNode, definition, diagnostics, memberContext, registry);
    } else {
      validateResolvedMember(memberNode, definition, diagnostics, registry, memberContext);
    }

    for (const value of memberNode.values) {
      if (value.kind === 'object') {
        validateDeclarationMemberObject(memberNode, value, diagnostics, registry, memberContext);
        validateCodeAdjacentIntrinsicObjectPlacement(object, memberNode, value, diagnostics, registry, memberContext);
        validateObjectNode(value, diagnostics, registry, memberContext);
      }
    }
  }

  validateXamlArraySemantics(object, type, diagnostics, registry, localContext);
  validateXamlIntrinsicObjectSemantics(object, type, diagnostics, registry, localContext);
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
    const context = createNamescopeContext(document.root, registry, null);
    validateObjectNode(document.root, diagnostics, registry, context);
  }

  return {
    diagnostics,
    hasErrors: diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  };
}
