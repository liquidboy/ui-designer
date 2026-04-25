import {
  XAML_LANGUAGE_NAMESPACE,
  XML_NAMESPACE,
  XMLNS_NAMESPACE,
  resolveXamlAttachedMember,
  resolveXamlDirective,
  resolveXamlMember,
  resolveXamlType,
  uiDesignerVocabularyRegistry,
  validateXamlDocument,
  type XamlAttributeMap,
  type XamlDiagnostic,
  type XamlDocument,
  type XamlDocumentNode,
  type XamlDottedMember,
  type XamlMarkupExtensionNode,
  type XamlMarkupExtensionValue,
  type XamlMemberNode,
  type XamlNamespaceDeclaration,
  type XamlNode,
  type XamlObjectNode,
  type XamlParseOptions,
  type XamlParseResult,
  type XamlPrimitive,
  type XamlQualifiedName,
  type XamlSourcePosition,
  type XamlSourceSpan,
  type XamlTextNode,
  type XamlTypeDefinition,
  type XamlValidationResult,
  type XamlVocabularyRegistry,
  type XamlValueNode
} from '@ui-designer/xaml-schema';

export type {
  XamlParseDiagnostic,
  XamlParseOptions,
  XamlParseResult,
  XamlValidationResult,
  XamlVocabularyRegistry
} from '@ui-designer/xaml-schema';

export interface XamlParseAndValidateResult extends XamlParseResult {
  validation: XamlValidationResult;
}

export interface XamlLoweredParseResult extends XamlParseAndValidateResult {
  legacyDocument: XamlDocument | null;
  hasErrors: boolean;
}

export interface XamlLoweringOptions {
  evaluateMarkupExtensions?: boolean;
  dataContext?: unknown;
}

const CONTENT_MEMBER_NAME = 'Content';

interface SourceLocator {
  span(startOffset: number, endOffset: number): XamlSourceSpan;
  findElementStart(rawName: string, fromOffset: number): number;
  findTagEnd(startOffset: number): number;
  findAttributeSpan(tagStart: number, tagEnd: number, rawName: string): XamlSourceSpan | undefined;
  findTextSpan(text: string, fromOffset: number): XamlSourceSpan | undefined;
}

interface ParseContext {
  readonly input: string;
  readonly options: XamlParseOptions;
  readonly locator: SourceLocator;
  readonly diagnostics: XamlDiagnostic[];
  readonly namespaceDeclarations: XamlNamespaceDeclaration[];
  readonly namespaceKeys: Set<string>;
  searchOffset: number;
}

interface MarkupExtensionParseSuccess {
  node: XamlMarkupExtensionNode;
  nextIndex: number;
}

interface MarkupExtensionParseFailure {
  diagnostic: XamlDiagnostic;
}

type MarkupExtensionParseResult = MarkupExtensionParseSuccess | MarkupExtensionParseFailure;

function parseAttributeValue(value: string): XamlPrimitive {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && trimmed.length > 0) {
    return asNumber;
  }

  return value;
}

function splitQualifiedName(rawName: string): { prefix: string | null; localName: string } {
  const separator = rawName.indexOf(':');
  if (separator < 0) {
    return {
      prefix: null,
      localName: rawName
    };
  }

  return {
    prefix: rawName.slice(0, separator),
    localName: rawName.slice(separator + 1)
  };
}

function createQualifiedNameFromRawName(
  rawName: string,
  resolveNamespaceUri: (prefix: string | null) => string | null
): XamlQualifiedName {
  const { prefix, localName } = splitQualifiedName(rawName);
  return {
    rawName,
    prefix,
    localName,
    namespaceUri: resolveNamespaceUri(prefix)
  };
}

function markupExtensionDiagnostic(message: string, span?: XamlSourceSpan): XamlDiagnostic {
  return {
    severity: 'error',
    code: 'invalid-markup-extension-syntax',
    message,
    span
  };
}

function skipMarkupWhitespace(input: string, index: number): number {
  let cursor = index;
  while (cursor < input.length && /\s/.test(input[cursor])) {
    cursor += 1;
  }

  return cursor;
}

function decodeMarkupExtensionEscapes(input: string): string {
  let value = '';

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '\\' && index + 1 < input.length) {
      value += input[index + 1];
      index += 1;
      continue;
    }

    value += character;
  }

  return value;
}

