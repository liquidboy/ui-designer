import type { XamlAttributeMap, XamlDocument, XamlNode } from '@ui-designer/xaml-schema';

function parseAttributeValue(value: string): string | number | boolean {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && trimmed.length > 0) {
    return asNumber;
  }

  return value;
}

function elementToNode(element: Element): XamlNode {
  const attributes: XamlAttributeMap = {};

  for (const attr of Array.from(element.attributes)) {
    attributes[attr.name] = parseAttributeValue(attr.value);
  }

  const children = Array.from(element.children).map(elementToNode);
  const text = element.childNodes.length === 1 ? element.textContent?.trim() : undefined;

  return {
    type: element.tagName,
    attributes,
    children,
    text: text || undefined
  };
}

export function parseXaml(input: string): XamlDocument {
  const parser = new DOMParser();
  const xml = parser.parseFromString(input, 'application/xml');
  const parserError = xml.querySelector('parsererror');

  if (parserError) {
    throw new Error(`Invalid XAML: ${parserError.textContent || 'Unknown parser error.'}`);
  }

  if (!xml.documentElement) {
    throw new Error('Invalid XAML: missing root element.');
  }

  return {
    root: elementToNode(xml.documentElement)
  };
}
