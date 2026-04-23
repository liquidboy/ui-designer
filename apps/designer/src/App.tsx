import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  CommandStack,
  buildDesignerTree,
  cloneXamlDocument,
  cloneXamlNode,
  createCameraState,
  findDocumentNodeById,
  insertDocumentChild,
  moveDocumentNode,
  parseDesignerDocument,
  removeDocumentNode,
  screenToWorld,
  serializeDesignerDocument,
  updateDocumentNodeAttributes,
  worldToScreen,
  type CameraState,
  type DesignerDocument,
  type DesignerCommand
} from '@ui-designer/designer-core';
import { RuntimeHost } from '@ui-designer/ui-runtime-web';
import type { ColorRgba, Point, UiElement } from '@ui-designer/ui-core';
import type { XamlNode } from '@ui-designer/xaml-schema';

const sampleXaml = `
<Canvas Width="1600" Height="1200">
  <Grid Rows="2" Columns="2" Width="980" Height="640" X="120" Y="80">
    <Border Grid.Row="0" Grid.Column="0" Background="#18222e" Padding="16">
      <StackPanel Spacing="12">
        <TextBlock Text="Inspector-Driven Design Surface" />
        <Button Content="Primary Action" />
      </StackPanel>
    </Border>
    <Rectangle Grid.Row="0" Grid.Column="1" Fill="#3472ff" />
    <Rectangle Grid.Row="1" Grid.Column="0" Fill="#ff8157" />
    <Rectangle Grid.Row="1" Grid.Column="1" Fill="#3fca9d" />
  </Grid>
</Canvas>
`;
const GRID_SIZE = 8;
const DRAFT_STORAGE_KEY = 'ui-designer:document-draft:v1';
const DEFAULT_NODE_COLORS = ['#3472ff', '#ff8157', '#3fca9d', '#ffd166', '#6fd3ff', '#b88cff'];
const DEFAULT_FILE_NAME = 'designer-document.xaml';

type TreeDropIntent = 'before' | 'inside' | 'after';

type PaletteTemplateId =
  | 'accent-rectangle'
  | 'text-label'
  | 'primary-button'
  | 'content-stack'
  | 'metric-card'
  | 'swatch-grid'
  | 'section-frame';

interface PaletteTemplate {
  id: PaletteTemplateId;
  title: string;
  description: string;
  accent: string;
  parentTypes?: readonly string[];
  build(index: number): XamlNode;
}

function xamlNode(
  type: string,
  attributes: Record<string, string | number | boolean>,
  children: XamlNode[] = []
): XamlNode {
  return {
    type,
    attributes,
    children
  };
}