function parseQuotedMarkupExtensionValue(input: string, span?: XamlSourceSpan): string | XamlDiagnostic {
  const quote = input[0];
  let value = '';

  for (let index = 1; index < input.length; index += 1) {
    const character = input[index];
    if (character === '\\') {
      if (index + 1 >= input.length) {
        return markupExtensionDiagnostic('Quoted markup extension value ends with an incomplete escape sequence.', span);
      }

      value += input[index + 1];
      index += 1;
      continue;
    }

    if (character === quote) {
      if (input.slice(index + 1).trim().length > 0) {
        return markupExtensionDiagnostic('Quoted markup extension value has trailing text after the closing quote.', span);
      }

      return value;
    }

    value += character;
  }

  return markupExtensionDiagnostic('Quoted markup extension value is missing a closing quote.', span);
}

function findMarkupArgumentSeparator(input: string, startIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = startIndex; index < input.length; index += 1) {
    const character = input[index];

    if (quote) {
      if (character === '\\') {
        index += 1;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '\\') {
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === '{') {
      depth += 1;
      continue;
    }

    if (character === '}') {
      if (depth === 0) {
        return index;
      }

      depth -= 1;
      continue;
    }

    if (character === ',' && depth === 0) {
      return index;
    }
  }

  return input.length;
}

function findMarkupAssignment(input: string): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quote) {
      if (character === '\\') {
        index += 1;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '\\') {
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === '{') {
      depth += 1;
      continue;
    }

    if (character === '}') {
      if (depth > 0) {
        depth -= 1;
      }
      continue;
    }

    if (character === '=' && depth === 0) {
      return index;
    }
  }

  return -1;
}

function parseMarkupExtensionValue(
  value: string,
  resolveNamespaceUri: (prefix: string | null) => string | null,
  span?: XamlSourceSpan
): XamlMarkupExtensionValue | XamlDiagnostic {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return '';
  }

  if (trimmed.startsWith('{}')) {
    return trimmed.slice(2);
  }

  if (trimmed.startsWith('{')) {
    const parsed = parseMarkupExtension(trimmed, resolveNamespaceUri);
    if ('diagnostic' in parsed) {
      return parsed.diagnostic;
    }

    if (parsed.nextIndex !== trimmed.length) {
      return markupExtensionDiagnostic('Nested markup extension contains trailing text after the closing brace.', span);
    }

    return parsed.node;
  }

  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    return parseQuotedMarkupExtensionValue(trimmed, span);
  }

  return decodeMarkupExtensionEscapes(trimmed);
}

