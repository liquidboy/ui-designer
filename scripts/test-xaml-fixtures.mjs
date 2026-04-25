#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const UI_DESIGNER_NAMESPACE = 'https://liquidboy.dev/ui-designer';
const XAML_LANGUAGE_NAMESPACE = 'http://schemas.microsoft.com/winfx/2006/xaml';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class FixtureTextNode {
  constructor(text, nodeType = 3) {
    this.nodeType = nodeType;
    this.nodeValue = text;
  }
}

class FixtureAttr {
  constructor(rawName, value, namespaceMap) {
    const { prefix, localName } = splitQualifiedName(rawName);
    this.name = rawName;
    this.value = value;
    this.prefix = prefix;
    this.localName = localName;
    this.namespaceURI = resolveAttributeNamespace(rawName, prefix, namespaceMap);
  }
}

class FixtureElement {
  constructor(rawName, namespaceMap) {
    const { prefix, localName } = splitQualifiedName(rawName);
    this.nodeType = 1;
    this.tagName = rawName;
    this.prefix = prefix;
    this.localName = localName;
    this.namespaceURI = prefix ? namespaceMap.get(prefix) ?? null : namespaceMap.get(null) ?? null;
    this.namespaceMap = namespaceMap;
    this.attributes = [];
    this.childNodes = [];
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent ?? node.nodeValue ?? '').join('');
  }

  lookupNamespaceURI(prefix) {
    return this.namespaceMap.get(prefix ?? null) ?? null;
  }
}

class FixtureDocument {
  constructor(root, error) {
    this.documentElement = root;
    this.error = error;
  }

  querySelector(selector) {
    if (selector === 'parsererror' && this.error) {
      return { textContent: this.error };
    }

    return null;
  }
}

class FixtureDOMParser {
  parseFromString(input) {
    const result = parseFixtureXml(input);
    return new FixtureDocument(result.root, result.error);
  }
}

globalThis.Node = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
  CDATA_SECTION_NODE: 4
};
globalThis.DOMParser = FixtureDOMParser;

const {
  lowerXamlDocument,
  parseAndValidateXaml,
  parseRuntimeXaml,
  parseStrictXaml,
  parseXamlToInfoset,
  serializeXamlDocumentNode
} = await import('../packages/xaml-parser/dist/index.js');

const {
  insertDocumentChild,
  moveDocumentNode,
  parseDesignerDocumentWithDiagnostics,
  removeDocumentNode,
  serializeDesignerDocument,
  updateDocumentNodeAttributes
} = await import('../packages/designer-core/dist/index.js');

function splitQualifiedName(rawName) {
  const separator = rawName.indexOf(':');
  if (separator < 0) {
    return { prefix: null, localName: rawName };
  }

  return {
    prefix: rawName.slice(0, separator),
    localName: rawName.slice(separator + 1)
  };
}

function resolveAttributeNamespace(rawName, prefix, namespaceMap) {
  if (rawName === 'xmlns' || prefix === 'xmlns') {
    return XMLNS_NAMESPACE;
  }

  if (prefix === 'xml') {
    return XML_NAMESPACE;
  }

  return prefix ? namespaceMap.get(prefix) ?? null : null;
}

function findTagEnd(input, start) {
  let quote = null;

  for (let index = start; index < input.length; index += 1) {
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
      return index;
    }
  }

  return -1;
}

function parseStartTag(source) {
  let cursor = 0;

  const readWhitespace = () => {
    while (cursor < source.length && /\s/.test(source[cursor])) {
      cursor += 1;
    }
  };

  const readName = () => {
    const start = cursor;
    while (cursor < source.length && !/[\s=/>]/.test(source[cursor])) {
      cursor += 1;
    }
    return source.slice(start, cursor);
  };

  readWhitespace();
  const rawName = readName();
  if (!rawName) {
    throw new Error('Missing element name.');
  }

  const attributes = [];

  while (cursor < source.length) {
    readWhitespace();
    if (cursor >= source.length) {
      break;
    }

    const name = readName();
    if (!name) {
      throw new Error(`Invalid attribute on "${rawName}".`);
    }

    readWhitespace();
    if (source[cursor] !== '=') {
      throw new Error(`Attribute "${name}" is missing "=".`);
    }
    cursor += 1;
    readWhitespace();

    const quote = source[cursor];
    if (quote !== '"' && quote !== "'") {
      throw new Error(`Attribute "${name}" must use quotes.`);
    }
    cursor += 1;

    const valueStart = cursor;
    while (cursor < source.length && source[cursor] !== quote) {
      cursor += 1;
    }

    if (cursor >= source.length) {
      throw new Error(`Attribute "${name}" has an unterminated value.`);
    }

    attributes.push({
      name,
      value: decodeXmlEntities(source.slice(valueStart, cursor))
    });
    cursor += 1;
  }

  return { rawName, attributes };
}

function decodeXmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function appendNode(stack, rootRef, node) {
  const parent = stack.at(-1);
  if (parent) {
    parent.element.childNodes.push(node);
    return rootRef.root;
  }

  if (node.nodeType === 1) {
    if (rootRef.root) {
      throw new Error('Multiple root elements.');
    }
    rootRef.root = node;
    return rootRef.root;
  }

  if ((node.nodeValue ?? '').trim()) {
    throw new Error('Text is not allowed outside the root element.');
  }

  return rootRef.root;
}

