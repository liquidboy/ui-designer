import { parseLegacyXaml } from '@ui-designer/xaml-parser';
import type { XamlNode } from '@ui-designer/xaml-schema';
import defaultDesignerPanelsXaml from './DesignerPanels.xaml';

export const DEFAULT_DESIGNER_PANELS_XAML = defaultDesignerPanelsXaml.trim();

export type DesignerPanelId = 'solution' | 'palette' | 'tree' | 'assets' | 'fonts' | 'visualStates' | 'overlays';
export type DesignerInspectorGroupId = 'element' | 'image' | 'typography';

export interface DesignerPanelText {
  id: string;
  title: string;
  caption: string;
  dockTabId?: string;
}

export interface DesignerPanelsDefinition {
  source: string;
  panels: Record<DesignerPanelId, DesignerPanelText>;
  inspectorGroups: Record<DesignerInspectorGroupId, DesignerPanelText>;
}

export interface DesignerPanelsParseResult {
  definition: DesignerPanelsDefinition | null;
  diagnostic: {
    severity: 'error' | 'warning';
    message: string;
  } | null;
}

const DEFAULT_PANEL_TEXTS: Record<DesignerPanelId, DesignerPanelText> = {
  solution: {
    id: 'solution',
    title: 'Solution Explorer',
    caption: '',
    dockTabId: 'project'
  },
  palette: {
    id: 'palette',
    title: 'Palette',
    caption: 'Pick a template, then insert it as a child or sibling. Placement adapts automatically for Canvas and Grid containers.',
    dockTabId: 'project'
  },
  tree: {
    id: 'tree',
    title: 'Component Tree',
    caption: '',
    dockTabId: 'project'
  },
  assets: {
    id: 'assets',
    title: 'Asset Library',
    caption: 'Import real images, select a library entry, then apply it directly to the current image or insert it as a new component.',
    dockTabId: 'assets'
  },
  fonts: {
    id: 'fonts',
    title: 'Font Library',
    caption: 'Import real font files or apply preset families. Imported fonts embed their FontSource into XAML when you apply them.',
    dockTabId: 'assets'
  },
  visualStates: {
    id: 'visualStates',
    title: 'Visual States',
    caption: 'Select a state for the current component, then record targeted changes as the state authoring model grows.',
    dockTabId: 'states'
  },
  overlays: {
    id: 'overlays',
    title: 'Debug Overlays',
    caption: 'Keep structure visible while editing text, images, and container layouts.',
    dockTabId: 'states'
  }
};

const DEFAULT_INSPECTOR_GROUP_TEXTS: Record<DesignerInspectorGroupId, DesignerPanelText> = {
  element: {
    id: 'element',
    title: 'Element',
    caption: ''
  },
  image: {
    id: 'image',
    title: 'Image',
    caption: ''
  },
  typography: {
    id: 'typography',
    title: 'Typography',
    caption: ''
  }
};

function readString(node: XamlNode, key: string): string {
  const value = node.attributes[key];
  return typeof value === 'string' ? value : '';
}

function cloneTextMap<TId extends string>(textMap: Record<TId, DesignerPanelText>): Record<TId, DesignerPanelText> {
  const clone = {} as Record<TId, DesignerPanelText>;
  for (const id of Object.keys(textMap) as TId[]) {
    clone[id] = { ...textMap[id] };
  }
  return clone;
}

function firstChild(root: XamlNode, type: string): XamlNode | null {
  return root.children.find((child) => child.type === type) ?? null;
}

function applyKnownText<TId extends string>(
  target: Record<TId, DesignerPanelText>,
  nodes: readonly XamlNode[]
): void {
  for (const node of nodes) {
    const id = readString(node, 'Id') as TId;
    if (!(id in target)) {
      continue;
    }

    const title = readString(node, 'Title');
    const caption = readString(node, 'Caption');
    target[id] = {
      id,
      title: title || target[id].title,
      caption: caption || target[id].caption,
      dockTabId: readString(node, 'DockTab') || target[id].dockTabId
    };
  }
}

function invalidDefinition(message: string): DesignerPanelsParseResult {
  return {
    definition: null,
    diagnostic: {
      severity: 'error',
      message
    }
  };
}

export function parseDesignerPanelsDefinition(source: string): DesignerPanelsParseResult {
  try {
    const document = parseLegacyXaml(source);
    const root = document.root;

    if (root.type !== 'DesignerPanels') {
      return invalidDefinition(`Expected DesignerPanels root element, received ${root.type}.`);
    }

    const panels = cloneTextMap(DEFAULT_PANEL_TEXTS);
    const inspectorGroups = cloneTextMap(DEFAULT_INSPECTOR_GROUP_TEXTS);

    applyKnownText(panels, firstChild(root, 'LeftRail')?.children ?? []);
    applyKnownText(inspectorGroups, firstChild(root, 'InspectorGroups')?.children ?? []);

    return {
      definition: {
        source,
        panels,
        inspectorGroups
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

const defaultPanelsParseResult = parseDesignerPanelsDefinition(DEFAULT_DESIGNER_PANELS_XAML);

if (!defaultPanelsParseResult.definition) {
  throw new Error(defaultPanelsParseResult.diagnostic?.message ?? 'Invalid default designer panels XAML.');
}

export const designerPanelsDefinition = defaultPanelsParseResult.definition;
