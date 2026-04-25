import { parseXaml } from '@ui-designer/xaml-parser';
import type { XamlNode } from '@ui-designer/xaml-schema';
import defaultDesignerChromeXaml from './DesignerChrome.xaml';

export const DEFAULT_DESIGNER_CHROME_XAML = defaultDesignerChromeXaml.trim();

export interface DesignerChromeItem {
  id: string;
  label: string;
  labelBinding?: string;
  valueBinding?: string;
  isActive: boolean;
}

export interface DesignerChromeTool extends DesignerChromeItem {
  glyph: string;
}

export interface DesignerChromeDefinition {
  source: string;
  menuItems: DesignerChromeItem[];
  commandItems: DesignerChromeItem[];
  leftDockTabs: DesignerChromeItem[];
  inspectorTabs: DesignerChromeItem[];
  documentTabs: DesignerChromeItem[];
  toolStrip: DesignerChromeTool[];
  sourceTabs: DesignerChromeItem[];
  statusSegments: DesignerChromeItem[];
}

export interface DesignerChromeParseResult {
  definition: DesignerChromeDefinition | null;
  diagnostic: {
    severity: 'error' | 'warning';
    message: string;
  } | null;
}

function readString(node: XamlNode, key: string): string {
  const value = node.attributes[key];
  return typeof value === 'string' ? value : '';
}

function readBoolean(node: XamlNode, key: string): boolean {
  return node.attributes[key] === true || readString(node, key).toLowerCase() === 'true';
}

function nodeToItem(node: XamlNode): DesignerChromeItem {
  const id = readString(node, 'Id') || readString(node, 'Label') || node.type;

  return {
    id,
    label: readString(node, 'Label'),
    labelBinding: readString(node, 'LabelBinding') || undefined,
    valueBinding: readString(node, 'ValueBinding') || undefined,
    isActive: readBoolean(node, 'Active')
  };
}

function nodeToTool(node: XamlNode): DesignerChromeTool {
  return {
    ...nodeToItem(node),
    glyph: readString(node, 'Glyph') || readString(node, 'Label').slice(0, 1)
  };
}

function firstChild(root: XamlNode, type: string): XamlNode | null {
  return root.children.find((child) => child.type === type) ?? null;
}

function childrenOf(root: XamlNode, type: string): XamlNode[] {
  return firstChild(root, type)?.children ?? [];
}

function dockTabs(root: XamlNode, slot: string): DesignerChromeItem[] {
  const dock = root.children.find((child) => child.type === 'DockTabs' && readString(child, 'Slot') === slot);
  return dock ? dock.children.map(nodeToItem) : [];
}

function invalidDefinition(message: string): DesignerChromeParseResult {
  return {
    definition: null,
    diagnostic: {
      severity: 'error',
      message
    }
  };
}

export function parseDesignerChromeDefinition(source: string): DesignerChromeParseResult {
  try {
    const document = parseXaml(source);
    const root = document.root;

    if (root.type !== 'DesignerChrome') {
      return invalidDefinition(`Expected DesignerChrome root element, received ${root.type}.`);
    }

    return {
      definition: {
        source,
        menuItems: childrenOf(root, 'TopMenu').map(nodeToItem),
        commandItems: childrenOf(root, 'CommandBar').map(nodeToItem),
        leftDockTabs: dockTabs(root, 'left'),
        inspectorTabs: dockTabs(root, 'inspector'),
        documentTabs: childrenOf(root, 'DocumentTabs').map(nodeToItem),
        toolStrip: childrenOf(root, 'ToolStrip').map(nodeToTool),
        sourceTabs: childrenOf(root, 'SourceTabs').map(nodeToItem),
        statusSegments: childrenOf(root, 'StatusBar').map(nodeToItem)
      },
      diagnostic: null
    };
  } catch (error: unknown) {
    return {
      definition: null,
      diagnostic: {
        severity: 'error',
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

const defaultChromeParseResult = parseDesignerChromeDefinition(DEFAULT_DESIGNER_CHROME_XAML);

if (!defaultChromeParseResult.definition) {
  throw new Error(defaultChromeParseResult.diagnostic?.message ?? 'Invalid default designer chrome XAML.');
}

export const designerChromeDefinition = defaultChromeParseResult.definition;