function parseFixtureXml(input) {
  try {
    const stack = [];
    const rootRef = { root: null };
    let cursor = 0;

    while (cursor < input.length) {
      if (input.startsWith('<!--', cursor)) {
        const end = input.indexOf('-->', cursor + 4);
        if (end < 0) {
          throw new Error('Unterminated comment.');
        }
        cursor = end + 3;
        continue;
      }

      if (input.startsWith('<?', cursor)) {
        const end = input.indexOf('?>', cursor + 2);
        if (end < 0) {
          throw new Error('Unterminated processing instruction.');
        }
        cursor = end + 2;
        continue;
      }

      if (input.startsWith('<![CDATA[', cursor)) {
        const end = input.indexOf(']]>', cursor + 9);
        if (end < 0) {
          throw new Error('Unterminated CDATA section.');
        }
        appendNode(stack, rootRef, new FixtureTextNode(input.slice(cursor + 9, end), 4));
        cursor = end + 3;
        continue;
      }

      if (input[cursor] !== '<') {
        const next = input.indexOf('<', cursor);
        const end = next < 0 ? input.length : next;
        appendNode(stack, rootRef, new FixtureTextNode(decodeXmlEntities(input.slice(cursor, end))));
        cursor = end;
        continue;
      }

      if (input.startsWith('</', cursor)) {
        const end = input.indexOf('>', cursor + 2);
        if (end < 0) {
          throw new Error('Unterminated closing tag.');
        }

        const closingName = input.slice(cursor + 2, end).trim();
        const frame = stack.pop();
        if (!frame || frame.element.tagName !== closingName) {
          throw new Error(`Mismatched closing tag "${closingName}".`);
        }

        cursor = end + 1;
        continue;
      }

      const tagEnd = findTagEnd(input, cursor + 1);
      if (tagEnd < 0) {
        throw new Error('Unterminated start tag.');
      }

      let tagSource = input.slice(cursor + 1, tagEnd);
      const selfClosing = /\/\s*$/.test(tagSource);
      if (selfClosing) {
        tagSource = tagSource.replace(/\/\s*$/, '');
      }

      const parentNamespaceMap = stack.at(-1)?.namespaceMap ?? new Map([['xml', XML_NAMESPACE]]);
      const namespaceMap = new Map(parentNamespaceMap);
      const parsed = parseStartTag(tagSource);

      for (const attr of parsed.attributes) {
        if (attr.name === 'xmlns') {
          namespaceMap.set(null, attr.value);
        } else if (attr.name.startsWith('xmlns:')) {
          namespaceMap.set(attr.name.slice('xmlns:'.length), attr.value);
        }
      }

      const element = new FixtureElement(parsed.rawName, namespaceMap);
      element.attributes = parsed.attributes.map((attr) => new FixtureAttr(attr.name, attr.value, namespaceMap));
      appendNode(stack, rootRef, element);

      if (!selfClosing) {
        stack.push({ element, namespaceMap });
      }

      cursor = tagEnd + 1;
    }

    if (stack.length > 0) {
      throw new Error(`Unclosed tag "${stack.at(-1).element.tagName}".`);
    }

    if (!rootRef.root) {
      throw new Error('Missing root element.');
    }

    return { root: rootRef.root, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      root: new FixtureElement('parsererror', new Map()),
      error: message
    };
  }
}

function diagnosticsWithSeverity(result, severity) {
  return result.diagnostics.filter((diagnostic) => diagnostic.severity === severity).map((diagnostic) => diagnostic.code);
}

function findMember(object, localName, syntax) {
  return object.members.find((member) => {
    return member.name.localName === localName && (!syntax || member.syntax === syntax);
  });
}

function findDottedMember(object, memberName, syntax) {
  return object.members.find((member) => {
    return member.dotted?.member === memberName && (!syntax || member.syntax === syntax);
  });
}

function assertNoParseErrors(fileName, result) {
  assert.deepEqual(diagnosticsWithSeverity(result, 'error'), [], `${fileName} should parse without errors`);
  assert.ok(result.document?.root, `${fileName} should produce a root object`);
}

async function readFixture(group, fileName) {
  return readFile(path.join(rootDir, 'packages/xaml-parser/fixtures', group, fileName), 'utf8');
}

async function listFixtureFiles(group) {
  const groupDir = path.join(rootDir, 'packages/xaml-parser/fixtures', group);
  return (await readdir(groupDir)).filter((fileName) => fileName.endsWith('.xaml')).sort();
}

async function runPhase1Fixtures() {
  const files = await listFixtureFiles('phase1');

  for (const fileName of files) {
    const input = await readFixture('phase1', fileName);
    const result = parseXamlToInfoset(input);

    if (fileName === 'invalid-xml.xaml') {
      assert.equal(result.document, null, 'invalid XML should not produce a document');
      assert.deepEqual(diagnosticsWithSeverity(result, 'error'), ['invalid-xml']);
      continue;
    }

    assertNoParseErrors(fileName, result);
    const root = result.document.root;

    if (fileName === 'plain-object.xaml') {
      assert.equal(root.type.localName, 'Canvas');
      const content = findMember(root, 'Content', 'content');
      assert.equal(content?.values[0]?.kind, 'object');
      assert.equal(content.values[0].type.localName, 'Rectangle');
    }

    if (fileName === 'namespaced-root.xaml') {
      assert.equal(root.type.localName, 'Canvas');
      assert.equal(root.type.namespaceUri, UI_DESIGNER_NAMESPACE);
      assert.ok(result.document.namespaces.some((namespace) => namespace.prefix === 'x' && namespace.namespaceUri === XAML_LANGUAGE_NAMESPACE));
      assert.ok(root.members.some((member) => member.isDirective && member.name.localName === 'Name'));
    }

    if (fileName === 'attribute-members.xaml') {
      const content = findMember(root, 'Content', 'content');
      const rectangle = content.values[0];
      assert.equal(rectangle.kind, 'object');
      assert.ok(rectangle.members.some((member) => member.dotted?.owner.localName === 'Grid' && member.dotted.member === 'Row'));
      assert.ok(rectangle.members.some((member) => member.dotted?.owner.localName === 'Designer' && member.dotted.member === 'OffsetX'));
    }

    if (fileName === 'property-element.xaml') {
      assert.ok(root.members.some((member) => member.syntax === 'propertyElement' && member.name.localName === 'Grid.RowDefinitions'));
    }

    if (fileName === 'mixed-content.xaml') {
      const content = findMember(root, 'Content', 'content');
      assert.equal(content.values.length, 3);
      assert.equal(content.values[0].kind, 'text');
      assert.equal(content.values[1].kind, 'object');
      assert.equal(content.values[2].kind, 'text');
    }
  }

  return files.length;
}