function parseMarkupExtension(
  input: string,
  resolveNamespaceUri: (prefix: string | null) => string | null,
  startIndex = 0,
  nodeSpan?: XamlSourceSpan
): MarkupExtensionParseResult {
  if (input[startIndex] !== '{') {
    return {
      diagnostic: markupExtensionDiagnostic('Markup extension must start with "{".', nodeSpan)
    };
  }

  let cursor = skipMarkupWhitespace(input, startIndex + 1);
  const typeStart = cursor;

  while (cursor < input.length && !/\s/.test(input[cursor]) && input[cursor] !== '}') {
    cursor += 1;
  }

  const rawTypeName = input.slice(typeStart, cursor);
  if (!rawTypeName) {
    return {
      diagnostic: markupExtensionDiagnostic('Markup extension is missing a type name.', nodeSpan)
    };
  }

  const type = createQualifiedNameFromRawName(rawTypeName, resolveNamespaceUri);
  const argumentsList: XamlMarkupExtensionNode['arguments'] = [];
  cursor = skipMarkupWhitespace(input, cursor);
  let sawNamedArgument = false;

  while (cursor < input.length && input[cursor] !== '}') {
    const segmentEnd = findMarkupArgumentSeparator(input, cursor);
    const segment = input.slice(cursor, segmentEnd).trim();

    if (!segment) {
      return {
        diagnostic: markupExtensionDiagnostic('Markup extension contains an empty argument segment.', nodeSpan)
      };
    }

    const assignmentIndex = findMarkupAssignment(segment);
    if (assignmentIndex >= 0) {
      const name = segment.slice(0, assignmentIndex).trim();
      if (!name) {
        return {
          diagnostic: markupExtensionDiagnostic('Markup extension named argument is missing its name.', nodeSpan)
        };
      }

      const value = parseMarkupExtensionValue(segment.slice(assignmentIndex + 1), resolveNamespaceUri, nodeSpan);
      if (typeof value !== 'string' && 'severity' in value) {
        return { diagnostic: value };
      }

      argumentsList.push({
        kind: 'named',
        name,
        value
      });
      sawNamedArgument = true;
    } else {
      if (sawNamedArgument) {
        return {
          diagnostic: markupExtensionDiagnostic(
            'Markup extension positional arguments must appear before named arguments.',
            nodeSpan
          )
        };
      }

      const value = parseMarkupExtensionValue(segment, resolveNamespaceUri, nodeSpan);
      if (typeof value !== 'string' && 'severity' in value) {
        return { diagnostic: value };
      }

      argumentsList.push({
        kind: 'positional',
        value
      });
    }

    cursor = segmentEnd;
    if (input[cursor] === ',') {
      cursor = skipMarkupWhitespace(input, cursor + 1);
    }
  }

  if (cursor >= input.length || input[cursor] !== '}') {
    return {
      diagnostic: markupExtensionDiagnostic('Markup extension is missing a closing "}".', nodeSpan)
    };
  }

  return {
    node: {
      kind: 'markupExtension',
      type,
      arguments: argumentsList,
      raw: input.slice(startIndex, cursor + 1),
      span: nodeSpan
    },
    nextIndex: cursor + 1
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createSourceLocator(input: string): SourceLocator {
  const lineStarts = [0];

  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === '\n') {
      lineStarts.push(index + 1);
    }
  }

  const positionAt = (offset: number): XamlSourcePosition => {
    const boundedOffset = Math.max(0, Math.min(input.length, offset));
    let low = 0;
    let high = lineStarts.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= boundedOffset) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const lineIndex = Math.max(0, high);
    return {
      offset: boundedOffset,
      line: lineIndex + 1,
      column: boundedOffset - lineStarts[lineIndex] + 1
    };
  };

  const span = (startOffset: number, endOffset: number): XamlSourceSpan => ({
    start: positionAt(startOffset),
    end: positionAt(endOffset)
  });

  const findElementStart = (rawName: string, fromOffset: number): number => {
    const pattern = new RegExp(`<\\s*${escapeRegExp(rawName)}(?=[\\s>/])`, 'g');
    pattern.lastIndex = Math.max(0, fromOffset);
    const match = pattern.exec(input);
    return match ? match.index : -1;
  };

  const findTagEnd = (startOffset: number): number => {
    let quote: '"' | "'" | null = null;

    for (let index = startOffset; index < input.length; index += 1) {
      const character = input[index];
      if (quote) {
        if (character === quote) {
          quote = null;
        }
        continue;
      }

      if (character === '"' || character === "'") {
        quote = character;
        continue;
      }

      if (character === '>') {
        return index + 1;
      }
    }

    return -1;
  };

  const findAttributeSpan = (tagStart: number, tagEnd: number, rawName: string): XamlSourceSpan | undefined => {
    if (tagStart < 0 || tagEnd <= tagStart) {
      return undefined;
    }

    const tagSource = input.slice(tagStart, tagEnd);
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(rawName)}\\s*=\\s*(?:"[^"]*"|'[^']*')`);
    const match = pattern.exec(tagSource);
    if (!match) {
      return undefined;
    }

    const leadingWhitespace = match[0].match(/^\s*/)?.[0].length ?? 0;
    const start = tagStart + match.index + leadingWhitespace;
    return span(start, start + match[0].length - leadingWhitespace);
  };

  const findTextSpan = (text: string, fromOffset: number): XamlSourceSpan | undefined => {
    if (!text) {
      return undefined;
    }

    const start = input.indexOf(text, Math.max(0, fromOffset));
    return start >= 0 ? span(start, start + text.length) : undefined;
  };

  return {
    span,
    findElementStart,
    findTagEnd,
    findAttributeSpan,
    findTextSpan
  };
}

function isNamespaceDeclaration(attr: Attr): boolean {
  return attr.name === 'xmlns' || attr.name.startsWith('xmlns:') || attr.namespaceURI === XMLNS_NAMESPACE;
}

function namespacePrefixFromAttribute(attr: Attr): string | null {
  if (attr.name === 'xmlns') {
    return null;
  }

  if (attr.name.startsWith('xmlns:')) {
    return attr.name.slice('xmlns:'.length);
  }

  return attr.prefix === 'xmlns' ? attr.localName : null;
}

function createQualifiedName(node: Element | Attr, fallbackRawName: string): XamlQualifiedName {
  const rawName = 'name' in node ? node.name : fallbackRawName;
  const { localName } = splitQualifiedName(rawName);
  return {
    rawName,
    prefix: node.prefix || null,
    localName: node.localName || localName,
    namespaceUri: node.namespaceURI || null
  };
}

