import {
  XAML_LANGUAGE_NAMESPACE,
  XML_NAMESPACE,
  XMLNS_NAMESPACE,
  type XamlAttributeMap,
  type XamlDiagnostic,
  type XamlDocument,
  type XamlDocumentNode,
  type XamlDottedMember,
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
  type XamlValueNode
} from '@ui-designer/xaml-schema';

export type { XamlParseDiagnostic, XamlParseOptions, XamlParseResult } from '@ui-designer/xaml-schema';

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
  return {
    rawName,
    prefix: node.prefix || null,
    localName: node.localName || rawName.split(':').pop() || rawName,
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

function createAttributeMember(attr: Attr, context: ParseContext, tagStart: number, tagEnd: number): XamlMemberNode | null {
  if (isNamespaceDeclaration(attr)) {
    return null;
  }

  const name = createQualifiedName(attr, attr.name);
  const dotted = createDottedMember(name);
  const span = context.locator.findAttributeSpan(tagStart, tagEnd, attr.name);
  const valueNode: XamlTextNode = {
    kind: 'text',
    text: attr.value,
    span
  };

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
    const member = createAttributeMember(attr, context, tagStart, tagEnd);
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

function qualifiedNameToString(name: XamlQualifiedName): string {
  return name.prefix ? `${name.prefix}:${name.localName}` : name.localName;
}

function textValueFromMember(member: XamlMemberNode): string {
  return member.values
    .filter((value): value is XamlTextNode => value.kind === 'text')
    .map((value) => value.text)
    .join('');
}

function namespaceAttributeName(declaration: XamlNamespaceDeclaration): string {
  return declaration.prefix ? `xmlns:${declaration.prefix}` : 'xmlns';
}

function memberElementToLegacyNode(member: XamlMemberNode): XamlNode {
  const children: XamlNode[] = [];
  const textParts: string[] = [];

  for (const value of member.values) {
    if (value.kind === 'object') {
      children.push(objectToLegacyNode(value));
    } else {
      textParts.push(value.text);
    }
  }

  const text = children.length === 0 ? textParts.join('').trim() : '';

  return {
    type: qualifiedNameToString(member.name),
    attributes: {},
    children,
    text: text || undefined
  };
}

function objectToLegacyNode(object: XamlObjectNode): XamlNode {
  const attributes: XamlAttributeMap = {};
  const children: XamlNode[] = [];
  const textParts: string[] = [];

  for (const declaration of object.namespaceDeclarations) {
    attributes[namespaceAttributeName(declaration)] = declaration.namespaceUri;
  }

  for (const member of object.members) {
    if (member.syntax === 'attribute') {
      attributes[qualifiedNameToString(member.name)] = parseAttributeValue(textValueFromMember(member));
      continue;
    }

    if (member.syntax === 'propertyElement') {
      children.push(memberElementToLegacyNode(member));
      continue;
    }

    for (const value of member.values) {
      if (value.kind === 'object') {
        children.push(objectToLegacyNode(value));
      } else {
        textParts.push(value.text);
      }
    }
  }

  const text = children.length === 0 ? textParts.join('').trim() : '';

  return {
    type: qualifiedNameToString(object.type),
    attributes,
    children,
    text: text || undefined
  };
}

export function toLegacyXamlDocument(document: XamlDocumentNode): XamlDocument {
  if (!document.root) {
    throw new Error('Invalid XAML: missing root element.');
  }

  return {
    root: objectToLegacyNode(document.root)
  };
}

export function parseXaml(input: string): XamlDocument {
  const result = parseXamlToInfoset(input);
  const error = result.diagnostics.find((diagnostic) => diagnostic.severity === 'error');

  if (error) {
    throw new Error(error.message);
  }

  if (!result.document) {
    throw new Error('Invalid XAML: missing root element.');
  }

  return toLegacyXamlDocument(result.document);
}