async function runPhase2ValidationFixtures() {
  const expectations = {
    'valid-basic.xaml': { errors: [], warnings: [] },
    'valid-directive-preserved.xaml': { errors: [], warnings: ['unsupported-directive'] },
    'valid-class-root.xaml': { errors: [], warnings: ['unsupported-directive'] },
    'valid-metadata-directives.xaml': {
      errors: [],
      warnings: ['unsupported-directive', 'unsupported-directive', 'unsupported-directive', 'unsupported-directive']
    },
    'duplicate-namescope.xaml': { errors: ['namescope-collision'], warnings: ['unsupported-directive'] },
    'invalid-class-child.xaml': { errors: ['invalid-directive-placement'], warnings: [] },
    'unknown-type.xaml': { errors: ['unknown-type'], warnings: [] },
    'unknown-member.xaml': { errors: ['unknown-member'], warnings: [] },
    'duplicate-member.xaml': { errors: ['duplicate-member'], warnings: [] },
    'invalid-enum.xaml': { errors: ['invalid-enum-value'], warnings: [] },
    'invalid-content.xaml': { errors: ['content-children-not-allowed'], warnings: [] }
  };

  const files = await listFixtureFiles('phase2-validation');

  for (const fileName of files) {
    const input = await readFixture('phase2-validation', fileName);
    const result = parseAndValidateXaml(input);
    const expected = expectations[fileName];
    assert.ok(expected, `Missing validation expectation for ${fileName}`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), expected.errors, `${fileName} error diagnostics`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'warning'), expected.warnings, `${fileName} warning diagnostics`);
  }

  return files.length;
}

async function runPhase3LoweringFixtures() {
  const files = await listFixtureFiles('phase3-lowering');

  const lowerFixture = async (fileName) => {
    const input = await readFixture('phase3-lowering', fileName);
    const result = parseAndValidateXaml(input);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), [], `${fileName} should validate without errors`);
    return lowerXamlDocument(result.document);
  };

  const textAttribute = await lowerFixture('text-attribute.xaml');
  const textProperty = await lowerFixture('text-property-element.xaml');
  assert.deepEqual(textProperty, textAttribute, 'TextBlock attribute and property-element syntax should lower identically');
  assert.equal(textAttribute.root.type, 'TextBlock');
  assert.equal(textAttribute.root.attributes.Text, 'Hello');
  assert.equal(textAttribute.root.text, 'Hello');

  const borderChild = await lowerFixture('border-child-property.xaml');
  assert.equal(borderChild.root.type, 'Border');
  assert.equal(borderChild.root.children.length, 1);
  assert.equal(borderChild.root.children[0].type, 'TextBlock');
  assert.equal(borderChild.root.children[0].attributes.Text, 'Inside border');

  const namespaced = await lowerFixture('namespaced-ui.xaml');
  assert.equal(namespaced.root.type, 'Canvas');
  assert.equal(namespaced.root.attributes.Name, 'RootCanvas');
  assert.equal(namespaced.root.attributes.Width, 320);
  assert.equal(namespaced.root.children[0].type, 'TextBlock');
  assert.equal(namespaced.root.children[0].attributes.Text, 'Namespaced lower');
  assert.equal('xmlns:ui' in namespaced.root.attributes, false);

  const attached = await lowerFixture('attached-members.xaml');
  const rectangle = attached.root.children[0];
  assert.equal(rectangle.attributes['Grid.Row'], 1);
  assert.equal(rectangle.attributes['Grid.Column'], 2);

  return files.length;
}

async function runPhase4DesignerConfigFixtures() {
  const expectations = {
    'theme-valid.xaml': { errors: [] },
    'chrome-valid.xaml': { errors: [] },
    'panels-valid.xaml': { errors: [] },
    'theme-unknown-member.xaml': { errors: ['unknown-member'] }
  };

  const files = await listFixtureFiles('phase4-designer-config');

  for (const fileName of files) {
    const input = await readFixture('phase4-designer-config', fileName);
    const result = parseAndValidateXaml(input);
    const expected = expectations[fileName];
    assert.ok(expected, `Missing designer-config expectation for ${fileName}`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), expected.errors, `${fileName} error diagnostics`);

    if (expected.errors.length > 0) {
      continue;
    }

    const lowered = lowerXamlDocument(result.document);

    if (fileName === 'theme-valid.xaml') {
      assert.equal(lowered.root.type, 'DesignerTheme');
      assert.equal(lowered.root.children[0]?.type, 'Colors');
      assert.equal(lowered.root.children[0]?.children[0]?.type, 'Color');
      assert.equal(lowered.root.children[0]?.children[0]?.attributes.Id, 'app-bg');
    }

    if (fileName === 'chrome-valid.xaml') {
      assert.equal(lowered.root.type, 'DesignerChrome');
      assert.equal(lowered.root.children[0]?.type, 'TopMenu');
      assert.equal(lowered.root.children[0]?.children[0]?.type, 'MenuItem');
      assert.equal(lowered.root.children[0]?.children[0]?.attributes.Label, 'File');
      assert.equal(lowered.root.children[2]?.type, 'DockTabs');
      assert.equal(lowered.root.children[2]?.attributes.Slot, 'left');
    }

    if (fileName === 'panels-valid.xaml') {
      assert.equal(lowered.root.type, 'DesignerPanels');
      assert.equal(lowered.root.children[0]?.type, 'LeftRail');
      assert.equal(lowered.root.children[0]?.children[0]?.type, 'Panel');
      assert.equal(lowered.root.children[1]?.type, 'InspectorGroups');
      assert.equal(lowered.root.children[1]?.children[0]?.type, 'Group');
    }
  }

  return files.length;
}