function createSyntheticQualifiedName(localName: string): XamlQualifiedName {
  return {
    rawName: localName,
    prefix: null,
    localName,
    namespaceUri: null
  };
}

function createDottedMember(name: XamlQualifiedName): XamlDottedMember | undefined {
  const dotIndex = name.localName.indexOf('.');
  if (dotIndex <= 0 || dotIndex === name.localName.length - 1) {
    return undefined;
  }

  const ownerName = name.localName.slice(0, dotIndex);
  const member = name.localName.slice(dotIndex + 1);
  return {
    owner: {
      rawName: name.prefix ? `${name.prefix}:${ownerName}` : ownerName,
      prefix: name.prefix,
      localName: ownerName,
      namespaceUri: name.namespaceUri
    },
    member
  };
}

function isDirectiveName(name: XamlQualifiedName): boolean {
  return (
    name.namespaceUri === XAML_LANGUAGE_NAMESPACE ||
    name.namespaceUri === XML_NAMESPACE ||
    name.prefix === 'x' ||
    name.prefix === 'xml'
  );
}

function registerNamespaceDeclaration(context: ParseContext, declaration: XamlNamespaceDeclaration): void {
  const key = `${declaration.prefix ?? ''}\u0000${declaration.namespaceUri}`;
  if (context.namespaceKeys.has(key)) {
    return;
  }

  context.namespaceKeys.add(key);
  context.namespaceDeclarations.push(declaration);
}

function collectNamespaceDeclarations(
  element: Element,
  context: ParseContext,
  tagStart: number,
  tagEnd: number
): XamlNamespaceDeclaration[] {
  const declarations: XamlNamespaceDeclaration[] = [];

  for (const attr of Array.from(element.attributes)) {
    if (!isNamespaceDeclaration(attr)) {
      continue;
    }

    const declaration: XamlNamespaceDeclaration = {
      prefix: namespacePrefixFromAttribute(attr),
      namespaceUri: attr.value,
      span: context.locator.findAttributeSpan(tagStart, tagEnd, attr.name)
    };

    declarations.push(declaration);
    registerNamespaceDeclaration(context, declaration);
  }

  return declarations;
}

function createTextNode(domNode: ChildNode, context: ParseContext): XamlTextNode | null {
  const text = domNode.nodeValue ?? '';
  if (!context.options.preserveWhitespace && text.trim().length === 0) {
    return null;
  }

  const span = context.locator.findTextSpan(text, context.searchOffset);
  if (span) {
    context.searchOffset = span.end.offset;
  }

  return {
    kind: 'text',
    text,
    span
  };
}

function createAttributeValueNode(
  value: string,
  ownerElement: Element,
  span: XamlSourceSpan | undefined,
  diagnostics: XamlDiagnostic[]
): XamlValueNode {
  if (value.startsWith('{}')) {
    return {
      kind: 'text',
      text: value.slice(2),
      span
    };
  }

  if (!value.startsWith('{')) {
    return {
      kind: 'text',
      text: value,
      span
    };
  }

  const parsed = parseMarkupExtension(
    value,
    (prefix) => ownerElement.lookupNamespaceURI(prefix),
    0,
    span
  );

  if ('diagnostic' in parsed) {
    diagnostics.push(parsed.diagnostic);
    return {
      kind: 'text',
      text: value,
      span
    };
  }

  if (parsed.nextIndex !== value.length) {
    diagnostics.push(markupExtensionDiagnostic('Markup extension contains trailing text after the closing brace.', span));
    return {
      kind: 'text',
      text: value,
      span
    };
  }

  return parsed.node;
}

function createAttributeMember(
  attr: Attr,
  ownerElement: Element,
  context: ParseContext,
  tagStart: number,
  tagEnd: number
): XamlMemberNode | null {
  if (isNamespaceDeclaration(attr)) {
    return null;
  }

  const name = createQualifiedName(attr, attr.name);
  const dotted = createDottedMember(name);
  const span = context.locator.findAttributeSpan(tagStart, tagEnd, attr.name);
  const valueNode = createAttributeValueNode(attr.value, ownerElement, span, context.diagnostics);

  return {
    kind: 'member',
    name,
    syntax: 'attribute',
    values: [valueNode],
    isDirective: isDirectiveName(name),
    isAttached: Boolean(dotted),
    dotted,
    span
  };
}

