import { parseStrictXaml } from '@ui-designer/xaml-parser';
import type { XamlNode } from '@ui-designer/xaml-schema';
import defaultDesignerThemeXaml from './DesignerTheme.xaml';

export const DEFAULT_DESIGNER_THEME_XAML = defaultDesignerThemeXaml.trim();

export type DesignerThemeTokenId =
  | 'app-bg'
  | 'shell-bg'
  | 'workspace-bg'
  | 'chrome-bg'
  | 'chrome-muted-bg'
  | 'panel-bg'
  | 'panel-section-bg'
  | 'panel-header-bg'
  | 'card-bg'
  | 'card-hover-bg'
  | 'editor-bg'
  | 'editor-footer-bg'
  | 'input-bg'
  | 'border-strong'
  | 'border-subtle'
  | 'text-primary'
  | 'text-bright'
  | 'text-muted'
  | 'accent'
  | 'accent-line'
  | 'accent-soft'
  | 'error'
  | 'warning';

export interface DesignerThemeDefinition {
  source: string;
  tokens: Record<DesignerThemeTokenId, string>;
}

export interface DesignerThemeParseResult {
  definition: DesignerThemeDefinition | null;
  diagnostic: {
    severity: 'error' | 'warning';
    message: string;
  } | null;
}

export const DEFAULT_DESIGNER_THEME_TOKENS: Record<DesignerThemeTokenId, string> = {
  'app-bg': '#1f1f23',
  'shell-bg': '#1c1c20',
  'workspace-bg': '#18181c',
  'chrome-bg': '#2a2a2f',
  'chrome-muted-bg': '#232328',
  'panel-bg': '#252529',
  'panel-section-bg': '#242428',
  'panel-header-bg': '#2b2b31',
  'card-bg': '#2b2b30',
  'card-hover-bg': '#303037',
  'editor-bg': '#18191d',
  'editor-footer-bg': '#24252a',
  'input-bg': '#1d1e23',
  'border-strong': '#111216',
  'border-subtle': '#303037',
  'text-primary': '#e6e6e6',
  'text-bright': '#ffffff',
  'text-muted': '#a7a7ae',
  accent: '#0877c8',
  'accent-line': '#159cdc',
  'accent-soft': '#1d6f9f',
  error: '#ff9b9b',
  warning: '#f0cd80'
};

function readString(node: XamlNode, key: string): string {
  const value = node.attributes[key];
  return typeof value === 'string' ? value : '';
}

function cloneThemeTokens(): Record<DesignerThemeTokenId, string> {
  return { ...DEFAULT_DESIGNER_THEME_TOKENS };
}

function firstChild(root: XamlNode, type: string): XamlNode | null {
  return root.children.find((child) => child.type === type) ?? null;
}

function invalidDefinition(message: string): DesignerThemeParseResult {
  return {
    definition: null,
    diagnostic: {
      severity: 'error',
      message
    }
  };
}

export function parseDesignerThemeDefinition(source: string): DesignerThemeParseResult {
  try {
    const document = parseStrictXaml(source);
    const root = document.root;

    if (root.type !== 'DesignerTheme') {
      return invalidDefinition(`Expected DesignerTheme root element, received ${root.type}.`);
    }

    const tokens = cloneThemeTokens();
    const colors = firstChild(root, 'Colors')?.children ?? [];

    for (const color of colors) {
      const id = readString(color, 'Id') as DesignerThemeTokenId;
      const value = readString(color, 'Value');
      if (id in tokens && value.trim()) {
        tokens[id] = value.trim();
      }
    }

    return {
      definition: {
        source,
        tokens
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

const defaultThemeParseResult = parseDesignerThemeDefinition(DEFAULT_DESIGNER_THEME_XAML);

if (!defaultThemeParseResult.definition) {
  throw new Error(defaultThemeParseResult.diagnostic?.message ?? 'Invalid default designer theme XAML.');
}

export const designerThemeDefinition = defaultThemeParseResult.definition;