async function runPhase5MarkupExtensionFixtures() {
  const expectations = {
    'binding-attribute.xaml': { errors: [], warnings: [] },
    'binding-property-element.xaml': { errors: [], warnings: [] },
    'nested-extension.xaml': {
      errors: [],
      warnings: []
    },
    'escaped-literal.xaml': { errors: [], warnings: [] },
    'escaped-property-element.xaml': { errors: [], warnings: [] },
    'x-null-attribute.xaml': { errors: [], warnings: [] },
    'x-null-property-element.xaml': { errors: [], warnings: [] },
    'invalid-property-element.xaml': { errors: ['invalid-markup-extension-syntax'], warnings: [] },
    'invalid-markup-extension.xaml': { errors: ['invalid-markup-extension-syntax'], warnings: [] }
  };

  const files = await listFixtureFiles('phase5-markup-extension');

  for (const fileName of files) {
    const input = await readFixture('phase5-markup-extension', fileName);
    const parsed = parseXamlToInfoset(input);
    const expected = expectations[fileName];
    assert.ok(expected, `Missing markup-extension expectation for ${fileName}`);
    assert.deepEqual(diagnosticsWithSeverity(parsed, 'error'), expected.errors, `${fileName} parse diagnostics`);

    if (expected.errors.length > 0) {
      continue;
    }

    const root = parsed.document.root;

    if (fileName === 'binding-attribute.xaml') {
      const textMember = findMember(root, 'Text', 'attribute');
      assert.equal(textMember?.values[0]?.kind, 'markupExtension');
      assert.equal(textMember.values[0].type.localName, 'Binding');
      assert.equal(textMember.values[0].arguments[0]?.kind, 'named');
      assert.equal(textMember.values[0].arguments[0]?.name, 'Path');
      assert.equal(textMember.values[0].arguments[0]?.value, 'Title');
    }

    if (fileName === 'binding-property-element.xaml') {
      const textMember = findDottedMember(root, 'Text', 'propertyElement');
      assert.equal(textMember?.values[0]?.kind, 'markupExtension');
      assert.equal(textMember.values[0].type.localName, 'Binding');
      assert.equal(textMember.values[0].arguments[0]?.kind, 'named');
      assert.equal(textMember.values[0].arguments[0]?.name, 'Path');
      assert.equal(textMember.values[0].arguments[0]?.value, 'Title');
    }

    if (fileName === 'nested-extension.xaml') {
      const textMember = findMember(root, 'Text', 'attribute');
      const extension = textMember?.values[0];
      assert.equal(extension?.kind, 'markupExtension');
      assert.equal(extension.arguments[1]?.kind, 'named');
      assert.equal(extension.arguments[1]?.name, 'Converter');
      assert.equal(extension.arguments[1]?.value.kind, 'markupExtension');
      assert.equal(extension.arguments[1]?.value.type.localName, 'StaticResource');
      assert.equal(extension.arguments[1]?.value.arguments[0]?.kind, 'positional');
      assert.equal(extension.arguments[1]?.value.arguments[0]?.value, 'TitleConverter');
    }

    if (fileName === 'escaped-literal.xaml') {
      const textMember = findMember(root, 'Text', 'attribute');
      assert.equal(textMember?.values[0]?.kind, 'text');
      assert.equal(textMember.values[0].text, '{Binding Path=Title}');
    }

    if (fileName === 'escaped-property-element.xaml') {
      const textMember = findDottedMember(root, 'Text', 'propertyElement');
      assert.equal(textMember?.values[0]?.kind, 'text');
      assert.equal(textMember.values[0].text, '{Binding Path=Title}');
    }

    if (fileName === 'x-null-attribute.xaml') {
      const contentMember = findMember(root, 'Content', 'attribute');
      assert.equal(contentMember?.values[0]?.kind, 'markupExtension');
      assert.equal(contentMember.values[0].type.prefix, 'x');
      assert.equal(contentMember.values[0].type.localName, 'Null');
      assert.equal(contentMember.values[0].type.namespaceUri, XAML_LANGUAGE_NAMESPACE);
    }

    if (fileName === 'x-null-property-element.xaml') {
      const contentMember = findDottedMember(root, 'Content', 'propertyElement');
      assert.equal(contentMember?.values[0]?.kind, 'markupExtension');
      assert.equal(contentMember.values[0].type.prefix, 'x');
      assert.equal(contentMember.values[0].type.localName, 'Null');
      assert.equal(contentMember.values[0].type.namespaceUri, XAML_LANGUAGE_NAMESPACE);
    }

    const validated = parseAndValidateXaml(input);
    assert.deepEqual(diagnosticsWithSeverity(validated.validation, 'error'), expected.errors, `${fileName} validation errors`);
    assert.deepEqual(
      diagnosticsWithSeverity(validated.validation, 'warning'),
      expected.warnings,
      `${fileName} validation warnings`
    );

    const lowered = lowerXamlDocument(validated.document);

    if (fileName === 'binding-attribute.xaml') {
      assert.equal(lowered.root.attributes.Text, '{Binding Path=Title}');
    }

    if (fileName === 'binding-property-element.xaml') {
      assert.equal(lowered.root.attributes.Text, '{Binding Path=Title}');
      assert.equal(lowered.root.text, '{Binding Path=Title}');
    }

    if (fileName === 'nested-extension.xaml') {
      assert.equal(lowered.root.attributes.Text, '{Binding Path=Title, Converter={StaticResource TitleConverter}}');
    }

    if (fileName === 'escaped-literal.xaml') {
      assert.equal(lowered.root.attributes.Text, '{Binding Path=Title}');
    }

    if (fileName === 'escaped-property-element.xaml') {
      assert.equal(lowered.root.attributes.Text, '{Binding Path=Title}');
      assert.equal(lowered.root.text, '{Binding Path=Title}');
    }

    if (fileName === 'x-null-attribute.xaml') {
      assert.equal(lowered.root.attributes.Content, '{x:Null}');
    }

    if (fileName === 'x-null-property-element.xaml') {
      assert.equal(lowered.root.attributes.Content, '{x:Null}');
    }
  }

  return files.length;
}