function isPropertyElement(element: Element): boolean {
  return element.localName.includes('.');
}

function flushContentValues(members: XamlMemberNode[], values: XamlValueNode[]): void {
  if (values.length === 0) {
    return;
  }

  const name = createSyntheticQualifiedName(CONTENT_MEMBER_NAME);
  members.push({
    kind: 'member',
    name,
    syntax: 'content',
    values: [...values],
    isDirective: false,
    isAttached: false
  });
  values.length = 0;
}

function readValueNodes(element: Element, context: ParseContext): XamlValueNode[] {
  const values: XamlValueNode[] = [];

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
      const textNode = createTextNode(child, context);
      if (textNode) {
        values.push(textNode);
      }
      continue;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      values.push(elementToObject(child as Element, context));
    }
  }

  return values;
}

function propertyElementToMember(element: Element, context: ParseContext): XamlMemberNode {
  const rawName = element.tagName;
  const tagStart = context.locator.findElementStart(rawName, context.searchOffset);
  const tagEnd = tagStart >= 0 ? context.locator.findTagEnd(tagStart) : -1;
  if (tagEnd >= 0) {
    context.searchOffset = tagEnd;
  }

  const name = createQualifiedName(element, rawName);
  const dotted = createDottedMember(name);
  const namespaceDeclarations = collectNamespaceDeclarations(element, context, tagStart, tagEnd);
  const span = tagStart >= 0 && tagEnd >= 0 ? context.locator.span(tagStart, tagEnd) : undefined;
  const values = readValueNodes(element, context);

  if (namespaceDeclarations.length > 0) {
    context.diagnostics.push({
      severity: 'warning',
      code: 'namespace-on-property-element',
      message: `Namespace declarations on property element "${rawName}" are preserved globally but not attached to the member node yet.`,
      span
    });
  }

  return {
    kind: 'member',
    name,
    syntax: 'propertyElement',
    values,
    isDirective: isDirectiveName(name),
    isAttached: Boolean(dotted),
    dotted,
    span
  };
}

function elementToObject(element: Element, context: ParseContext): XamlObjectNode {
  const rawName = element.tagName;
  const tagStart = context.locator.findElementStart(rawName, context.searchOffset);
  const tagEnd = tagStart >= 0 ? context.locator.findTagEnd(tagStart) : -1;
  if (tagEnd >= 0) {
    context.searchOffset = tagEnd;
  }

  const span = tagStart >= 0 && tagEnd >= 0 ? context.locator.span(tagStart, tagEnd) : undefined;
  const namespaceDeclarations = collectNamespaceDeclarations(element, context, tagStart, tagEnd);
  const members: XamlMemberNode[] = [];

  for (const attr of Array.from(element.attributes)) {
    const member = createAttributeMember(attr, element, context, tagStart, tagEnd);
    if (member) {
      members.push(member);
    }
  }

  const contentValues: XamlValueNode[] = [];

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
      const textNode = createTextNode(child, context);
      if (textNode) {
        contentValues.push(textNode);
      }
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const childElement = child as Element;
    if (isPropertyElement(childElement)) {
      flushContentValues(members, contentValues);
      members.push(propertyElementToMember(childElement, context));
      continue;
    }

    contentValues.push(elementToObject(childElement, context));
  }

  flushContentValues(members, contentValues);

  return {
    kind: 'object',
    type: createQualifiedName(element, rawName),
    members,
    namespaceDeclarations,
    span
  };
}

function createParseErrorDiagnostic(parserError: Element): XamlDiagnostic {
  return {
    severity: 'error',
    code: 'invalid-xml',
    message: `Invalid XAML: ${parserError.textContent?.trim() || 'Unknown parser error.'}`
  };
}

export function parseXamlToInfoset(input: string, options: XamlParseOptions = {}): XamlParseResult {
  const parser = new DOMParser();
  const xml = parser.parseFromString(input, 'application/xml');
  const parserError = xml.querySelector('parsererror');

  if (parserError) {
    const diagnostic = createParseErrorDiagnostic(parserError);
    return {
      document: null,
      diagnostics: [diagnostic]
    };
  }

  if (!xml.documentElement) {
    const diagnostic: XamlDiagnostic = {
      severity: 'error',
      code: 'missing-root',
      message: 'Invalid XAML: missing root element.'
    };
    return {
      document: null,
      diagnostics: [diagnostic]
    };
  }

  const context: ParseContext = {
    input,
    options,
    locator: createSourceLocator(input),
    diagnostics: [],
    namespaceDeclarations: [],
    namespaceKeys: new Set(),
    searchOffset: 0
  };

  const root = elementToObject(xml.documentElement, context);
  const document: XamlDocumentNode = {
    kind: 'document',
    root,
    namespaces: context.namespaceDeclarations,
    diagnostics: context.diagnostics,
    span: context.locator.span(0, input.length)
  };

  return {
    document,
    diagnostics: context.diagnostics
  };
}

