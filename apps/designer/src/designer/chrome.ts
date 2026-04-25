import { parseXaml } from '@ui-designer/xaml-parser';
import type { XamlNode } from '@ui-designer/xaml-schema';

const designerChromeXaml = `
<DesignerChrome xmlns="https://liquidboy.dev/ui-designer/designer-chrome">
  <TopMenu>
    <MenuItem Id="file" Label="File" />
    <MenuItem Id="edit" Label="Edit" />
    <MenuItem Id="view" Label="View" />
    <MenuItem Id="object" Label="Object" />
    <MenuItem Id="project" Label="Project" />
    <MenuItem Id="tools" Label="Tools" />
    <MenuItem Id="window" Label="Window" />
    <MenuItem Id="help" Label="Help" />
  </TopMenu>
  <CommandBar>
    <Command Id="undo" Label="Undo" />
    <Command Id="redo" Label="Redo" />
    <Command Id="import" Label="Import" />
    <Command Id="export" Label="Export" />
  </CommandBar>
  <DockTabs Slot="left">
    <DockTab Id="project" Label="Project" Active="true" />
    <DockTab Id="assets" Label="Assets" />
    <DockTab Id="states" Label="States" />
  </DockTabs>
  <DockTabs Slot="inspector">
    <DockTab Id="properties" Label="Properties" Active="true" />
    <DockTab Id="resources" Label="Resources" />
    <DockTab Id="data" Label="Data" />
  </DockTabs>
  <DocumentTabs>
    <DocumentTab Id="document" LabelBinding="documentFileName" Active="true" />
    <DocumentTab Id="resources" Label="Resources.xaml" />
  </DocumentTabs>
  <ToolStrip>
    <Tool Id="selection" Label="Selection" Glyph="V" Active="true" />
    <Tool Id="pan" Label="Pan" Glyph="H" />
    <Tool Id="zoom" Label="Zoom" Glyph="Z" />
    <Tool Id="pen" Label="Pen" Glyph="P" />
    <Tool Id="text" Label="Text" Glyph="T" />
    <Tool Id="rectangle" Label="Rectangle" Glyph="R" />
    <Tool Id="image" Label="Image" Glyph="I" />
    <Tool Id="grid" Label="Grid" Glyph="G" />
  </ToolStrip>
  <SourceTabs>
    <SourceTab Id="xaml" Label="XAML" Active="true" />
    <SourceTab Id="design" Label="Design" />
  </SourceTabs>
  <StatusBar>
    <StatusSegment Id="status" ValueBinding="status" />
    <StatusSegment Id="zoom" Label="Zoom" ValueBinding="zoom" />
    <StatusSegment Id="snap" Label="Snap" ValueBinding="snap" />
    <StatusSegment Id="selection" Label="Selection" ValueBinding="selection" />
  </StatusBar>
</DesignerChrome>
`.trim();

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

function createDesignerChromeDefinition(): DesignerChromeDefinition {
  const document = parseXaml(designerChromeXaml);
  const root = document.root;

  return {
    source: designerChromeXaml,
    menuItems: childrenOf(root, 'TopMenu').map(nodeToItem),
    commandItems: childrenOf(root, 'CommandBar').map(nodeToItem),
    leftDockTabs: dockTabs(root, 'left'),
    inspectorTabs: dockTabs(root, 'inspector'),
    documentTabs: childrenOf(root, 'DocumentTabs').map(nodeToItem),
    toolStrip: childrenOf(root, 'ToolStrip').map(nodeToTool),
    sourceTabs: childrenOf(root, 'SourceTabs').map(nodeToItem),
    statusSegments: childrenOf(root, 'StatusBar').map(nodeToItem)
  };
}

export const designerChromeDefinition = createDesignerChromeDefinition();