async function runPhase7RuntimeExtensionFixtures() {
  const files = await listFixtureFiles('phase7-runtime-extensions');
  const dataContext = {
    Title: 'Runtime title',
    Action: { Label: 'Save now' },
    User: { Profile: { DisplayName: 'Ada Lovelace' } }
  };

  for (const fileName of files) {
    const input = await readFixture('phase7-runtime-extensions', fileName);
    const result = parseAndValidateXaml(input);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), [], `${fileName} validation errors`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'warning'), [], `${fileName} validation warnings`);

    const preserved = lowerXamlDocument(result.document);
    const runtime = parseRuntimeXaml(input, {}, undefined, { dataContext });
    const strict = parseStrictXaml(input);

    if (fileName === 'binding-text.xaml') {
      assert.equal(preserved.root.attributes.Text, '{Binding Path=Title}');
      assert.equal(strict.root.attributes.Text, '{Binding Path=Title}');
      assert.equal(runtime.root.attributes.Text, 'Runtime title');
      assert.equal(runtime.root.text, 'Runtime title');
    }

    if (fileName === 'binding-property-element.xaml') {
      assert.equal(preserved.root.attributes.Text, '{Binding Path=Title}');
      assert.equal(strict.root.attributes.Text, '{Binding Path=Title}');
      assert.equal(runtime.root.attributes.Text, 'Runtime title');
      assert.equal(runtime.root.text, 'Runtime title');
    }

    if (fileName === 'binding-positional.xaml') {
      assert.equal(preserved.root.attributes.Content, '{Binding Action.Label}');
      assert.equal(runtime.root.attributes.Content, 'Save now');
      assert.equal(runtime.root.text, 'Save now');
    }

    if (fileName === 'binding-nested-path.xaml') {
      assert.equal(runtime.root.attributes.Text, 'Ada Lovelace');
      assert.equal(runtime.root.text, 'Ada Lovelace');
    }

    if (fileName === 'x-null-content.xaml') {
      assert.equal(preserved.root.attributes.Content, '{x:Null}');
      assert.equal(runtime.root.attributes.Content, null);
      assert.equal(runtime.root.text, '');
    }

    if (fileName === 'x-null-property-element.xaml') {
      assert.equal(preserved.root.attributes.Content, '{x:Null}');
      assert.equal(runtime.root.attributes.Content, null);
      assert.equal(runtime.root.text, '');
    }

    if (fileName === 'escaped-literal.xaml') {
      assert.equal(runtime.root.attributes.Text, '{Binding Path=Title}');
      assert.equal(runtime.root.text, '{Binding Path=Title}');
    }

    if (fileName === 'object-content.xaml') {
      assert.equal(runtime.root.attributes.Content, undefined);
      assert.equal(runtime.root.children.length, 1);
      assert.equal(runtime.root.children[0].attributes.Text, 'Runtime title');
      assert.equal(runtime.root.children[0].text, 'Runtime title');
    }
  }

  return files.length;
}

async function runPhase8ResourceFixtures() {
  const expectations = {
    'runtime-resource-dictionary.xaml': { errors: [], warnings: [] },
    'scoped-resource-dictionary.xaml': { errors: [], warnings: [] },
    'missing-static-resource.xaml': { errors: [], warnings: [] },
    'resource-dictionary-missing-key.xaml': { errors: ['missing-dictionary-key'], warnings: [] },
    'resource-dictionary-duplicate-key.xaml': { errors: ['duplicate-dictionary-key'], warnings: [] },
    'resource-dictionary-invalid-item.xaml': { errors: ['invalid-collection-item-type'], warnings: [] }
  };

  const files = await listFixtureFiles('phase8-resources');

  for (const fileName of files) {
    const input = await readFixture('phase8-resources', fileName);
    const result = parseAndValidateXaml(input);
    const expected = expectations[fileName];
    assert.ok(expected, `Missing resource expectation for ${fileName}`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), expected.errors, `${fileName} validation errors`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'warning'), expected.warnings, `${fileName} validation warnings`);

    if (fileName === 'missing-static-resource.xaml') {
      assert.throws(
        () => parseRuntimeXaml(input),
        /StaticResource "Missing" could not be resolved/,
        `${fileName} runtime resource lookup`
      );
      continue;
    }

    if (expected.errors.length > 0) {
      continue;
    }

    const preserved = lowerXamlDocument(result.document);
    const runtime = parseRuntimeXaml(input);

    if (fileName === 'runtime-resource-dictionary.xaml') {
      assert.equal(preserved.root.children[0]?.type, 'Resources');
      assert.equal(preserved.root.children[0]?.children[0]?.type, 'ResourceDictionary');
      assert.equal(preserved.root.children[1]?.attributes.Text, '{StaticResource HeroTitle}');
      assert.equal(runtime.root.children.length, 1);
      assert.equal(runtime.root.children[0]?.attributes.Text, 'Resource title');
      assert.equal(runtime.root.children[0]?.attributes.Foreground, '#67c7ff');
      assert.equal(runtime.root.children[0]?.attributes.FontSize, 24);
    }

    if (fileName === 'scoped-resource-dictionary.xaml') {
      assert.equal(runtime.root.children.length, 2);
      assert.equal(runtime.root.children[0]?.attributes.Foreground, '#111111');
      assert.equal(runtime.root.children[1]?.children[0]?.attributes.Foreground, '#222222');
    }
  }

  return files.length;
}

async function runPhase9SerializerFixtures() {
  const files = await listFixtureFiles('phase9-serializer');

  for (const fileName of files) {
    const input = await readFixture('phase9-serializer', fileName);
    const result = parseAndValidateXaml(input);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), [], `${fileName} validation errors`);
    assert.ok(result.document, `${fileName} should produce a document`);

    const serialized = serializeXamlDocumentNode(result.document);
    const reparsed = parseAndValidateXaml(serialized);
    assert.deepEqual(diagnosticsWithSeverity(reparsed.validation, 'error'), [], `${fileName} round-trip validation errors`);
    assert.ok(reparsed.document, `${fileName} should round-trip to a document`);
    assert.deepEqual(lowerXamlDocument(reparsed.document), lowerXamlDocument(result.document), `${fileName} lowered round-trip`);

    if (fileName === 'namespaces-directives.xaml') {
      assert.match(serialized, /xmlns:ui="https:\/\/liquidboy\.dev\/ui-designer"/);
      assert.match(serialized, /xmlns:x="http:\/\/schemas\.microsoft\.com\/winfx\/2006\/xaml"/);
      assert.match(serialized, /x:Name="RootCanvas"/);
      assert.match(serialized, /xml:space="preserve"/);
    }

    if (fileName === 'markup-extensions.xaml') {
      assert.match(serialized, /Text="\{Binding Path=Title\}"/);
      assert.match(serialized, /<TextBlock\.Foreground>\{StaticResource Accent\}<\/TextBlock\.Foreground>/);
      assert.match(serialized, /<Button\.Content>\{x:Null\}<\/Button\.Content>/);
      assert.match(serialized, /Text="\{\}\{Binding Path=Literal\}"/);
      assert.match(serialized, /<TextBlock>\{Literal content\}<\/TextBlock>/);
    }

    if (fileName === 'collections-resources.xaml') {
      assert.match(serialized, /<Canvas\.Resources>/);
      assert.match(serialized, /<ResourceDictionary>/);
      assert.match(serialized, /<Color x:Key="Accent">#67c7ff<\/Color>/);
      assert.match(serialized, /Foreground="\{StaticResource Accent\}"/);
    }
  }

  return files.length;
}