export function parseAndValidateXaml(
  input: string,
  options: XamlParseOptions = {},
  registry?: XamlVocabularyRegistry
): XamlParseAndValidateResult {
  const parsed = parseXamlToInfoset(input, options);
  if (!parsed.document) {
    return {
      ...parsed,
      validation: {
        diagnostics: parsed.diagnostics,
        hasErrors: true
      }
    };
  }

  const validation = validateXamlDocument(parsed.document, registry);
  return {
    document: parsed.document,
    diagnostics: validation.diagnostics,
    validation
  };
}

function formatDiagnostic(diagnostic: XamlDiagnostic): string {
  const location = diagnostic.span
    ? ` at ${diagnostic.span.start.line}:${diagnostic.span.start.column}`
    : '';
  const label = diagnostic.severity === 'error' ? 'Error' : 'Warning';
  return `${label} ${diagnostic.code}${location}: ${diagnostic.message}`;
}

function qualifiedNameToString(name: XamlQualifiedName): string {
  return name.prefix ? `${name.prefix}:${name.localName}` : name.localName;
}

function isNullExtension(extension: XamlMarkupExtensionNode): boolean {
  return extension.type.localName === 'Null' && extension.type.namespaceUri === XAML_LANGUAGE_NAMESPACE;
}

function isBindingExtension(extension: XamlMarkupExtensionNode): boolean {
  return extension.type.localName === 'Binding' && extension.type.namespaceUri == null;
}

function coerceRuntimePrimitive(value: unknown): XamlPrimitive {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return String(value);
}

function markupExtensionArgumentToText(value: XamlMarkupExtensionValue): string {
  return typeof value === 'string' ? value : value.raw;
}

function bindingPathFromExtension(extension: XamlMarkupExtensionNode): string {
  const namedPath = extension.arguments.find((argument) => {
    return argument.kind === 'named' && argument.name.toLowerCase() === 'path';
  });

  if (namedPath) {
    return markupExtensionArgumentToText(namedPath.value).trim();
  }

  const positionalPath = extension.arguments.find((argument) => argument.kind === 'positional');
  return positionalPath ? markupExtensionArgumentToText(positionalPath.value).trim() : '';
}

function readBindingPathSegment(value: unknown, segment: string): unknown {
  if (value == null || !segment) {
    return undefined;
  }

  if (/^\d+$/.test(segment) && Array.isArray(value)) {
    return value[Number(segment)];
  }

  if (typeof value === 'object' || typeof value === 'function') {
    return (value as Record<string, unknown>)[segment];
  }

  return undefined;
}

function resolveBindingPath(dataContext: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '.') {
    return dataContext;
  }

  return trimmed.split('.').reduce(readBindingPathSegment, dataContext);
}

function evaluateMarkupExtension(extension: XamlMarkupExtensionNode, options: XamlLoweringOptions): XamlPrimitive {
  if (isNullExtension(extension)) {
    return null;
  }

  if (isBindingExtension(extension)) {
    return coerceRuntimePrimitive(resolveBindingPath(options.dataContext, bindingPathFromExtension(extension)));
  }

  return extension.raw;
}

function primitiveValueFromNode(value: XamlValueNode, options: XamlLoweringOptions): XamlPrimitive | undefined {
  if (value.kind === 'text') {
    return value.text;
  }

  if (value.kind === 'markupExtension') {
    return options.evaluateMarkupExtensions ? evaluateMarkupExtension(value, options) : value.raw;
  }

  return undefined;
}

function textFromPrimitive(value: XamlPrimitive | undefined): string {
  return value == null ? '' : String(value);
}

function scalarTextFromValue(value: XamlValueNode, options: XamlLoweringOptions): string {
  return textFromPrimitive(primitiveValueFromNode(value, options));
}