const PALETTE_TEMPLATES: readonly PaletteTemplate[] = [
  {
    id: 'accent-rectangle',
    title: 'Accent Rectangle',
    description: 'Simple visual block for wireframes, artwork, or emphasis.',
    accent: '#3472ff',
    build: (index) =>
      xamlNode('Rectangle', {
        Width: 160,
        Height: 96,
        Fill: DEFAULT_NODE_COLORS[index % DEFAULT_NODE_COLORS.length]
      })
  },
  {
    id: 'text-label',
    title: 'Text Label',
    description: 'Single-line copy block for headings or supporting text.',
    accent: '#6fd3ff',
    build: (index) =>
      xamlNode('TextBlock', {
        Text: `Label ${index + 1}`
      })
  },
  {
    id: 'primary-button',
    title: 'Primary Button',
    description: 'Action button with a strong default size and call-to-action label.',
    accent: '#3fca9d',
    build: (index) =>
      xamlNode('Button', {
        Content: `Action ${index + 1}`,
        Width: 152,
        Height: 40
      })
  },
  {
    id: 'content-stack',
    title: 'Content Stack',
    description: 'Headline, supporting copy, and a primary action in a vertical rhythm.',
    accent: '#b88cff',
    build: (index) =>
      xamlNode(
        'StackPanel',
        {
          Width: 260,
          Spacing: 10,
          Background: '#18222e'
        },
        [
          xamlNode('TextBlock', { Text: `Section ${index + 1}` }),
          xamlNode('TextBlock', { Text: 'Concise supporting copy for the selected design block.' }),
          xamlNode('Button', { Content: 'Continue', Width: 148, Height: 40 })
        ]
      )
  },
  {
    id: 'metric-card',
    title: 'Metric Card',
    description: 'A bordered summary tile with a label and a large value.',
    accent: '#ff8157',
    build: (index) =>
      xamlNode(
        'Border',
        {
          Width: 240,
          Height: 132,
          Background: '#18222e',
          Padding: 16
        },
        [
          xamlNode('StackPanel', { Spacing: 10 }, [
            xamlNode('TextBlock', { Text: `Metric ${index + 1}` }),
            xamlNode('TextBlock', { Text: '128' })
          ])
        ]
      )
  },
  {
    id: 'swatch-grid',
    title: 'Swatch Grid',
    description: 'A compact 2x2 composition for testing nested layout and color systems.',
    accent: '#ffd166',
    build: (index) =>
      xamlNode(
        'Grid',
        {
          Width: 280,
          Height: 180,
          Rows: 2,
          Columns: 2,
          Background: '#18222e'
        },
        [
          xamlNode('Rectangle', {
            'Grid.Row': 0,
            'Grid.Column': 0,
            Fill: DEFAULT_NODE_COLORS[index % DEFAULT_NODE_COLORS.length]
          }),
          xamlNode('Rectangle', {
            'Grid.Row': 0,
            'Grid.Column': 1,
            Fill: DEFAULT_NODE_COLORS[(index + 1) % DEFAULT_NODE_COLORS.length]
          }),
          xamlNode('Rectangle', {
            'Grid.Row': 1,
            'Grid.Column': 0,
            Fill: DEFAULT_NODE_COLORS[(index + 2) % DEFAULT_NODE_COLORS.length]
          }),
          xamlNode('Rectangle', {
            'Grid.Row': 1,
            'Grid.Column': 1,
            Fill: DEFAULT_NODE_COLORS[(index + 3) % DEFAULT_NODE_COLORS.length]
          })
        ]
      )
  },
  {
    id: 'section-frame',
    title: 'Section Frame',
    description: 'Container block with a heading and room for nested content or imagery.',
    accent: '#6fd3ff',
    build: (index) =>
      xamlNode(
        'Border',
        {
          Width: 280,
          Height: 180,
          Background: '#111923',
          Padding: 18
        },
        [
          xamlNode('StackPanel', { Spacing: 12 }, [
            xamlNode('TextBlock', { Text: `Frame ${index + 1}` }),
            xamlNode('Rectangle', {
              Width: 220,
              Height: 88,
              Fill: DEFAULT_NODE_COLORS[(index + 4) % DEFAULT_NODE_COLORS.length]
            })
          ])
        ]
      )
  }
] as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function colorToHex(color: ColorRgba | null): string | null {
  if (!color) {
    return null;
  }

  const r = Math.round(clamp01(color.r) * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(clamp01(color.g) * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(clamp01(color.b) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
}

function parseHexColor(input: string): ColorRgba | null {
  const value = input.trim();
  const normalized = value.startsWith('#') ? value.slice(1) : value;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return { r, g, b, a: 1 };
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function inferColorAttribute(node: { type: string; attributes: Record<string, unknown> }): 'Background' | 'Fill' {
  if ('Background' in node.attributes) {
    return 'Background';
  }

  if ('Fill' in node.attributes) {
    return 'Fill';
  }

  return node.type.toLowerCase() === 'rectangle' ? 'Fill' : 'Background';
}

function readDraftXaml(): string | null {
  try {
    const xaml = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!xaml) {
      return null;
    }
    return xaml;
  } catch {
    return null;
  }
}

function canHostAdditionalChildren(node: XamlNode | null): boolean {
  if (!node) {
    return false;
  }

  switch (node.type.toLowerCase()) {
    case 'canvas':
    case 'grid':
    case 'stackpanel':
      return true;
    case 'border':
      return node.children.length === 0;
    default:
      return false;
  }
}

function canInsertTemplateIntoParent(template: PaletteTemplate, parentNode: XamlNode | null): boolean {
  if (!parentNode || !canHostAdditionalChildren(parentNode)) {
    return false;
  }

  if (!template.parentTypes) {
    return true;
  }

  return template.parentTypes.includes(parentNode.type.toLowerCase());
}

function applyContainerPlacement(parentNode: XamlNode, node: XamlNode, index: number): XamlNode {
  const next = cloneXamlNode(node);
  const parentType = parentNode.type.toLowerCase();

  delete next.attributes['Designer.OffsetX'];
  delete next.attributes['Designer.OffsetY'];
  delete next.attributes.X;
  delete next.attributes.Y;
  delete next.attributes['Canvas.Left'];
  delete next.attributes['Canvas.Top'];
  delete next.attributes.Left;
  delete next.attributes.Top;
  delete next.attributes['Grid.Row'];
  delete next.attributes['Grid.Column'];

  if (parentType === 'canvas') {
    next.attributes.X = 72 + (index % 4) * 196;
    next.attributes.Y = 72 + Math.floor(index / 4) * 144;
    return next;
  }

  if (parentType === 'grid') {
    const columns = Math.max(1, asFiniteNumber(parentNode.attributes.Columns) ?? 1);
    next.attributes['Grid.Row'] = Math.floor(index / columns);
    next.attributes['Grid.Column'] = index % columns;
  }

  return next;
}

function createTemplateNode(template: PaletteTemplate, parentNode: XamlNode, index: number): XamlNode {
  return applyContainerPlacement(parentNode, template.build(index), index);
}

function findPaletteTemplate(templateId: PaletteTemplateId): PaletteTemplate {
  return PALETTE_TEMPLATES.find((template) => template.id === templateId) ?? PALETTE_TEMPLATES[0];
}

function normalizeFileName(fileName: string | null | undefined): string {
  const value = fileName?.trim();
  return value ? value : DEFAULT_FILE_NAME;
}

function inferDropIntent(itemId: string, rect: DOMRect, clientY: number): TreeDropIntent {
  if (itemId === 'root.0') {
    return 'inside';
  }

  const relativeY = (clientY - rect.top) / Math.max(rect.height, 1);
  if (relativeY <= 0.28) {
    return 'before';
  }

  if (relativeY >= 0.72) {
    return 'after';
  }

  return 'inside';
}

function getNodeIndexFromId(id: string): number | null {
  const segments = id.split('.');
  if (segments.length < 2) {
    return null;
  }

  const index = Number.parseInt(segments[segments.length - 1], 10);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const runtimeRef = useRef<RuntimeHost | null>(null);
  const [status, setStatus] = useState('Initializing designer viewport...');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<UiElement | null>(null);
  const [documentXaml, setDocumentXaml] = useState(sampleXaml);
  const [documentFileName, setDocumentFileName] = useState(DEFAULT_FILE_NAME);
  const [treeItems, setTreeItems] = useState<ReturnType<typeof buildDesignerTree>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<PaletteTemplateId>('metric-card');
  const [sourceDraft, setSourceDraft] = useState(sampleXaml);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [treeDragSourceId, setTreeDragSourceId] = useState<string | null>(null);
  const [treeDropTargetId, setTreeDropTargetId] = useState<string | null>(null);
  const [treeDropIntent, setTreeDropIntent] = useState<TreeDropIntent | null>(null);
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [colorInput, setColorInput] = useState('#67c7ff');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [cameraView, setCameraView] = useState<CameraState>(() => createCameraState());
  const cameraRef = useRef<CameraState>(cameraView);
  const commandStackRef = useRef(new CommandStack());
  const isPanningRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const dragElementIdRef = useRef<string | null>(null);
  const dragStartOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const dragStartElementPositionRef = useRef<Point>({ x: 0, y: 0 });
  const dragStartWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartDocumentRef = useRef<DesignerDocument | null>(null);
  const resizeElementIdRef = useRef<string | null>(null);
  const resizeStartSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const resizeStartWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeStartDocumentRef = useRef<DesignerDocument | null>(null);
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartCameraRef = useRef<CameraState>(cameraView);
  const baseDocumentRef = useRef<DesignerDocument | null>(null);
  const documentRef = useRef<DesignerDocument | null>(null);
  const snapEnabledRef = useRef(snapEnabled);

  const snapValue = (value: number, enabled = snapEnabledRef.current) => {
    if (!enabled) {
      return value;
    }

    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const clearInspectorState = () => {
    setSelectedElement(null);
    setXInput('');
    setYInput('');
    setWidthInput('');
    setHeightInput('');
    setColorInput('#67c7ff');
  };

  const getDocumentColorValue = (
    id: string | null,
    document: DesignerDocument | null = documentRef.current
  ): string | null => {
    if (!id || !document) {
      return null;
    }

    const node = findDocumentNodeById(document, id);
    if (!node) {
      return null;
    }

    const attribute = inferColorAttribute(node);
    const value = node.attributes[attribute];
    return typeof value === 'string' && value.trim() ? value : null;
  };

  const readDocumentOffset = (document: DesignerDocument, id: string): Point => {
    const node = findDocumentNodeById(document, id);
    if (!node) {
      return { x: 0, y: 0 };
    }

    return {
      x: asFiniteNumber(node.attributes['Designer.OffsetX']) ?? 0,
      y: asFiniteNumber(node.attributes['Designer.OffsetY']) ?? 0
    };
  };

  const setSelection = (id: string | null) => {
    const runtime = runtimeRef.current;

    selectedIdRef.current = id;

    if (!runtime) {
      setSelectedId(id);
      syncSelectedElement(id);
      return;
    }

    runtime.setSelectedElement(id);
  };

  const applyRenderedDocument = (
    document: DesignerDocument,
    commit: boolean,
    selectionId: string | null | undefined = undefined
  ) => {
    const runtime = runtimeRef.current;
    const nextXaml = serializeDesignerDocument(document);

    if (commit) {
      documentRef.current = cloneXamlDocument(document);
      setDocumentXaml(nextXaml);
      setTreeItems(buildDesignerTree(document));
    }

    if (!runtime) {
      const nextSelectionId = selectionId === undefined ? selectedIdRef.current : selectionId;
      setSelection(nextSelectionId ?? null);
      return;
    }

    runtime.clearAllOverrides();
    runtime.setXaml(nextXaml);

    const currentSelectionId = selectedIdRef.current;
    let nextSelectionId = selectionId === undefined ? currentSelectionId : selectionId;
    if (nextSelectionId && !runtime.getElementById(nextSelectionId)) {
      nextSelectionId = null;
    }

    setSelection(nextSelectionId);
  };

  const applyCommittedDocument = (
    document: DesignerDocument,
    options?: { setAsBase?: boolean; selectionId?: string | null }
  ) => {
    const committedDocument = cloneXamlDocument(document);

    if (options?.setAsBase) {
      baseDocumentRef.current = cloneXamlDocument(committedDocument);
    }

    applyRenderedDocument(committedDocument, true, options?.selectionId);
  };

  const previewDocument = (document: DesignerDocument) => {
    applyRenderedDocument(document, false);
  };

  const syncSelectedElement = (id: string | null = selectedIdRef.current) => {
    const runtime = runtimeRef.current;

    if (!runtime || !id) {
      clearInspectorState();
      return;
    }

    const element = runtime.getElementById(id);
    if (!element) {
      clearInspectorState();
      return;
    }

    setSelectedElement(element);
    setXInput(element.layout.x.toFixed(0));
    setYInput(element.layout.y.toFixed(0));
    setWidthInput(element.layout.width.toFixed(0));
    setHeightInput(element.layout.height.toFixed(0));
    setColorInput(getDocumentColorValue(id) ?? '#67c7ff');
  };

  const executeDocumentCommand = (
    label: string,
    nextDocument: DesignerDocument,
    options?: { nextSelectionId?: string | null; previousSelectionId?: string | null }
  ) => {
    const currentDocument = documentRef.current;
    if (!currentDocument) {
      return;
    }

    const beforeDocument = cloneXamlDocument(currentDocument);
    const afterDocument = cloneXamlDocument(nextDocument);
    const beforeXaml = serializeDesignerDocument(beforeDocument);
    const afterXaml = serializeDesignerDocument(afterDocument);

    if (beforeXaml === afterXaml) {
      return;
    }

    const command: DesignerCommand = {
      id: label,
      apply: () => {
        applyCommittedDocument(afterDocument, { selectionId: options?.nextSelectionId });
      },
      undo: () => {
        applyCommittedDocument(beforeDocument, { selectionId: options?.previousSelectionId });
      }
    };

    commandStackRef.current.execute(command);
    setHistoryVersion((value) => value + 1);
  };

  const buildMoveDocument = (document: DesignerDocument, elementId: string, offset: Point) =>
    updateDocumentNodeAttributes(document, elementId, {
      'Designer.OffsetX': Math.round(offset.x) === 0 ? null : Math.round(offset.x),
      'Designer.OffsetY': Math.round(offset.y) === 0 ? null : Math.round(offset.y)
    });

  const buildResizeDocument = (
    document: DesignerDocument,
    elementId: string,
    size: { width: number; height: number }
  ) =>
    updateDocumentNodeAttributes(document, elementId, {
      Width: Math.max(24, Math.round(size.width)),
      Height: Math.max(24, Math.round(size.height))
    });

  const buildColorDocument = (document: DesignerDocument, elementId: string, color: string) => {
    const node = findDocumentNodeById(document, elementId);
    if (!node) {
      return document;
    }

    return updateDocumentNodeAttributes(document, elementId, {
      [inferColorAttribute(node)]: color
    });
  };

  const buildResetDocument = (
    document: DesignerDocument,
    baseDocument: DesignerDocument,
    elementId: string
  ) => {
    const currentNode = findDocumentNodeById(document, elementId);
    const baseNode = findDocumentNodeById(baseDocument, elementId);
    if (!currentNode || !baseNode) {
      return document;
    }

    const patch: Record<string, string | number | boolean | null> = {
      'Designer.OffsetX': baseNode.attributes['Designer.OffsetX'] ?? null,
      'Designer.OffsetY': baseNode.attributes['Designer.OffsetY'] ?? null,
      Width: baseNode.attributes.Width ?? null,
      Height: baseNode.attributes.Height ?? null
    };

    for (const key of ['Background', 'Fill'] as const) {
      if (key in currentNode.attributes || key in baseNode.attributes) {
        patch[key] = baseNode.attributes[key] ?? null;
      }
    }

    return updateDocumentNodeAttributes(document, elementId, patch);
  };

  const executeResetElementCommand = (elementId: string) => {
    const currentDocument = documentRef.current;
    const baseDocument = baseDocumentRef.current;
    if (!currentDocument || !baseDocument) {
      return;
    }

    executeDocumentCommand('reset-element-edits', buildResetDocument(currentDocument, baseDocument, elementId));
  };

  const applySourceDraft = () => {
    const nextSource = sourceDraft.trim();
    if (!nextSource) {
      const message = 'XAML source cannot be empty.';
      setSourceError(message);
      setStatus(message);
      return;
    }

    if (
      loadDocumentFromText(nextSource, {
        fileName: documentFileName,
        successStatus: 'Applied XAML source and reset the designer history baseline.',
        failurePrefix: 'XAML apply failed',
        setAsBase: true,
        clearHistory: true,
        resetSelection: true,
        reflectErrorInSourcePane: true
      })
    ) {
      return;
    }
  };

  const loadDocumentFromText = (
    xaml: string,
    options: {
      fileName?: string;
      successStatus: string;
      failurePrefix: string;
      setAsBase?: boolean;
      clearHistory?: boolean;
      resetSelection?: boolean;
      reflectErrorInSourcePane?: boolean;
    }
  ): boolean => {
    try {
      const nextDocument = parseDesignerDocument(xaml);
      const normalizedXaml = serializeDesignerDocument(nextDocument);

      if (options.fileName) {
        setDocumentFileName(normalizeFileName(options.fileName));
      }
      if (options.clearHistory) {
        commandStackRef.current.clear();
        setHistoryVersion((value) => value + 1);
      }
      setSourceError(null);
      setSourceDirty(false);
      setSourceDraft(normalizedXaml);
      applyCommittedDocument(nextDocument, {
        setAsBase: options.setAsBase ?? true,
        selectionId: options.resetSelection === false ? selectedIdRef.current : null
      });
      setStatus(options.successStatus);
      return true;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      if (options.reflectErrorInSourcePane) {
        setSourceError(reason);
      }
      setStatus(`${options.failurePrefix}: ${reason}`);
      return false;
    }
  };

  const revertSourceDraft = () => {
    setSourceDraft(documentXaml);
    setSourceDirty(false);
    setSourceError(null);
  };

  const saveDocumentToFile = async () => {
    const xaml = documentRef.current ? serializeDesignerDocument(documentRef.current) : documentXaml;
    const nextFileName = normalizeFileName(documentFileName);
    const platformWindow = window as Window & {
      showSaveFilePicker?: (options?: unknown) => Promise<{
        name?: string;
        createWritable: () => Promise<{
          write: (data: string) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    };

    if (platformWindow.showSaveFilePicker) {
      try {
        const handle = await platformWindow.showSaveFilePicker({
          suggestedName: nextFileName,
          types: [
            {
              description: 'XAML Documents',
              accept: {
                'application/xml': ['.xaml', '.xml'],
                'text/plain': ['.txt']
              }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(xaml);
        await writable.close();
        setDocumentFileName(normalizeFileName(handle.name ?? nextFileName));
        setStatus(`Saved XAML to ${normalizeFileName(handle.name ?? nextFileName)}.`);
        return;
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    const blob = new Blob([xaml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nextFileName;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported XAML as ${nextFileName}.`);
  };

  const openDocumentFilePicker = () => {
    fileInputRef.current?.click();
  };

  const loadDocumentFromFile = async (file: File) => {
    const xaml = await file.text();
    loadDocumentFromText(xaml, {
      fileName: file.name,
      successStatus: `Loaded XAML from ${file.name}.`,
      failurePrefix: `Failed to load ${file.name}`,
      setAsBase: true,
      clearHistory: true,
      resetSelection: true
    });
  };

  const handleDocumentFileChange = async (event: JSX.TargetedEvent<HTMLInputElement, Event>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    await loadDocumentFromFile(file);
    input.value = '';
  };

  const insertTemplateAt = (parentId: string, insertIndex: number, previousSelectionId: string | null, modeLabel: string) => {
    const currentDocument = documentRef.current;
    if (!currentDocument) {
      return;
    }

    const parentNode = findDocumentNodeById(currentDocument, parentId);
    const selectedTemplate = findPaletteTemplate(selectedTemplateId);
    if (!parentNode || !canInsertTemplateIntoParent(selectedTemplate, parentNode)) {
      setStatus(`The ${selectedTemplate.title} template cannot be inserted into that container.`);
      return;
    }

    const nextNode = createTemplateNode(selectedTemplate, parentNode, insertIndex);
    const nextDocument = insertDocumentChild(currentDocument, parentId, nextNode, insertIndex);
    const nextSelectionId = `${parentId}.${insertIndex}`;

    executeDocumentCommand(`palette-${modeLabel}`, nextDocument, {
      nextSelectionId,
      previousSelectionId
    });
    setStatus(`Inserted ${selectedTemplate.title} as a ${modeLabel}.`);
  };

  const createChildElement = () => {
    const currentDocument = documentRef.current;
    if (!currentDocument) {
      return;
    }

    const selectedTreeItem =
      treeItems.find((item) => item.id === selectedIdRef.current) ?? treeItems.find((item) => item.id === 'root.0') ?? null;
    const parentId = selectedTreeItem?.id ?? 'root.0';
    const parentNode = findDocumentNodeById(currentDocument, parentId);
    const selectedTemplate = findPaletteTemplate(selectedTemplateId);
    if (!parentNode || !canInsertTemplateIntoParent(selectedTemplate, parentNode)) {
      setStatus('The selected element cannot host more children.');
      return;
    }

    const insertIndex = parentNode.children.length;
    insertTemplateAt(parentId, insertIndex, selectedIdRef.current, 'child');
  };

  const createSiblingElement = () => {
    const currentDocument = documentRef.current;
    const selectedTreeItem = treeItems.find((item) => item.id === selectedIdRef.current) ?? null;
    if (!currentDocument || !selectedTreeItem?.parentId) {
      setStatus('Select a non-root element to add a sibling.');
      return;
    }

    const parentNode = findDocumentNodeById(currentDocument, selectedTreeItem.parentId);
    const selectedTemplate = findPaletteTemplate(selectedTemplateId);
    if (!canInsertTemplateIntoParent(selectedTemplate, parentNode)) {
      setStatus('The selected element parent cannot host additional children.');
      return;
    }

    const selectedIndex = getNodeIndexFromId(selectedTreeItem.id);
    if (selectedIndex == null) {
      return;
    }

    const insertIndex = selectedIndex + 1;
    insertTemplateAt(selectedTreeItem.parentId, insertIndex, selectedTreeItem.id, 'sibling');
  };

  const deleteSelectedElement = () => {
    const currentDocument = documentRef.current;
    const selectedTreeItem = treeItems.find((item) => item.id === selectedIdRef.current) ?? null;
    if (!currentDocument || !selectedTreeItem || selectedTreeItem.id === 'root.0') {
      setStatus('Select a non-root element to delete it.');
      return;
    }

    const nextDocument = removeDocumentNode(currentDocument, selectedTreeItem.id);
    executeDocumentCommand('tree-delete-node', nextDocument, {
      nextSelectionId: selectedTreeItem.parentId,
      previousSelectionId: selectedTreeItem.id
    });
    setStatus(`Deleted ${selectedTreeItem.type}.`);
  };

  const reparentSelectedIn = () => {
    const currentDocument = documentRef.current;
    const selectedTreeItem = treeItems.find((item) => item.id === selectedIdRef.current) ?? null;
    if (!currentDocument || !selectedTreeItem?.parentId) {
      setStatus('Select an element with a previous sibling to nest it.');
      return;
    }

    const selectedIndex = getNodeIndexFromId(selectedTreeItem.id);
    if (selectedIndex == null || selectedIndex === 0) {
      setStatus('The selected element cannot be nested into a previous sibling.');
      return;
    }

    const previousSiblingId = `${selectedTreeItem.parentId}.${selectedIndex - 1}`;
    const previousSiblingNode = findDocumentNodeById(currentDocument, previousSiblingId);
    const selectedNode = findDocumentNodeById(currentDocument, selectedTreeItem.id);
    if (!previousSiblingNode || !selectedNode || !canHostAdditionalChildren(previousSiblingNode)) {
      setStatus('The previous sibling cannot host the selected element.');
      return;
    }

    const insertIndex = previousSiblingNode.children.length;
    const withoutSelected = removeDocumentNode(currentDocument, selectedTreeItem.id);
    const nextDocument = insertDocumentChild(withoutSelected, previousSiblingId, cloneXamlNode(selectedNode), insertIndex);
    const nextSelectionId = `${previousSiblingId}.${insertIndex}`;

    executeDocumentCommand('tree-reparent-in', nextDocument, {
      nextSelectionId,
      previousSelectionId: selectedTreeItem.id
    });
    setStatus(`Nested ${selectedTreeItem.type} into ${previousSiblingNode.type}.`);
  };

  const reparentSelectedOut = () => {
    const currentDocument = documentRef.current;
    const selectedTreeItem = treeItems.find((item) => item.id === selectedIdRef.current) ?? null;
    const parentTreeItem = selectedTreeItem?.parentId
      ? treeItems.find((item) => item.id === selectedTreeItem.parentId) ?? null
      : null;
    if (!currentDocument || !selectedTreeItem?.parentId || !parentTreeItem?.parentId) {
      setStatus('Select a nested element to move it out one level.');
      return;
    }

    const selectedNode = findDocumentNodeById(currentDocument, selectedTreeItem.id);
    const parentIndex = getNodeIndexFromId(parentTreeItem.id);
    if (!selectedNode || parentIndex == null) {
      return;
    }

    const insertIndex = parentIndex + 1;
    const withoutSelected = removeDocumentNode(currentDocument, selectedTreeItem.id);
    const nextDocument = insertDocumentChild(
      withoutSelected,
      parentTreeItem.parentId,
      cloneXamlNode(selectedNode),
      insertIndex
    );
    const nextSelectionId = `${parentTreeItem.parentId}.${insertIndex}`;

    executeDocumentCommand('tree-reparent-out', nextDocument, {
      nextSelectionId,
      previousSelectionId: selectedTreeItem.id
    });
    setStatus(`Moved ${selectedTreeItem.type} out of ${parentTreeItem.type}.`);
  };

  const clearTreeDragState = () => {
    setTreeDragSourceId(null);
    setTreeDropTargetId(null);
    setTreeDropIntent(null);
  };

  const resolveTreeDropTarget = (sourceId: string, targetId: string, intent: TreeDropIntent) => {
    const currentDocument = documentRef.current;
    if (!currentDocument || sourceId === 'root.0') {
      return null;
    }

    const targetTreeItem = treeItems.find((item) => item.id === targetId) ?? null;
    if (!targetTreeItem) {
      return null;
    }

    if (intent === 'inside') {
      const targetNode = findDocumentNodeById(currentDocument, targetId);
      if (!targetNode || !canHostAdditionalChildren(targetNode)) {
        return null;
      }

      const next = moveDocumentNode(currentDocument, sourceId, targetId, targetNode.children.length);
      if (!next) {
        return null;
      }

      return { ...next, parentId: targetId, index: targetNode.children.length };
    }

    if (!targetTreeItem.parentId) {
      return null;
    }

    const targetIndex = getNodeIndexFromId(targetId);
    if (targetIndex == null) {
      return null;
    }

    const insertionIndex = targetIndex + (intent === 'after' ? 1 : 0);
    const next = moveDocumentNode(currentDocument, sourceId, targetTreeItem.parentId, insertionIndex);
    if (!next) {
      return null;
    }

    return {
      ...next,
      parentId: targetTreeItem.parentId,
      index: insertionIndex
    };
  };

  const handleTreeDragStart = (itemId: string, event: JSX.TargetedDragEvent<HTMLButtonElement>) => {
    if (itemId === 'root.0') {
      event.preventDefault();
      return;
    }

    setTreeDragSourceId(itemId);
    setTreeDropTargetId(null);
    setTreeDropIntent(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', itemId);
    }
    selectElement(itemId);
  };

  const handleTreeDragOver = (itemId: string, event: JSX.TargetedDragEvent<HTMLButtonElement>) => {
    if (!treeDragSourceId) {
      return;
    }

    event.preventDefault();
    const intent = inferDropIntent(itemId, event.currentTarget.getBoundingClientRect(), event.clientY);
    const resolved = resolveTreeDropTarget(treeDragSourceId, itemId, intent);

    setTreeDropTargetId(itemId);
    setTreeDropIntent(resolved ? intent : null);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = resolved ? 'move' : 'none';
    }
  };

  const handleTreeDrop = (itemId: string, event: JSX.TargetedDragEvent<HTMLButtonElement>) => {
    if (!treeDragSourceId) {
      return;
    }

    event.preventDefault();
    const intent = inferDropIntent(itemId, event.currentTarget.getBoundingClientRect(), event.clientY);
    const resolved = resolveTreeDropTarget(treeDragSourceId, itemId, intent);
    if (!resolved) {
      clearTreeDragState();
      setStatus('That drop target is not valid for the selected node.');
      return;
    }

    executeDocumentCommand('tree-drag-move', resolved.document, {
      nextSelectionId: resolved.movedId,
      previousSelectionId: treeDragSourceId
    });
    clearTreeDragState();
    setStatus(`Moved element to ${intent === 'inside' ? 'inside' : intent} ${itemId}.`);
  };

  const handleTreeDragEnd = () => {
    clearTreeDragState();
  };

  const performUndo = () => {
    if (!commandStackRef.current.canUndo()) {
      return;
    }

    commandStackRef.current.undo();
    setHistoryVersion((value) => value + 1);
  };

  const performRedo = () => {
    if (!commandStackRef.current.canRedo()) {
      return;
    }

    commandStackRef.current.redo();
    setHistoryVersion((value) => value + 1);
  };

  const saveDraftToStorage = () => {
    try {
      const currentDocument = documentRef.current;
      const xaml = currentDocument ? serializeDesignerDocument(currentDocument) : documentXaml;
      localStorage.setItem(DRAFT_STORAGE_KEY, xaml);
    } catch {
      // Best-effort local persistence.
    }
  };

  const loadDraftFromStorage = () => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const draftXaml = readDraftXaml();
    if (!draftXaml) {
      return;
    }

    if (!loadDocumentFromText(draftXaml, {
      fileName: documentFileName,
      successStatus: 'Loaded the saved XAML draft.',
      failurePrefix: 'Failed to load draft',
      setAsBase: true,
      clearHistory: true,
      resetSelection: true
    })) {
      runtime.setSelectedElement(selectedIdRef.current);
    }
  };

  const clearDraftFromStorage = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Best-effort local persistence cleanup.
    }
  };

  const selectElement = (id: string | null) => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    runtime.setSelectedElement(id);
  };

  const applyCamera = (cameraState: CameraState) => {
    const runtime = runtimeRef.current;
    cameraRef.current = cameraState;
    setCameraView(cameraState);
    runtime?.setCamera(cameraState);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setStatus('Canvas unavailable.');
      return;
    }

    let initialDocument: DesignerDocument;
    try {
      initialDocument = parseDesignerDocument(readDraftXaml() ?? sampleXaml);
    } catch {
      initialDocument = parseDesignerDocument(sampleXaml);
    }

    const initialXaml = serializeDesignerDocument(initialDocument);
    documentRef.current = cloneXamlDocument(initialDocument);
    baseDocumentRef.current = cloneXamlDocument(initialDocument);
    setDocumentXaml(initialXaml);
    setSourceDraft(initialXaml);
    setTreeItems(buildDesignerTree(initialDocument));

    const runtime = new RuntimeHost(canvas);
    runtimeRef.current = runtime;
    runtime.setCamera(cameraRef.current);

    runtime
      .boot({
        xaml: initialXaml,
        canvas,
        onHoveredElementChange: setHoveredId,
        onSelectedElementChange: (id: string | null) => {
          selectedIdRef.current = id;
          setSelectedId(id);
          syncSelectedElement(id);
        }
      })
      .then(() => {
        setStatus('Design surface online. Left-drag to move, handle-drag to resize, middle-drag to pan.');
        runtime.start();
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to initialize viewport: ${reason}`);
      });

    return () => {
      runtime.stop();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    saveDraftToStorage();
  }, [documentXaml]);

  useEffect(() => {
    if (!sourceDirty) {
      setSourceDraft(documentXaml);
      setSourceError(null);
    }
  }, [documentXaml, sourceDirty]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const toCanvasPoint = (event: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left - canvas.clientLeft,
        y: event.clientY - rect.top - canvas.clientTop
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0) {
        const runtime = runtimeRef.current;
        const currentDocument = documentRef.current;
        if (!runtime) {
          return;
        }

        const point = toCanvasPoint(event);
        const id = runtime.pickElementAtScreenPoint(point);
        if (!id || !currentDocument) {
          return;
        }

        isDraggingRef.current = true;
        dragElementIdRef.current = id;
        dragStartOffsetRef.current = readDocumentOffset(currentDocument, id);
        const selected = runtime.getElementById(id);
        dragStartElementPositionRef.current = selected
          ? { x: selected.layout.x, y: selected.layout.y }
          : { x: 0, y: 0 };
        dragStartWorldRef.current = screenToWorld(point, cameraRef.current);
        dragStartDocumentRef.current = cloneXamlDocument(currentDocument);
        canvas.classList.add('is-dragging');
        canvas.setPointerCapture(event.pointerId);
        return;
      }

      if (event.button !== 1) {
        return;
      }

      event.preventDefault();
      isPanningRef.current = true;
      panOriginRef.current = { x: event.clientX, y: event.clientY };
      panStartCameraRef.current = cameraRef.current;
      canvas.classList.add('is-panning');
    };

    const onPointerMove = (event: PointerEvent) => {
      if (isResizingRef.current && resizeElementIdRef.current) {
        const startDocument = resizeStartDocumentRef.current;
        if (!startDocument) {
          return;
        }

        const point = toCanvasPoint(event);
        const world = screenToWorld(point, cameraRef.current);
        const startWorld = resizeStartWorldRef.current;
        const startSize = resizeStartSizeRef.current;
        const rawWidth = Math.max(24, startSize.width + (world.x - startWorld.x));
        const rawHeight = Math.max(24, startSize.height + (world.y - startWorld.y));
        const nextWidth = Math.max(24, snapValue(rawWidth, snapEnabledRef.current && !event.altKey));
        const nextHeight = Math.max(24, snapValue(rawHeight, snapEnabledRef.current && !event.altKey));

        previewDocument(
          buildResizeDocument(startDocument, resizeElementIdRef.current, {
            width: nextWidth,
            height: nextHeight
          })
        );
        return;
      }

      if (isDraggingRef.current && dragElementIdRef.current) {
        const startDocument = dragStartDocumentRef.current;
        if (!startDocument) {
          return;
        }

        const point = toCanvasPoint(event);
        const world = screenToWorld(point, cameraRef.current);
        const id = dragElementIdRef.current;
        const startWorld = dragStartWorldRef.current;
        const startOffset = dragStartOffsetRef.current;
        const startPosition = dragStartElementPositionRef.current;
        const offsetDelta = {
          x: startOffset.x + (world.x - startWorld.x),
          y: startOffset.y + (world.y - startWorld.y)
        };
        const nextOffset =
          snapEnabledRef.current && !event.altKey
            ? {
                x: startOffset.x + (snapValue(startPosition.x + (world.x - startWorld.x), true) - startPosition.x),
                y: startOffset.y + (snapValue(startPosition.y + (world.y - startWorld.y), true) - startPosition.y)
              }
            : offsetDelta;

        previewDocument(buildMoveDocument(startDocument, id, nextOffset));
        return;
      }

      if (!isPanningRef.current) {
        return;
      }

      const start = panOriginRef.current;
      const startCamera = panStartCameraRef.current;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const zoom = Math.max(startCamera.zoom, 0.05);

      applyCamera({
        ...startCamera,
        x: startCamera.x - dx / zoom,
        y: startCamera.y - dy / zoom
      });
    };

    const endPan = () => {
      if (isResizingRef.current) {
        const runtime = runtimeRef.current;
        const id = resizeElementIdRef.current;
        const startDocument = resizeStartDocumentRef.current;
        if (runtime && id && startDocument) {
          const selected = runtime.getElementById(id);
          const to = selected
            ? { width: selected.layout.width, height: selected.layout.height }
            : resizeStartSizeRef.current;
          executeDocumentCommand('handle-resize', buildResizeDocument(startDocument, id, to));
        }

        isResizingRef.current = false;
        resizeElementIdRef.current = null;
        resizeStartDocumentRef.current = null;
        canvas.classList.remove('is-resizing');
      }

      if (isDraggingRef.current) {
        const runtime = runtimeRef.current;
        const id = dragElementIdRef.current;
        const startDocument = dragStartDocumentRef.current;
        if (runtime && id && startDocument) {
          const selected = runtime.getElementById(id);
          const to = selected
            ? {
                x: dragStartOffsetRef.current.x + (selected.layout.x - dragStartElementPositionRef.current.x),
                y: dragStartOffsetRef.current.y + (selected.layout.y - dragStartElementPositionRef.current.y)
              }
            : dragStartOffsetRef.current;
          executeDocumentCommand('drag-move', buildMoveDocument(startDocument, id, to));
        }

        isDraggingRef.current = false;
        dragElementIdRef.current = null;
        dragStartDocumentRef.current = null;
        canvas.classList.remove('is-dragging');
      }

      if (!isPanningRef.current) {
        return;
      }

      isPanningRef.current = false;
      canvas.classList.remove('is-panning');
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const point = toCanvasPoint(event);
      const cameraNow = cameraRef.current;
      const worldBefore = screenToWorld(point, cameraNow);
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);
      const nextZoom = Math.min(4, Math.max(0.2, cameraNow.zoom * zoomFactor));

      applyCamera({
        zoom: nextZoom,
        x: worldBefore.x - point.x / nextZoom,
        y: worldBefore.y - point.y / nextZoom
      });
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endPan);
    window.addEventListener('pointercancel', endPan);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPan);
      window.removeEventListener('pointercancel', endPan);
      canvas.removeEventListener('wheel', onWheel);
      canvas.classList.remove('is-panning');
      canvas.classList.remove('is-dragging');
      canvas.classList.remove('is-resizing');
    };
  }, []);

  useEffect(() => {
    snapEnabledRef.current = snapEnabled;
  }, [snapEnabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }

      const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
      const isRedoMac = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && event.shiftKey;
      const isRedoWin = event.ctrlKey && event.key.toLowerCase() === 'y';
      const isToggleSnap = !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'g';
      const arrowKey = event.key;
      const isArrow =
        arrowKey === 'ArrowUp' ||
        arrowKey === 'ArrowDown' ||
        arrowKey === 'ArrowLeft' ||
        arrowKey === 'ArrowRight';

      if (isToggleSnap) {
        event.preventDefault();
        setSnapEnabled((value) => !value);
        return;
      }

      if (isUndo) {
        event.preventDefault();
        performUndo();
        return;
      }

      if (isRedoMac || isRedoWin) {
        event.preventDefault();
        performRedo();
        return;
      }

      if (isArrow) {
        const currentDocument = documentRef.current;
        const id = selectedIdRef.current;
        if (!currentDocument || !id) {
          return;
        }

        event.preventDefault();
        const step = event.shiftKey
          ? GRID_SIZE * 4
          : snapEnabledRef.current
            ? GRID_SIZE
            : 1;
        let dx = 0;
        let dy = 0;

        if (arrowKey === 'ArrowLeft') dx = -step;
        if (arrowKey === 'ArrowRight') dx = step;
        if (arrowKey === 'ArrowUp') dy = -step;
        if (arrowKey === 'ArrowDown') dy = step;

        const from = readDocumentOffset(currentDocument, id);
        const to = { x: from.x + dx, y: from.y + dy };
        executeDocumentCommand('nudge-move', buildMoveDocument(currentDocument, id, to));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [snapEnabled, historyVersion]);

  const commitInspectorPosition = () => {
    const currentDocument = documentRef.current;
    const id = selectedIdRef.current;

    if (!currentDocument || !id || !selectedElement) {
      return;
    }

    const nextX = Number.parseFloat(xInput);
    const nextY = Number.parseFloat(yInput);

    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      setXInput(selectedElement.layout.x.toFixed(0));
      setYInput(selectedElement.layout.y.toFixed(0));
      return;
    }

    const currentOffset = readDocumentOffset(currentDocument, id);
    const deltaX = nextX - selectedElement.layout.x;
    const deltaY = nextY - selectedElement.layout.y;
    const rawOffset = {
      x: currentOffset.x + deltaX,
      y: currentOffset.y + deltaY
    };
    const nextOffset = {
      x: snapValue(rawOffset.x),
      y: snapValue(rawOffset.y)
    };

    executeDocumentCommand('inspector-move', buildMoveDocument(currentDocument, id, nextOffset));
  };

  const commitInspectorSize = () => {
    const currentDocument = documentRef.current;
    const id = selectedIdRef.current;

    if (!currentDocument || !id || !selectedElement) {
      return;
    }

    const nextWidth = Number.parseFloat(widthInput);
    const nextHeight = Number.parseFloat(heightInput);

    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight) || nextWidth <= 0 || nextHeight <= 0) {
      setWidthInput(selectedElement.layout.width.toFixed(0));
      setHeightInput(selectedElement.layout.height.toFixed(0));
      return;
    }

    executeDocumentCommand(
      'inspector-resize',
      buildResizeDocument(currentDocument, id, {
        width: Math.max(24, snapValue(nextWidth)),
        height: Math.max(24, snapValue(nextHeight))
      })
    );
  };

  const commitInspectorColor = () => {
    const currentDocument = documentRef.current;
    const id = selectedIdRef.current;

    if (!currentDocument || !id || !selectedElement) {
      return;
    }

    const next = parseHexColor(colorInput);
    if (!next) {
      setColorInput(getDocumentColorValue(id) ?? '#67c7ff');
      return;
    }

    executeDocumentCommand('inspector-color', buildColorDocument(currentDocument, id, colorToHex(next) ?? '#67c7ff'));
  };

  const selectedTreeItem = selectedId ? treeItems.find((item) => item.id === selectedId) ?? null : null;
  const selectedTreeNode =
    selectedTreeItem && documentRef.current ? findDocumentNodeById(documentRef.current, selectedTreeItem.id) : null;
  const selectedTemplate = findPaletteTemplate(selectedTemplateId);
  const parentTreeItem =
    selectedTreeItem?.parentId ? treeItems.find((item) => item.id === selectedTreeItem.parentId) ?? null : null;
  const selectedTreeIndex = selectedTreeItem ? getNodeIndexFromId(selectedTreeItem.id) : null;
  const previousSiblingId =
    selectedTreeItem?.parentId && selectedTreeIndex != null && selectedTreeIndex > 0
      ? `${selectedTreeItem.parentId}.${selectedTreeIndex - 1}`
      : null;
  const previousSiblingNode =
    previousSiblingId && documentRef.current ? findDocumentNodeById(documentRef.current, previousSiblingId) : null;
  const selectedOrRootId = selectedTreeItem?.id ?? 'root.0';
  const selectedOrRootNode =
    documentRef.current ? findDocumentNodeById(documentRef.current, selectedOrRootId) : null;
  const siblingParentNode =
    selectedTreeItem?.parentId && documentRef.current
      ? findDocumentNodeById(documentRef.current, selectedTreeItem.parentId)
      : null;
  const canAddChild = canInsertTemplateIntoParent(selectedTemplate, selectedOrRootNode);
  const canAddSibling = !!selectedTreeItem?.parentId && canInsertTemplateIntoParent(selectedTemplate, siblingParentNode);
  const canDeleteSelected = !!selectedTreeItem && selectedTreeItem.id !== 'root.0';
  const canReparentIn = !!selectedTreeItem && !!previousSiblingNode && canHostAdditionalChildren(previousSiblingNode);
  const canReparentOut = !!selectedTreeItem && !!parentTreeItem?.parentId;
  const canApplySource = sourceDirty && sourceDraft.trim().length > 0;
  const childTargetLabel = selectedOrRootNode ? selectedOrRootNode.type : 'Canvas';
  const siblingTargetLabel = siblingParentNode ? siblingParentNode.type : 'Unavailable';
  const origin = worldToScreen({ x: 0, y: 0 }, cameraView);
  const canUndo = commandStackRef.current.canUndo();
  const canRedo = commandStackRef.current.canRedo();
  const selectedScreenRect = selectedElement
    ? {
        x: (selectedElement.layout.x - cameraView.x) * cameraView.zoom,
        y: (selectedElement.layout.y - cameraView.y) * cameraView.zoom,
        width: Math.max(8, selectedElement.layout.width * cameraView.zoom),
        height: Math.max(8, selectedElement.layout.height * cameraView.zoom)
      }
    : null;
  const gridStep = Math.max(4, GRID_SIZE * cameraView.zoom);
  const gridOffsetX = -((cameraView.x * cameraView.zoom) % gridStep);
  const gridOffsetY = -((cameraView.y * cameraView.zoom) % gridStep);

  const onResizeHandlePointerDown = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const runtime = runtimeRef.current;
    const currentDocument = documentRef.current;
    const canvas = canvasRef.current;
    const id = selectedIdRef.current;
    if (!runtime || !canvas || !id || !currentDocument) {
      return;
    }

    const selected = runtime.getElementById(id);
    if (!selected) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left - canvas.clientLeft,
      y: event.clientY - rect.top - canvas.clientTop
    };
    const world = screenToWorld(point, cameraRef.current);

    isResizingRef.current = true;
    resizeElementIdRef.current = id;
    resizeStartSizeRef.current = {
      width: selected.layout.width,
      height: selected.layout.height
    };
    resizeStartWorldRef.current = world;
    resizeStartDocumentRef.current = cloneXamlDocument(currentDocument);
    canvas.classList.add('is-resizing');
  };

  return (
    <main className="designer-shell">
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".xaml,.xml,.txt,text/plain,application/xml"
        onChange={handleDocumentFileChange}
      />
      <aside className="left-rail">
        <h1>Designer</h1>
        <p>{status}</p>
        <div className="origin">Screen origin: {origin.x.toFixed(0)}, {origin.y.toFixed(0)}</div>
        <div className="origin">Camera: {cameraView.x.toFixed(0)}, {cameraView.y.toFixed(0)}</div>
        <div className="origin">Zoom: {(cameraView.zoom * 100).toFixed(0)}%</div>
        <div className="origin">Snap: {snapEnabled ? `On (${GRID_SIZE}px)` : 'Off'} (toggle: G)</div>
        <div className="origin">File: {documentFileName}</div>
        <div className="toolbar-row">
          <button className="toolbar-btn" type="button" onClick={performUndo} disabled={!canUndo}>
            Undo
          </button>
          <button className="toolbar-btn" type="button" onClick={performRedo} disabled={!canRedo}>
            Redo
          </button>
        </div>
        <div className="toolbar-row">
          <button className="toolbar-btn" type="button" onClick={saveDraftToStorage}>
            Save Draft
          </button>
          <button className="toolbar-btn" type="button" onClick={loadDraftFromStorage}>
            Load Draft
          </button>
        </div>
        <div className="toolbar-row">
          <button className="toolbar-btn" type="button" onClick={openDocumentFilePicker}>
            Import File
          </button>
          <button className="toolbar-btn" type="button" onClick={() => void saveDocumentToFile()}>
            Export File
          </button>
        </div>
        <button className="toolbar-btn full-width" type="button" onClick={clearDraftFromStorage}>
          Clear Draft Storage
        </button>
        <section className="palette-panel">
          <h2>Palette</h2>
          <p className="tree-caption">
            Pick a template, then insert it as a child or sibling. Placement adapts automatically for `Canvas` and `Grid` containers.
          </p>
          <div className="palette-grid">
            {PALETTE_TEMPLATES.map((template) => {
              const childEnabled = canInsertTemplateIntoParent(template, selectedOrRootNode);
              const siblingEnabled = !!selectedTreeItem?.parentId && canInsertTemplateIntoParent(template, siblingParentNode);

              return (
                <button
                  key={template.id}
                  className={`palette-card ${selectedTemplateId === template.id ? 'is-selected' : ''}`}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <span className="palette-swatch" style={{ background: template.accent }} />
                  <span className="palette-title">{template.title}</span>
                  <span className="palette-description">{template.description}</span>
                  <span className="palette-meta">
                    {childEnabled ? 'Child OK' : 'Child blocked'} | {siblingEnabled ? 'Sibling OK' : 'Sibling blocked'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="tree-panel">
          <h2>Component Tree</h2>
          <p className="tree-caption">
            Target: {selectedTreeNode ? `${selectedTreeNode.type} (${selectedTreeItem?.id})` : 'Root canvas'}
          </p>
          <p className="tree-caption">
            Template: {selectedTemplate.title} | Child target: {childTargetLabel} | Sibling target: {siblingTargetLabel}
          </p>
          <div className="tree-toolbar">
            <div className="toolbar-row">
              <button className="toolbar-btn" type="button" onClick={createChildElement} disabled={!canAddChild}>
                Add Child
              </button>
              <button className="toolbar-btn" type="button" onClick={createSiblingElement} disabled={!canAddSibling}>
                Add Sibling
              </button>
            </div>
            <div className="toolbar-row">
              <button className="toolbar-btn" type="button" onClick={reparentSelectedIn} disabled={!canReparentIn}>
                Nest In
              </button>
              <button className="toolbar-btn" type="button" onClick={reparentSelectedOut} disabled={!canReparentOut}>
                Move Out
              </button>
            </div>
            <button className="toolbar-btn full-width" type="button" onClick={deleteSelectedElement} disabled={!canDeleteSelected}>
              Delete Selected
            </button>
          </div>
          <div className="tree-list" role="tree">
            {treeItems.map((item) => (
              <button
                key={item.id}
                className={`tree-item ${selectedId === item.id ? 'is-selected' : ''} ${
                  treeDragSourceId === item.id ? 'is-drag-source' : ''
                } ${treeDropTargetId === item.id && treeDropIntent === 'before' ? 'drop-before' : ''} ${
                  treeDropTargetId === item.id && treeDropIntent === 'inside' ? 'drop-inside' : ''
                } ${treeDropTargetId === item.id && treeDropIntent === 'after' ? 'drop-after' : ''}`}
                style={{ paddingLeft: `${12 + item.depth * 16}px` }}
                type="button"
                draggable={item.id !== 'root.0'}
                onClick={() => selectElement(item.id)}
                onDragStart={(event) => handleTreeDragStart(item.id, event)}
                onDragOver={(event) => handleTreeDragOver(item.id, event)}
                onDrop={(event) => handleTreeDrop(item.id, event)}
                onDragEnd={handleTreeDragEnd}
              >
                <span className="tree-type">{item.type}</span>
                <span className="tree-label">{item.label}</span>
              </button>
            ))}
          </div>
        </section>
        <div className="origin">Hover: {hoveredId ?? 'none'}</div>
        <div className="origin">Selected: {selectedId ?? 'none'}</div>
      </aside>
      <section className="canvas-wrap">
        <div className="viewport-layer">
          <div
            className={`grid-overlay ${snapEnabled ? 'is-visible' : ''}`}
            style={{
              backgroundSize: `${gridStep}px ${gridStep}px`,
              backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`
            }}
          />
          <canvas className="canvas" ref={canvasRef} />
          {selectedScreenRect ? (
            <div
              className="selection-rect"
              style={{
                left: `${selectedScreenRect.x}px`,
                top: `${selectedScreenRect.y}px`,
                width: `${selectedScreenRect.width}px`,
                height: `${selectedScreenRect.height}px`
              }}
            >
              <button
                className="resize-handle"
                type="button"
                aria-label="Resize selected element"
                onPointerDown={onResizeHandlePointerDown}
              />
            </div>
          ) : null}
        </div>
      </section>
      <aside className="inspector">
        <h2>Inspector</h2>
        <p className="selection-label">Current selection: {selectedId ?? 'none'}</p>
        {selectedElement ? (
          <section className="inspector-group">
            <h3>Element</h3>
            <label className="field">
              <span>Type</span>
              <input readOnly value={selectedElement.type} />
            </label>
            <label className="field">
              <span>X</span>
              <input
                value={xInput}
                onInput={(event) => setXInput((event.target as HTMLInputElement).value)}
                onBlur={commitInspectorPosition}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitInspectorPosition();
                  }
                }}
              />
            </label>
            <label className="field">
              <span>Y</span>
              <input
                value={yInput}
                onInput={(event) => setYInput((event.target as HTMLInputElement).value)}
                onBlur={commitInspectorPosition}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitInspectorPosition();
                  }
                }}
              />
            </label>
            <label className="field">
              <span>Width</span>
              <input
                value={widthInput}
                onInput={(event) => setWidthInput((event.target as HTMLInputElement).value)}
                onBlur={commitInspectorSize}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitInspectorSize();
                  }
                }}
              />
            </label>
            <label className="field">
              <span>Height</span>
              <input
                value={heightInput}
                onInput={(event) => setHeightInput((event.target as HTMLInputElement).value)}
                onBlur={commitInspectorSize}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitInspectorSize();
                  }
                }}
              />
            </label>
            <label className="field">
              <span>Color</span>
              <input
                value={colorInput}
                onInput={(event) => setColorInput((event.target as HTMLInputElement).value)}
                onBlur={commitInspectorColor}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitInspectorColor();
                  }
                }}
              />
            </label>
            <button
              className="toolbar-btn full-width"
              type="button"
              onClick={() => {
                const id = selectedIdRef.current;
                if (id) {
                  executeResetElementCommand(id);
                }
              }}
            >
              Reset Element Edits
            </button>
          </section>
        ) : null}
        <section className="inspector-group">
          <h3>XAML Draft</h3>
          <p className="source-caption">
            Edit raw XAML, then apply it back into the designer. Applying source resets undo history and refreshes the reset baseline.
          </p>
          <textarea
            className={`source-preview ${sourceError ? 'has-error' : ''}`}
            value={sourceDraft}
            onInput={(event) => {
              setSourceDraft((event.target as HTMLTextAreaElement).value);
              setSourceDirty(true);
              setSourceError(null);
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                applySourceDraft();
              }
            }}
            spellcheck={false}
          />
          {sourceError ? <p className="source-error">Parse error: {sourceError}</p> : null}
          <div className="toolbar-row">
            <button className="toolbar-btn" type="button" onClick={applySourceDraft} disabled={!canApplySource}>
              Apply XAML
            </button>
            <button className="toolbar-btn" type="button" onClick={revertSourceDraft} disabled={!sourceDirty}>
              Revert
            </button>
          </div>
        </section>
      </aside>
    </main>
  );
}