async function runPhase10DesignerSerializerFixtures() {
  const input = await readFixture('phase9-serializer', 'namespaces-directives.xaml');
  const parsed = parseDesignerDocumentWithDiagnostics(input);
  assert.deepEqual(diagnosticsWithSeverity(parsed, 'error'), [], 'designer parse should not produce errors');
  assert.ok(parsed.document, 'designer parse should produce a document');

  const semanticSerialized = serializeDesignerDocument(parsed.document);
  assert.match(semanticSerialized, /<ui:Canvas/);
  assert.match(semanticSerialized, /xmlns:ui="https:\/\/liquidboy\.dev\/ui-designer"/);
  assert.match(semanticSerialized, /x:Name="RootCanvas"/);
  assert.match(semanticSerialized, /xml:space="preserve"/);
  assert.match(semanticSerialized, /Width="320"/);

  const edited = updateDocumentNodeAttributes(parsed.document, 'root.0', { Width: 480 });
  const editedSerialized = serializeDesignerDocument(edited);
  assert.match(editedSerialized, /<ui:Canvas/);
  assert.match(editedSerialized, /Width="480"/);
  assert.doesNotMatch(editedSerialized, /Width="320"/);
  assert.match(editedSerialized, /x:Name="RootCanvas"/);
  assert.match(serializeDesignerDocument(parsed.document), /Width="320"/);

  const childEdited = updateDocumentNodeAttributes(edited, 'root.0.0', { Text: 'Updated title' });
  const childEditedSerialized = serializeDesignerDocument(childEdited);
  assert.match(childEditedSerialized, /<ui:TextBlock/);
  assert.match(childEditedSerialized, /Text="Updated title"/);
  assert.match(childEditedSerialized, /x:Name="TitleText"/);

  const inserted = insertDocumentChild(childEdited, 'root.0', {
    type: 'Rectangle',
    attributes: {
      Width: 44,
      Height: 22,
      Fill: '#123456'
    },
    children: []
  }, 1);
  const insertedSerialized = serializeDesignerDocument(inserted);
  assert.match(insertedSerialized, /<ui:Rectangle Width="44" Height="22" Fill="#123456" \/>/);
  assert.deepEqual(
    diagnosticsWithSeverity(parseAndValidateXaml(insertedSerialized).validation, 'error'),
    [],
    'inserted designer semantic document should validate'
  );

  const removed = removeDocumentNode(inserted, 'root.0.0');
  const removedSerialized = serializeDesignerDocument(removed);
  assert.doesNotMatch(removedSerialized, /TitleText/);
  assert.match(removedSerialized, /<ui:Rectangle Width="44" Height="22" Fill="#123456" \/>/);

  const moveInput = [
    '<ui:Canvas xmlns:ui="https://liquidboy.dev/ui-designer">',
    '  <ui:TextBlock Text="First" />',
    '  <ui:Rectangle Fill="#111111" />',
    '</ui:Canvas>'
  ].join('\n');
  const moveParsed = parseDesignerDocumentWithDiagnostics(moveInput);
  assert.ok(moveParsed.document, 'move fixture should produce a document');
  const moved = moveDocumentNode(moveParsed.document, 'root.0.0', 'root.0', 2);
  assert.ok(moved, 'move should produce a document');
  assert.equal(moved.movedId, 'root.0.1');
  const movedSerialized = serializeDesignerDocument(moved.document);
  assert.ok(
    movedSerialized.indexOf('<ui:Rectangle') < movedSerialized.indexOf('<ui:TextBlock'),
    'moved designer semantic document should preserve reordered child objects'
  );

  const markupInput = await readFixture('phase9-serializer', 'markup-extensions.xaml');
  const markupParsed = parseDesignerDocumentWithDiagnostics(markupInput);
  assert.ok(markupParsed.document, 'markup fixture should produce a document');
  const propertyElementEdited = updateDocumentNodeAttributes(markupParsed.document, 'root.0.0', {
    Foreground: '#ffffff'
  });
  const propertyElementEditedSerialized = serializeDesignerDocument(propertyElementEdited);
  assert.match(propertyElementEditedSerialized, /Text="\{Binding Path=Title\}"/);
  assert.match(propertyElementEditedSerialized, /<TextBlock\.Foreground>#ffffff<\/TextBlock\.Foreground>/);

  const resourceInput = await readFixture('phase9-serializer', 'collections-resources.xaml');
  const resourceParsed = parseDesignerDocumentWithDiagnostics(resourceInput);
  assert.ok(resourceParsed.document, 'resource fixture should produce a document');
  const resourceEdited = updateDocumentNodeAttributes(resourceParsed.document, 'root.0.1', { Width: 360 });
  const resourceEditedSerialized = serializeDesignerDocument(resourceEdited);
  assert.match(resourceEditedSerialized, /<Canvas\.Resources>/);
  assert.match(resourceEditedSerialized, /<StackPanel Width="360">/);

  return 6;
}

async function runPhase11XmlScopeFixtures() {
  const files = await listFixtureFiles('phase11-xml-scope');

  for (const fileName of files) {
    const input = await readFixture('phase11-xml-scope', fileName);
    const parsed = parseXamlToInfoset(input);
    assert.deepEqual(diagnosticsWithSeverity(parsed, 'error'), [], `${fileName} parse errors`);
    assert.ok(parsed.document?.root, `${fileName} should produce a root object`);

    const validated = parseAndValidateXaml(input);
    assert.deepEqual(diagnosticsWithSeverity(validated.validation, 'error'), [], `${fileName} validation errors`);
    const lowered = lowerXamlDocument(validated.document);
    const root = parsed.document.root;

    if (fileName === 'xml-space-preserve.xaml') {
      const content = findMember(root, 'Content', 'content');
      assert.equal(root.preservesXmlSpace, true);
      assert.equal(content?.values[0]?.kind, 'text');
      assert.equal(content.values[0].text, '   ');
      assert.equal(content.values[0].preservesXmlSpace, true);
      assert.equal(lowered.root.attributes.Text, '   ');
      assert.equal(lowered.root.text, '   ');
      assert.match(serializeXamlDocumentNode(parsed.document), /xml:space="preserve">   <\/TextBlock>/);
    }

    if (fileName === 'xml-space-default.xaml') {
      const stackPanelContent = findMember(root, 'Content', 'content');
      const textBlock = stackPanelContent?.values[0];
      assert.equal(root.preservesXmlSpace, true);
      assert.equal(textBlock?.kind, 'object');
      assert.equal(textBlock.preservesXmlSpace, undefined);
      assert.equal(findMember(textBlock, 'Content', 'content'), undefined);
      assert.equal(lowered.root.children[0]?.attributes.Text, undefined);
      assert.equal(lowered.root.children[0]?.text, undefined);
    }

    if (fileName === 'xml-lang-inheritance.xaml') {
      const stackPanel = findMember(root, 'Content', 'content')?.values[0];
      const textBlock = stackPanel?.kind === 'object'
        ? findMember(stackPanel, 'Content', 'content')?.values[0]
        : undefined;
      assert.equal(root.xmlLang, 'en-US');
      assert.equal(stackPanel?.kind, 'object');
      assert.equal(stackPanel.xmlLang, 'en-US');
      assert.equal(textBlock?.kind, 'object');
      assert.equal(textBlock.xmlLang, 'en-US');
      assert.equal(lowered.root.attributes.lang, 'en-US');
      assert.equal(lowered.root.children[0]?.attributes.lang, 'en-US');
      assert.equal(lowered.root.children[0]?.children[0]?.attributes.lang, 'en-US');
    }
  }

  return files.length;
}

async function runPhase12ObjectResourceFixtures() {
  const files = await listFixtureFiles('phase12-object-resources');

  for (const fileName of files) {
    const input = await readFixture('phase12-object-resources', fileName);
    const result = parseAndValidateXaml(input);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), [], `${fileName} validation errors`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'warning'), [], `${fileName} validation warnings`);

    const preserved = lowerXamlDocument(result.document);
    const runtime = parseRuntimeXaml(input);
    assert.equal(preserved.root.children[0]?.type, 'Resources', `${fileName} should preserve resources while authoring`);

    if (fileName === 'runtime-object-resource.xaml') {
      assert.equal(runtime.root.children.length, 1);
      assert.equal(runtime.root.children[0]?.type, 'Border');
      assert.equal(runtime.root.children[0]?.children[0]?.type, 'TextBlock');
      assert.equal(runtime.root.children[0]?.children[0]?.attributes.Text, 'Reusable label');
      assert.equal(runtime.root.children[0]?.children[0]?.attributes.Foreground, '#67c7ff');
      assert.equal(runtime.root.children[0]?.children[0]?.attributes.Key, undefined);
    }

    if (fileName === 'scoped-object-resource.xaml') {
      assert.equal(runtime.root.children.length, 2);
      assert.equal(runtime.root.children[0]?.children[0]?.type, 'Button');
      assert.equal(runtime.root.children[0]?.children[0]?.attributes.Content, 'Outer action');
      assert.equal(runtime.root.children[1]?.children[0]?.type, 'Button');
      assert.equal(runtime.root.children[1]?.children[0]?.attributes.Content, 'Inner action');
    }

    if (fileName === 'object-resource-with-primitive-dependency.xaml') {
      assert.equal(runtime.root.children[0]?.children[0]?.type, 'TextBlock');
      assert.equal(runtime.root.children[0]?.children[0]?.attributes.Text, 'Accent label');
      assert.equal(runtime.root.children[0]?.children[0]?.attributes.Foreground, '#ff8157');
    }
  }

  return files.length;
}