function primitiveValueFromValues(values: readonly XamlValueNode[], options: XamlLoweringOptions): XamlPrimitive | undefined {
  if (values.length === 1) {
    const value = primitiveValueFromNode(values[0], options);
    if (value !== undefined) {
      return typeof value === 'string' ? parseAttributeValue(value) : value;
    }

    return undefined;
  }

  const text = values.map((value) => scalarTextFromValue(value, options)).join('');
  if (!text) {
    return undefined;
  }

  return parseAttributeValue(text);
}

function textValueFromMember(member: XamlMemberNode, options: XamlLoweringOptions): string {
  return member.values.map((value) => scalarTextFromValue(value, options)).join('');
}

function namespaceAttributeName(declaration: XamlNamespaceDeclaration): string {
  return declaration.prefix ? `xmlns:${declaration.prefix}` : 'xmlns';
}

function lowerTypeName(object: XamlObjectNode, registry: XamlVocabularyRegistry): string {
  return resolveXamlType(object.type, registry)?.name ?? qualifiedNameToString(object.type);
}

function textValueFromValues(values: readonly XamlValueNode[], options: XamlLoweringOptions): string {
  return values.map((value) => scalarTextFromValue(value, options)).join('').trim();
}

function lowerDirectiveName(member: XamlMemberNode, registry: XamlVocabularyRegistry): string {
  return resolveXamlDirective(member.name, registry)?.name ?? qualifiedNameToString(member.name);
}

function lowerMemberName(
  member: XamlMemberNode,
  ownerType: XamlTypeDefinition | null,
  registry: XamlVocabularyRegistry
): string {
  if (member.isDirective) {
    return lowerDirectiveName(member, registry);
  }

  if (member.dotted) {
    if (ownerType && member.dotted.owner.localName === ownerType.name) {
      return resolveXamlMember(ownerType, member.dotted.member, registry)?.name ?? member.dotted.member;
    }

    const attached = resolveXamlAttachedMember(member.dotted.owner.localName, member.dotted.member, registry);
    return attached ? `${attached.attachedOwner}.${attached.name}` : `${member.dotted.owner.localName}.${member.dotted.member}`;
  }

  return ownerType
    ? resolveXamlMember(ownerType, member.name, registry)?.name ?? qualifiedNameToString(member.name)
    : qualifiedNameToString(member.name);
}

function lowerValueObjects(
  values: readonly XamlValueNode[],
  registry: XamlVocabularyRegistry,
  options: XamlLoweringOptions
): XamlNode[] {
  return values
    .filter((value): value is XamlObjectNode => value.kind === 'object')
    .map((value) => lowerObjectNode(value, registry, options));
}

function lowerPropertyMember(
  node: XamlNode,
  ownerType: XamlTypeDefinition | null,
  member: XamlMemberNode,
  registry: XamlVocabularyRegistry,
  options: XamlLoweringOptions
): void {
  const memberName = lowerMemberName(member, ownerType, registry);
  const valueObjects = lowerValueObjects(member.values, registry, options);
  const textValue = textValueFromValues(member.values, options);

  if (valueObjects.length > 0) {
    if (ownerType?.contentProperty === memberName) {
      node.children.push(...valueObjects);
      if (textValue && node.children.length === 0) {
        node.text = textValue;
      }
      return;
    }

    node.children.push({
      type: lowerMemberName(member, ownerType, registry),
      attributes: {},
      children: valueObjects,
      text: textValue || undefined
    });
    return;
  }

  const primitiveValue = primitiveValueFromValues(member.values, options);
  if (primitiveValue === undefined) {
    return;
  }

  if (primitiveValue === null) {
    node.attributes[memberName] = null;
    return;
  }

  if (ownerType?.contentProperty === memberName && ownerType.allowsText) {
    if (memberName === 'Text') {
      node.attributes.Text = primitiveValue;
      node.text = textValue;
      return;
    }

    node.attributes[memberName] = primitiveValue;
    return;
  }

  node.attributes[memberName] = primitiveValue;
}

function lowerContentMember(
  node: XamlNode,
  ownerType: XamlTypeDefinition | null,
  member: XamlMemberNode,
  registry: XamlVocabularyRegistry,
  options: XamlLoweringOptions
): void {
  const valueObjects = lowerValueObjects(member.values, registry, options);
  const textValue = textValueFromValues(member.values, options);
  node.children.push(...valueObjects);

  const primitiveValue = primitiveValueFromValues(member.values, options);
  if (primitiveValue === undefined) {
    return;
  }

  if (primitiveValue === null) {
    if (ownerType?.contentProperty === 'Text') {
      node.attributes.Text = null;
    } else if (ownerType?.contentProperty === 'Content') {
      node.attributes.Content = null;
    }
    return;
  }

  if (ownerType?.contentProperty === 'Text') {
    node.attributes.Text = primitiveValue;
    node.text = textValue;
    return;
  }

  if (ownerType?.contentProperty === 'Content') {
    node.attributes.Content = primitiveValue;
    node.text = textValue;
    return;
  }

  if (node.children.length === 0) {
    node.text = textValue;
  }
}