async function runPhase13DynamicResourceFixtures() {
  const files = await listFixtureFiles('phase13-dynamic-resources');

  for (const fileName of files) {
    const input = await readFixture('phase13-dynamic-resources', fileName);
    const result = parseAndValidateXaml(input);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), [], `${fileName} validation errors`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'warning'), [], `${fileName} validation warnings`);

    if (fileName === 'missing-dynamic-resource.xaml') {
      assert.throws(
        () => parseRuntimeXaml(input),
        /DynamicResource "Missing" could not be resolved/,
        `${fileName} runtime dynamic resource lookup`
      );
      continue;
    }

    const runtime = parseRuntimeXaml(input);

    if (fileName === 'dynamic-resource-primitive.xaml') {
      assert.equal(runtime.root.children[0]?.children[0]?.attributes.Foreground, '#111111');
      assert.equal(runtime.root.children[0]?.children[1]?.attributes.Foreground, '#222222');

      const updated = parseRuntimeXaml(input, {}, undefined, {
        dynamicResources: {
          Accent: '#ff0000',
          StaticAccent: '#00ff00'
        }
      });
      assert.equal(updated.root.children[0]?.children[0]?.attributes.Foreground, '#ff0000');
      assert.equal(updated.root.children[0]?.children[1]?.attributes.Foreground, '#222222');
    }

    if (fileName === 'dynamic-resource-object.xaml') {
      assert.equal(runtime.root.children[0]?.children[0]?.attributes.Text, 'Original label');

      const updated = parseRuntimeXaml(input, {}, undefined, {
        dynamicResources: {
          SharedLabel: {
            type: 'TextBlock',
            attributes: {
              Text: 'Updated label',
              Foreground: '#ff8157'
            },
            children: []
          }
        }
      });
      assert.equal(updated.root.children[0]?.children[0]?.type, 'TextBlock');
      assert.equal(updated.root.children[0]?.children[0]?.attributes.Text, 'Updated label');
      assert.equal(updated.root.children[0]?.children[0]?.attributes.Foreground, '#ff8157');
    }
  }

  return files.length;
}

async function runPhase14WhitespaceNormalizationFixtures() {
  const files = await listFixtureFiles('phase14-whitespace-normalization');

  for (const fileName of files) {
    const input = await readFixture('phase14-whitespace-normalization', fileName);
    const result = parseAndValidateXaml(input);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), [], `${fileName} validation errors`);

    const lowered = lowerXamlDocument(result.document);

    if (fileName === 'text-content-collapse.xaml') {
      assert.equal(lowered.root.attributes.Text, 'Hello XAML World');
      assert.equal(lowered.root.text, 'Hello XAML World');
      assert.match(serializeXamlDocumentNode(result.document), /\n    XAML\tWorld\n/);
    }

    if (fileName === 'property-element-collapse.xaml') {
      assert.equal(lowered.root.attributes.Text, 'Hello property world');
      assert.equal(lowered.root.text, 'Hello property world');
    }

    if (fileName === 'xml-space-preserve-text.xaml') {
      assert.equal(lowered.root.attributes.Text, '\n  Hello\n    preserved\tworld\n');
      assert.equal(lowered.root.text, '\n  Hello\n    preserved\tworld\n');
    }

    if (fileName === 'xml-space-default-collapse.xaml') {
      assert.equal(lowered.root.children[0]?.attributes.Text, 'Hello default world');
      assert.equal(lowered.root.children[0]?.text, 'Hello default world');
    }
  }

  return files.length;
}

async function runPhase15IntrinsicArrayFixtures() {
  const expectations = {
    'array-content.xaml': { errors: [], warnings: [] },
    'array-items-property.xaml': { errors: [], warnings: [] },
    'array-invalid-item.xaml': { errors: ['invalid-array-item-type'], warnings: [] },
    'array-missing-type.xaml': { errors: ['missing-required-member'], warnings: [] },
    'array-type-extension.xaml': { errors: [], warnings: [] },
    'array-type-extension-missing.xaml': { errors: ['missing-markup-extension-argument'], warnings: [] }
  };
  const files = await listFixtureFiles('phase15-intrinsic-array');

  for (const fileName of files) {
    const input = await readFixture('phase15-intrinsic-array', fileName);
    const result = parseAndValidateXaml(input);
    const expected = expectations[fileName];
    assert.ok(expected, `Missing intrinsic array expectation for ${fileName}`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), expected.errors, `${fileName} validation errors`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'warning'), expected.warnings, `${fileName} validation warnings`);

    if (expected.errors.length > 0) {
      continue;
    }

    assert.equal(result.document.root.type.localName, 'Array');
    assert.equal(result.document.root.type.namespaceUri, XAML_LANGUAGE_NAMESPACE);

    const lowered = lowerXamlDocument(result.document);
    assert.equal(lowered.root.type, 'Array');

    if (fileName === 'array-content.xaml') {
      assert.equal(lowered.root.attributes.Type, 'TextBlock');
      assert.equal(lowered.root.children.length, 2);
      assert.equal(lowered.root.children[0]?.type, 'TextBlock');
      assert.equal(lowered.root.children[0]?.attributes.Text, 'First');
      assert.match(serializeXamlDocumentNode(result.document), /<x:Array/);
    }

    if (fileName === 'array-items-property.xaml') {
      const itemsMember = findDottedMember(result.document.root, 'Items', 'propertyElement');
      assert.equal(itemsMember?.isDirective, false);
      assert.equal(lowered.root.attributes.Type, 'ui:Button');
      assert.equal(lowered.root.children.length, 1);
      assert.equal(lowered.root.children[0]?.type, 'Button');
      assert.equal(lowered.root.children[0]?.attributes.Content, 'One');
    }

    if (fileName === 'array-type-extension.xaml') {
      const runtime = parseRuntimeXaml(input);
      assert.equal(lowered.root.attributes.Type, '{x:Type TextBlock}');
      assert.equal(runtime.root.attributes.Type, 'TextBlock');
      assert.equal(runtime.root.children[0]?.type, 'TextBlock');
      assert.match(serializeXamlDocumentNode(result.document), /Type="\{x:Type TextBlock\}"/);
    }
  }

  return files.length;
}

async function runPhase6CollectionFixtures() {
  const expectations = {
    'theme-dictionary-xkey.xaml': { errors: [], warnings: [] },
    'theme-dictionary-duplicate-key.xaml': { errors: ['duplicate-dictionary-key'], warnings: [] },
    'theme-dictionary-missing-key.xaml': { errors: ['missing-dictionary-key'], warnings: [] },
    'theme-dictionary-invalid-item.xaml': { errors: ['invalid-collection-item-type'], warnings: [] },
    'list-invalid-item.xaml': { errors: ['invalid-collection-item-type'], warnings: [] },
    'xkey-outside-dictionary.xaml': { errors: ['invalid-directive-placement'], warnings: [] }
  };

  const files = await listFixtureFiles('phase6-collections');

  for (const fileName of files) {
    const input = await readFixture('phase6-collections', fileName);
    const result = parseAndValidateXaml(input);
    const expected = expectations[fileName];
    assert.ok(expected, `Missing collection expectation for ${fileName}`);
    assert.deepEqual(diagnosticsWithSeverity(result.validation, 'error'), expected.errors, `${fileName} error diagnostics`);
    assert.deepEqual(
      diagnosticsWithSeverity(result.validation, 'warning'),
      expected.warnings,
      `${fileName} warning diagnostics`
    );

    if (expected.errors.length > 0) {
      continue;
    }

    const lowered = lowerXamlDocument(result.document);
    assert.equal(lowered.root.type, 'DesignerTheme');
    const colors = lowered.root.children[0];
    assert.equal(colors?.type, 'Colors');
    assert.equal(colors.children[0]?.attributes.Key, 'app-bg');
    assert.equal(colors.children[1]?.attributes.Id, 'text-primary');
  }

  return files.length;
}

const phase1Count = await runPhase1Fixtures();
const phase2Count = await runPhase2ValidationFixtures();
const phase3Count = await runPhase3LoweringFixtures();
const phase4Count = await runPhase4DesignerConfigFixtures();
const phase5Count = await runPhase5MarkupExtensionFixtures();
const phase6Count = await runPhase6CollectionFixtures();
const phase7Count = await runPhase7RuntimeExtensionFixtures();
const phase8Count = await runPhase8ResourceFixtures();
const phase9Count = await runPhase9SerializerFixtures();
const phase10Count = await runPhase10DesignerSerializerFixtures();
const phase11Count = await runPhase11XmlScopeFixtures();
const phase12Count = await runPhase12ObjectResourceFixtures();
const phase13Count = await runPhase13DynamicResourceFixtures();
const phase14Count = await runPhase14WhitespaceNormalizationFixtures();
const phase15Count = await runPhase15IntrinsicArrayFixtures();

console.log(
  `XAML fixture tests passed (${phase1Count} parser, ${phase2Count} validation, ${phase3Count} lowering, ${phase4Count} designer config, ${phase5Count} markup extension, ${phase6Count} collections, ${phase7Count} runtime extensions, ${phase8Count} resources, ${phase9Count} serializer, ${phase10Count} designer serializer, ${phase11Count} XML scope, ${phase12Count} object resources, ${phase13Count} dynamic resources, ${phase14Count} whitespace normalization, ${phase15Count} intrinsic arrays).`
);