function lowerObjectNode(
  object: XamlObjectNode,
  registry: XamlVocabularyRegistry,
  options: XamlLoweringOptions
): XamlNode {
  const ownerType = resolveXamlType(object.type, registry);
  const attributes: XamlAttributeMap = {};
  const node: XamlNode = {
    type: lowerTypeName(object, registry),
    attributes,
    children: []
  };

  for (const declaration of object.namespaceDeclarations) {
    if (!resolveXamlType(object.type, registry)) {
      attributes[namespaceAttributeName(declaration)] = declaration.namespaceUri;
    }
  }

  for (const member of object.members) {
    if (member.syntax === 'attribute') {
      const memberName = lowerMemberName(member, ownerType, registry);
      const textValue = textValueFromMember(member, options);
      const primitiveValue = primitiveValueFromValues(member.values, options);
      if (primitiveValue !== undefined) {
        attributes[memberName] = primitiveValue;
      }

      if ((memberName === 'Text' || memberName === 'Content') && ownerType?.contentProperty === memberName) {
        node.text = textValue;
      }

      continue;
    }

    if (member.syntax === 'propertyElement') {
      lowerPropertyMember(node, ownerType, member, registry, options);
      continue;
    }

    lowerContentMember(node, ownerType, member, registry, options);
  }

  return node;
}

export function lowerXamlDocument(
  document: XamlDocumentNode,
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry,
  options: XamlLoweringOptions = {}
): XamlDocument {
  if (!document.root) {
    throw new Error('Invalid XAML: missing root element.');
  }

  return {
    root: lowerObjectNode(document.root, registry, options)
  };
}

export const toLegacyXamlDocument = lowerXamlDocument;

export function parseAndLowerXaml(
  input: string,
  options: XamlParseOptions = {},
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry,
  loweringOptions: XamlLoweringOptions = {}
): XamlLoweredParseResult {
  const result = parseAndValidateXaml(input, options, registry);

  if (!result.document || result.validation.hasErrors) {
    return {
      ...result,
      legacyDocument: null,
      hasErrors: true
    };
  }

  return {
    ...result,
    legacyDocument: lowerXamlDocument(result.document, registry, loweringOptions),
    hasErrors: false
  };
}

export function parseRuntimeXaml(
  input: string,
  options: XamlParseOptions = {},
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry,
  loweringOptions: XamlLoweringOptions = {}
): XamlDocument {
  const result = parseAndLowerXaml(input, options, registry, {
    ...loweringOptions,
    evaluateMarkupExtensions: true
  });
  if (!result.legacyDocument) {
    const reason = result.diagnostics.length > 0
      ? result.diagnostics.map(formatDiagnostic).join('\n')
      : 'Invalid XAML document.';
    throw new Error(reason);
  }

  return result.legacyDocument;
}

export function parseStrictXaml(
  input: string,
  options: XamlParseOptions = {},
  registry: XamlVocabularyRegistry = uiDesignerVocabularyRegistry,
  loweringOptions: XamlLoweringOptions = {}
): XamlDocument {
  const result = parseAndLowerXaml(input, options, registry, loweringOptions);
  if (!result.legacyDocument) {
    const reason = result.diagnostics.length > 0
      ? result.diagnostics.map(formatDiagnostic).join('\n')
      : 'Invalid XAML document.';
    throw new Error(reason);
  }

  return result.legacyDocument;
}

export function parseLegacyXaml(input: string, options: XamlParseOptions = {}): XamlDocument {
  const result = parseXamlToInfoset(input, options);
  const error = result.diagnostics.find((diagnostic) => diagnostic.severity === 'error');

  if (error) {
    throw new Error(error.message);
  }

  if (!result.document) {
    throw new Error('Invalid XAML: missing root element.');
  }

  return lowerXamlDocument(result.document);
}

export function parseXaml(input: string, options: XamlParseOptions = {}): XamlDocument {
  return parseLegacyXaml(input, options);
}
