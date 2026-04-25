import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import {
  CommandStack,
  buildDesignerTree,
  cloneXamlDocument,
  cloneXamlNode,
  createCameraState,
  findDocumentNodeById,
  formatDesignerDocumentDiagnostic,
  insertDocumentChild,
  moveDocumentNode,
  parseDesignerDocument,
  parseDesignerDocumentWithDiagnostics,
  removeDocumentNode,
  screenToWorld,
  serializeDesignerDocument,
  updateDocumentNodeAttributes,
  worldToScreen,
  type CameraState,
  type DesignerDocument,
  type DesignerDocumentDiagnostic,
  type DesignerCommand,
  type DesignerTreeItem
} from '@ui-designer/designer-core';
import { RuntimeHost } from '@ui-designer/ui-runtime-web';
import { ensureImageNaturalSize, getImageNaturalSize, type Point, type UiElement } from '@ui-designer/ui-core';
import { Inspector } from './components/Inspector';
import { LeftRail } from './components/LeftRail';
import { SourcePane } from './components/SourcePane';
import { Viewport } from './components/Viewport';
import { designerChromeDefinition, type DesignerChromeItem } from './designer/chrome';
import {
  asFiniteNumber,
  applyContainerPlacement,
  canHostAdditionalChildren,
  canInsertTemplateIntoParent,
  collectDocumentFontFamilies,
  collectDocumentImageSources,
  colorToHex,
  createTemplateNode,
  getNodeIndexFromId,
  inferColorAttribute,
  inferDropIntent,
  isImageNode,
  isTextNode,
  normalizeFileName,
  parseHexColor,
  readStringAttribute,
  resolveAspectLockedSize,
  resolveImageAspectRatio,
  type TreeDropIntent
} from './designer/document';
import {
  createViewportOverlayState,
  DEFAULT_DEBUG_OVERLAY_SETTINGS,
  type DebugOverlaySettings
} from './designer/overlays';
import {
  BUILTIN_FONT_ASSETS,
  BUILTIN_IMAGE_ASSETS,
  DEFAULT_FILE_NAME,
  PALETTE_TEMPLATES,
  findFontAsset,
  findImageAsset,
  findPaletteTemplate,
  GRID_SIZE,
  sampleXaml,
  type DesignerFontAsset,
  type DesignerImageAsset,
  type PaletteTemplateId
} from './designer/presets';
import {
  buildFontLibrary,
  buildImageLibrary,
  fontAssetsToFaceDefinitions,
  importFontAssetFiles,
  importImageAssetFiles,
  mergeFontAssets,
  mergeImageAssets,
  resolveImageInsertionSize
} from './designer/resources';
import {
  clearDraftXaml,
  readCustomFontAssets,
  readCustomImageAssets,
  readDraftXaml,
  writeCustomFontAssets,
  writeCustomImageAssets,
  writeDraftXaml
} from './designer/storage';

const MAX_VISIBLE_SOURCE_DIAGNOSTICS = 4;

interface SourceDiagnostic {
  severity: DesignerDocumentDiagnostic['severity'];
  message: string;
}

function formatSourceDiagnostics(diagnostics: DesignerDocumentDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return 'Invalid XAML document.';
  }

  const visibleDiagnostics = diagnostics.slice(0, MAX_VISIBLE_SOURCE_DIAGNOSTICS);
  const lines = visibleDiagnostics.map(formatDesignerDocumentDiagnostic);
  const hiddenCount = diagnostics.length - visibleDiagnostics.length;

  if (hiddenCount > 0) {
    lines.push(`${hiddenCount} more diagnostic${hiddenCount === 1 ? '' : 's'}.`);
  }

  return lines.join('\n');
}

function sourceDiagnosticFromDiagnostics(diagnostics: DesignerDocumentDiagnostic[]): SourceDiagnostic | null {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  if (errors.length > 0) {
    return {
      severity: 'error',
      message: formatSourceDiagnostics(errors)
    };
  }

  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  if (warnings.length > 0) {
    return {
      severity: 'warning',
      message: formatSourceDiagnostics(warnings)
    };
  }

  return null;
}

function inlineDiagnosticMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

export function App() {
  const [customImageAssets, setCustomImageAssets] = useState<DesignerImageAsset[]>(() => readCustomImageAssets());
  const [customFontAssets, setCustomFontAssets] = useState<DesignerFontAsset[]>(() => readCustomFontAssets());
  const imageAssets = useMemo(() => buildImageLibrary(customImageAssets), [customImageAssets]);
  const fontAssets = useMemo(() => buildFontLibrary(customFontAssets), [customFontAssets]);
  const fontFaceDefinitions = useMemo(() => fontAssetsToFaceDefinitions(fontAssets), [fontAssets]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageAssetInputRef = useRef<HTMLInputElement | null>(null);
  const fontAssetInputRef = useRef<HTMLInputElement | null>(null);
  const runtimeRef = useRef<RuntimeHost | null>(null);

  const [status, setStatus] = useState('Initializing designer viewport...');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredElement, setHoveredElement] = useState<UiElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<UiElement | null>(null);
  const [documentXaml, setDocumentXaml] = useState(sampleXaml);
  const [documentFileName, setDocumentFileName] = useState(DEFAULT_FILE_NAME);
  const [treeItems, setTreeItems] = useState<DesignerTreeItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<PaletteTemplateId>('metric-card');
  const [selectedAssetId, setSelectedAssetId] = useState(BUILTIN_IMAGE_ASSETS[0].id);
  const [selectedFontId, setSelectedFontId] = useState(BUILTIN_FONT_ASSETS[0].id);
  const [sourceDraft, setSourceDraft] = useState(sampleXaml);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [sourceDiagnostic, setSourceDiagnostic] = useState<SourceDiagnostic | null>(null);
  const [treeDragSourceId, setTreeDragSourceId] = useState<string | null>(null);
  const [treeDropTargetId, setTreeDropTargetId] = useState<string | null>(null);
  const [treeDropIntent, setTreeDropIntent] = useState<TreeDropIntent | null>(null);
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [colorInput, setColorInput] = useState('#67c7ff');
  const [imageSourceInput, setImageSourceInput] = useState('');
  const [imageStretchInput, setImageStretchInput] = useState('UniformToFill');
  const [imageOpacityInput, setImageOpacityInput] = useState('1');
  const [fontFamilyInput, setFontFamilyInput] = useState('');
  const [fontSizeAttrInput, setFontSizeAttrInput] = useState('');
  const [fontWeightInput, setFontWeightInput] = useState('');
  const [fontStyleInput, setFontStyleInput] = useState('Normal');
  const [textAlignmentInput, setTextAlignmentInput] = useState('Left');
  const [flowDirectionInput, setFlowDirectionInput] = useState('Auto');
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [, setResourceVersion] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [cameraView, setCameraView] = useState<CameraState>(() => createCameraState());
  const [overlaySettings, setOverlaySettings] = useState<DebugOverlaySettings>(DEFAULT_DEBUG_OVERLAY_SETTINGS);

  const cameraRef = useRef<CameraState>(cameraView);
  const commandStackRef = useRef(new CommandStack());
  const selectedElementRef = useRef<UiElement | null>(null);
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
  const lockAspectRatioRef = useRef(lockAspectRatio);

  const snapValue = (value: number, enabled = snapEnabledRef.current) => {
    if (!enabled) {
      return value;
    }

    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const clearInspectorState = () => {
    setSelectedElement(null);
    selectedElementRef.current = null;
    setXInput('');
    setYInput('');
    setWidthInput('');
    setHeightInput('');
    setColorInput('#67c7ff');
    setImageSourceInput('');
    setImageStretchInput('UniformToFill');
    setImageOpacityInput('1');
    setFontFamilyInput('');
    setFontSizeAttrInput('');
    setFontWeightInput('');
    setFontStyleInput('Normal');
    setTextAlignmentInput('Left');
    setFlowDirectionInput('Auto');
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

  const syncHoveredElement = (id: string | null) => {
    const runtime = runtimeRef.current;
    setHoveredId(id);
    setHoveredElement(id && runtime ? runtime.getElementById(id) : null);
  };

  const syncSelectedElement = (id: string | null = selectedIdRef.current) => {
    const runtime = runtimeRef.current;
    const currentDocument = documentRef.current;

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
    selectedElementRef.current = element;
    setXInput(element.layout.x.toFixed(0));
    setYInput(element.layout.y.toFixed(0));
    setWidthInput(element.layout.width.toFixed(0));
    setHeightInput(element.layout.height.toFixed(0));
    setColorInput(getDocumentColorValue(id) ?? '#67c7ff');

    const node = currentDocument ? findDocumentNodeById(currentDocument, id) : null;
    const source = readStringAttribute(node, 'Source');
    const family = readStringAttribute(node, 'FontFamily');
    const fontSource = readStringAttribute(node, 'FontSource');

    setImageSourceInput(source);
    setImageStretchInput(readStringAttribute(node, 'Stretch') || 'UniformToFill');
    setImageOpacityInput(`${asFiniteNumber(node?.attributes.Opacity) ?? 1}`);
    setFontFamilyInput(family);
    setFontSizeAttrInput(
      readStringAttribute(node, 'FontSize') || `${asFiniteNumber(node?.attributes.FontSize) ?? ''}`.trim()
    );
    setFontWeightInput(
      readStringAttribute(node, 'FontWeight') || `${asFiniteNumber(node?.attributes.FontWeight) ?? ''}`.trim()
    );
    setFontStyleInput(readStringAttribute(node, 'FontStyle') || 'Normal');
    setTextAlignmentInput(readStringAttribute(node, 'TextAlignment') || (element.type.toLowerCase() === 'button' ? 'Center' : 'Left'));
    setFlowDirectionInput(readStringAttribute(node, 'FlowDirection') || 'Auto');

    const matchingAsset = source ? imageAssets.find((asset) => asset.source === source) ?? null : null;
    if (matchingAsset) {
      setSelectedAssetId(matchingAsset.id);
    }

    const matchingFont = family
      ? fontAssets.find((font) => font.family === family && (font.source ?? '') === fontSource) ??
        fontAssets.find((font) => font.family === family) ??
        null
      : null;
    if (matchingFont) {
      setSelectedFontId(matchingFont.id);
    }
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
    syncHoveredElement(hoveredId);
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
    setSourceDiagnostic(null);
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
    size: { width: number; height: number },
    options?: { preserveAspect?: boolean; selectedNode?: ReturnType<typeof findDocumentNodeById>; selectedUiElement?: UiElement | null }
  ) => {
    let nextSize = {
      width: Math.max(24, size.width),
      height: Math.max(24, size.height)
    };

    if (options?.preserveAspect && isImageNode(options.selectedNode ?? null)) {
      nextSize = resolveAspectLockedSize(
        nextSize.width,
        nextSize.height,
        resolveImageAspectRatio(options.selectedNode ?? null, options.selectedUiElement ?? null),
        options.selectedUiElement?.layout.width ?? nextSize.width,
        options.selectedUiElement?.layout.height ?? nextSize.height
      );
    }

    return updateDocumentNodeAttributes(document, elementId, {
      Width: Math.max(24, Math.round(nextSize.width)),
      Height: Math.max(24, Math.round(nextSize.height))
    });
  };

  const buildColorDocument = (document: DesignerDocument, elementId: string, color: string) => {
    const node = findDocumentNodeById(document, elementId);
    if (!node) {
      return document;
    }

    return updateDocumentNodeAttributes(document, elementId, {
      [inferColorAttribute(node)]: color
    });
  };

  const buildAttributeDocument = (
    document: DesignerDocument,
    elementId: string,
    patch: Record<string, string | number | boolean | null>
  ) => updateDocumentNodeAttributes(document, elementId, patch);

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

    for (const key of [
      'Foreground',
      'Background',
      'Fill',
      'Source',
      'Stretch',
      'Opacity',
      'FontFamily',
      'FontSource',
      'FontSize',
      'FontWeight',
      'FontStyle',
      'TextAlignment',
      'FlowDirection'
    ] as const) {
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

  const applySelectedAssetToSelection = () => {
    const currentDocument = documentRef.current;
    const id = selectedIdRef.current;
    const node = id && currentDocument ? findDocumentNodeById(currentDocument, id) : null;
    if (!currentDocument || !id || !isImageNode(node)) {
      setStatus('Select an Image element to apply a library asset.');
      return;
    }

    const asset = findImageAsset(imageAssets, selectedAssetId);
    const natural = getImageNaturalSize(asset.source);
    executeDocumentCommand(
      'asset-apply-image',
      buildAttributeDocument(currentDocument, id, {
        Source: asset.source,
        Background: readStringAttribute(node, 'Background') || asset.background,
        Width: node.attributes.Width ?? natural?.width ?? null,
        Height: node.attributes.Height ?? natural?.height ?? null
      })
    );
    setStatus(`Applied ${asset.title} to the selected image.`);
  };

  const insertSelectedAssetImage = () => {
    const currentDocument = documentRef.current;
    if (!currentDocument) {
      return;
    }

    const targetTreeItem =
      treeItems.find((item) => item.id === selectedIdRef.current) ?? treeItems.find((item) => item.id === 'root.0') ?? null;
    const parentId = targetTreeItem?.id ?? 'root.0';
    const parentNode = findDocumentNodeById(currentDocument, parentId);
    if (!parentNode || !canHostAdditionalChildren(parentNode)) {
      setStatus('Select a container to insert an image asset.');
      return;
    }

    const asset = findImageAsset(imageAssets, selectedAssetId);
    const previousSelectionId = selectedIdRef.current;
    void resolveImageInsertionSize(asset.source).then((size) => {
      const latestDocument = documentRef.current;
      const latestParentNode = latestDocument ? findDocumentNodeById(latestDocument, parentId) : null;
      if (!latestDocument || !latestParentNode || !canHostAdditionalChildren(latestParentNode)) {
        return;
      }

      const nextNode = applyContainerPlacement(
        latestParentNode,
        cloneXamlNode({
          type: 'Image',
          attributes: {
            Width: size.width,
            Height: size.height,
            Source: asset.source,
            Stretch: 'UniformToFill',
            Background: asset.background
          },
          children: []
        }),
        latestParentNode.children.length
      );
      const nextDocument = insertDocumentChild(latestDocument, parentId, nextNode, latestParentNode.children.length);
      const nextSelectionId = `${parentId}.${latestParentNode.children.length}`;

      executeDocumentCommand('asset-insert-image', nextDocument, {
        nextSelectionId,
        previousSelectionId
      });
      setStatus(`Inserted ${asset.title} into ${latestParentNode.type}.`);
    });
  };

  const applySelectedFontToSelection = () => {
    const currentDocument = documentRef.current;
    const id = selectedIdRef.current;
    const node = id && currentDocument ? findDocumentNodeById(currentDocument, id) : null;
    if (!currentDocument || !id || !isTextNode(node)) {
      setStatus('Select a TextBlock or Button to apply a font preset.');
      return;
    }

    const font = findFontAsset(fontAssets, selectedFontId);
    executeDocumentCommand(
      'asset-apply-font',
      buildAttributeDocument(currentDocument, id, {
        FontFamily: font.family,
        FontSource: font.source ?? null
      })
    );
    setStatus(`Applied ${font.title} to the selected text element.`);
  };

  const applyNaturalImageSize = () => {
    const currentDocument = documentRef.current;
    const id = selectedIdRef.current;
    const node = id && currentDocument ? findDocumentNodeById(currentDocument, id) : null;
    if (!currentDocument || !id || !selectedElement || !isImageNode(node)) {
      return;
    }

    const source = readStringAttribute(node, 'Source').trim();
    if (!source) {
      return;
    }

    void ensureImageNaturalSize(source).then((size) => {
      if (!size) {
        setStatus('Unable to resolve the natural size for that image source.');
        return;
      }

      executeDocumentCommand(
        'image-natural-size',
        buildResizeDocument(
          currentDocument,
          id,
          { width: size.width, height: size.height },
          { preserveAspect: false, selectedNode: node, selectedUiElement: selectedElement }
        )
      );
      setStatus(`Applied natural image size ${size.width}x${size.height}.`);
    });
  };

  const commitImageSettings = () => {
    const currentDocument = documentRef.current;
    const id = selectedIdRef.current;
    const node = id && currentDocument ? findDocumentNodeById(currentDocument, id) : null;
    if (!currentDocument || !id || !isImageNode(node)) {
      return;
    }

    const nextSource = imageSourceInput.trim();
    const nextOpacity = Number.parseFloat(imageOpacityInput);
    if (!nextSource || !Number.isFinite(nextOpacity)) {
      syncSelectedElement(id);
      return;
    }

    const matchingAsset = imageAssets.find((asset) => asset.source === nextSource) ?? null;
    if (matchingAsset) {
      setSelectedAssetId(matchingAsset.id);
    }

    executeDocumentCommand(
      'image-settings',
      buildAttributeDocument(currentDocument, id, {
        Source: nextSource,
        Stretch: imageStretchInput || 'UniformToFill',
        Opacity: Math.max(0, Math.min(1, nextOpacity))
      })
    );
  };

  const commitTypographySettings = () => {
    const currentDocument = documentRef.current;
    const id = selectedIdRef.current;
    const node = id && currentDocument ? findDocumentNodeById(currentDocument, id) : null;
    if (!currentDocument || !id || !isTextNode(node)) {
      return;
    }

    const fontSize = fontSizeAttrInput.trim() ? Number.parseFloat(fontSizeAttrInput) : null;
    if (fontSizeAttrInput.trim() && (!Number.isFinite(fontSize) || fontSize == null || fontSize <= 0)) {
      syncSelectedElement(id);
      return;
    }

    const matchingFont =
      fontAssets.find((font) => font.family === fontFamilyInput.trim() && (font.source ?? '') === readStringAttribute(node, 'FontSource')) ??
      fontAssets.find((font) => font.family === fontFamilyInput.trim()) ??
      null;
    if (matchingFont) {
      setSelectedFontId(matchingFont.id);
    }

    executeDocumentCommand(
      'text-typography',
      buildAttributeDocument(currentDocument, id, {
        FontFamily: fontFamilyInput.trim() || null,
        FontSource: (matchingFont?.source ?? readStringAttribute(node, 'FontSource')) || null,
        FontSize: fontSize == null ? null : Math.max(1, Math.round(fontSize)),
        FontWeight: fontWeightInput.trim() || null,
        FontStyle: fontStyleInput === 'Normal' ? null : fontStyleInput,
        TextAlignment:
          textAlignmentInput === 'Center' && node.type.toLowerCase() === 'button'
            ? null
            : textAlignmentInput === 'Left'
              ? null
              : textAlignmentInput,
        FlowDirection: flowDirectionInput === 'Auto' ? null : flowDirectionInput
      })
    );
  };

  const applySourceDraft = () => {
    const nextSource = sourceDraft.trim();
    if (!nextSource) {
      const message = 'XAML source cannot be empty.';
      setSourceDiagnostic({ severity: 'error', message });
      setStatus(message);
      return;
    }

    loadDocumentFromText(nextSource, {
      fileName: documentFileName,
      successStatus: 'Applied XAML source and reset the designer history baseline.',
      failurePrefix: 'XAML apply failed',
      setAsBase: true,
      clearHistory: true,
      resetSelection: true,
      reflectDiagnosticsInSourcePane: true
    });
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
      reflectDiagnosticsInSourcePane?: boolean;
    }
  ): boolean => {
    try {
      const result = parseDesignerDocumentWithDiagnostics(xaml);

      if (!result.document || result.hasErrors) {
        const diagnostic: SourceDiagnostic = sourceDiagnosticFromDiagnostics(result.diagnostics) ?? {
          severity: 'error',
          message: 'Invalid XAML document.'
        };
        if (options.reflectDiagnosticsInSourcePane) {
          setSourceDraft(xaml);
          setSourceDirty(true);
          setSourceDiagnostic(diagnostic);
        }
        setStatus(`${options.failurePrefix}: ${inlineDiagnosticMessage(diagnostic.message)}`);
        return false;
      }

      const nextDocument = result.document;
      const diagnostic = sourceDiagnosticFromDiagnostics(result.diagnostics);
      const normalizedXaml = serializeDesignerDocument(nextDocument);

      if (options.fileName) {
        setDocumentFileName(normalizeFileName(options.fileName, DEFAULT_FILE_NAME));
      }
      if (options.clearHistory) {
        commandStackRef.current.clear();
        setHistoryVersion((value) => value + 1);
      }
      setSourceDiagnostic(diagnostic);
      setSourceDirty(false);
      setSourceDraft(normalizedXaml);
      applyCommittedDocument(nextDocument, {
        setAsBase: options.setAsBase ?? true,
        selectionId: options.resetSelection === false ? selectedIdRef.current : null
      });
      setStatus(diagnostic ? `${options.successStatus} ${inlineDiagnosticMessage(diagnostic.message)}` : options.successStatus);
      return true;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      if (options.reflectDiagnosticsInSourcePane) {
        setSourceDraft(xaml);
        setSourceDirty(true);
        setSourceDiagnostic({ severity: 'error', message: reason });
      }
      setStatus(`${options.failurePrefix}: ${inlineDiagnosticMessage(reason)}`);
      return false;
    }
  };

  const revertSourceDraft = () => {
    setSourceDraft(documentXaml);
    setSourceDirty(false);
    setSourceDiagnostic(null);
  };

  const saveDocumentToFile = async () => {
    const xaml = documentRef.current ? serializeDesignerDocument(documentRef.current) : documentXaml;
    const nextFileName = normalizeFileName(documentFileName, DEFAULT_FILE_NAME);
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
        setDocumentFileName(normalizeFileName(handle.name ?? nextFileName, DEFAULT_FILE_NAME));
        setStatus(`Saved XAML to ${normalizeFileName(handle.name ?? nextFileName, DEFAULT_FILE_NAME)}.`);
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
    documentFileInputRef.current?.click();
  };

  const openImageAssetFilePicker = () => {
    imageAssetInputRef.current?.click();
  };

  const openFontAssetFilePicker = () => {
    fontAssetInputRef.current?.click();
  };

  const loadDocumentFromFile = async (file: File) => {
    const xaml = await file.text();
    loadDocumentFromText(xaml, {
      fileName: file.name,
      successStatus: `Loaded XAML from ${file.name}.`,
      failurePrefix: `Failed to load ${file.name}`,
      setAsBase: true,
      clearHistory: true,
      resetSelection: true,
      reflectDiagnosticsInSourcePane: true
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

  const handleImageAssetFileChange = async (event: JSX.TargetedEvent<HTMLInputElement, Event>) => {
    const input = event.currentTarget;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) {
      return;
    }

    try {
      const imported = await importImageAssetFiles(files);
      const nextAssets = mergeImageAssets(customImageAssets, imported);
      setCustomImageAssets(nextAssets);
      if (imported[0]) {
        setSelectedAssetId(imported[0].id);
      }
      setStatus(`Imported ${imported.length} image asset${imported.length === 1 ? '' : 's'}.`);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      setStatus(`Image import failed: ${reason}`);
    } finally {
      input.value = '';
    }
  };

  const handleFontAssetFileChange = async (event: JSX.TargetedEvent<HTMLInputElement, Event>) => {
    const input = event.currentTarget;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) {
      return;
    }

    try {
      const imported = await importFontAssetFiles(files);
      const nextFonts = mergeFontAssets(customFontAssets, imported);
      setCustomFontAssets(nextFonts);
      if (imported[0]) {
        setSelectedFontId(imported[0].id);
        setFontFamilyInput(imported[0].family);
      }
      const runtime = runtimeRef.current;
      if (runtime) {
        void runtime.registerFontFaces(fontAssetsToFaceDefinitions(imported));
      }
      setStatus(`Imported ${imported.length} font asset${imported.length === 1 ? '' : 's'}.`);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      setStatus(`Font import failed: ${reason}`);
    } finally {
      input.value = '';
    }
  };

  const removeSelectedImageAsset = () => {
    const asset = findImageAsset(imageAssets, selectedAssetId);
    if (asset.kind !== 'imported') {
      return;
    }

    setCustomImageAssets((current) => current.filter((entry) => entry.id !== asset.id));
    setSelectedAssetId(BUILTIN_IMAGE_ASSETS[0].id);
    setStatus(`Removed ${asset.title} from the image library.`);
  };

  const removeSelectedFont = () => {
    const font = findFontAsset(fontAssets, selectedFontId);
    if (font.kind !== 'imported') {
      return;
    }

    setCustomFontAssets((current) => current.filter((entry) => entry.id !== font.id));
    setSelectedFontId(BUILTIN_FONT_ASSETS[0].id);
    setStatus(`Removed ${font.title} from the font library.`);
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
    setSelection(itemId);
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

  const performUndo = () => {
    if (!commandStackRef.current.canUndo()) {
      return;
    }

    commandStackRef.current.undo();
    setSourceDiagnostic(null);
    setHistoryVersion((value) => value + 1);
  };

  const performRedo = () => {
    if (!commandStackRef.current.canRedo()) {
      return;
    }

    commandStackRef.current.redo();
    setSourceDiagnostic(null);
    setHistoryVersion((value) => value + 1);
  };

  const saveDraftToStorage = () => {
    const currentDocument = documentRef.current;
    const xaml = currentDocument ? serializeDesignerDocument(currentDocument) : documentXaml;
    writeDraftXaml(xaml);
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

  const applyCamera = (cameraState: CameraState) => {
    const runtime = runtimeRef.current;
    cameraRef.current = cameraState;
    setCameraView(cameraState);
    runtime?.setCamera(cameraState);
  };

  const clearDraftStorage = () => {
    clearDraftXaml();
    setStatus('Cleared saved draft storage.');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setStatus('Canvas unavailable.');
      return;
    }

    let runtime: RuntimeHost | null = null;

    try {
      setStatus('Preparing designer document...');

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

      runtime = new RuntimeHost(canvas);
      runtimeRef.current = runtime;
      runtime.setCamera(cameraRef.current);
      setStatus('Initializing WebGPU renderer...');

      void runtime
        .boot({
          xaml: initialXaml,
          canvas,
          fontFaces: fontFaceDefinitions,
          onHoveredElementChange: (id: string | null) => {
            syncHoveredElement(id);
          },
          onSelectedElementChange: (id: string | null) => {
            selectedIdRef.current = id;
            setSelectedId(id);
            syncSelectedElement(id);
          }
        })
        .then(() => {
          setStatus('Design surface online. Left-drag to move, handle-drag to resize, middle-drag to pan.');
          runtime?.start();
        })
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          setStatus(`Failed to initialize viewport: ${reason}`);
        });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to prepare designer runtime: ${reason}`);
    }

    return () => {
      runtime?.stop();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    saveDraftToStorage();
  }, [documentXaml]);

  useEffect(() => {
    writeCustomImageAssets(customImageAssets);
  }, [customImageAssets]);

  useEffect(() => {
    writeCustomFontAssets(customFontAssets);
  }, [customFontAssets]);

  useEffect(() => {
    if (!sourceDirty) {
      setSourceDraft(documentXaml);
    }
  }, [documentXaml, sourceDirty]);

  useEffect(() => {
    const sources = new Set<string>(imageAssets.map((asset) => asset.source));
    for (const source of collectDocumentImageSources(documentRef.current)) {
      sources.add(source);
    }

    void Promise.allSettled(Array.from(sources, (source) => ensureImageNaturalSize(source))).then(() => {
      setResourceVersion((value) => value + 1);
    });
  }, [documentXaml, imageAssets]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    void runtime.registerFontFaces(fontFaceDefinitions);
  }, [fontFaceDefinitions]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    setHoveredElement(hoveredId ? runtime.getElementById(hoveredId) : null);
  }, [hoveredId, documentXaml, cameraView]);

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
        const selectedNode = findDocumentNodeById(startDocument, resizeElementIdRef.current);

        previewDocument(
          buildResizeDocument(
            startDocument,
            resizeElementIdRef.current,
            {
              width: nextWidth,
              height: nextHeight
            },
            {
              preserveAspect: lockAspectRatioRef.current && isImageNode(selectedNode) && !event.altKey,
              selectedNode,
              selectedUiElement: selectedElementRef.current
            }
          )
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
          const selectedNode = findDocumentNodeById(startDocument, id);
          executeDocumentCommand(
            'handle-resize',
            buildResizeDocument(startDocument, id, to, {
              preserveAspect: lockAspectRatioRef.current && isImageNode(selectedNode),
              selectedNode,
              selectedUiElement: selected
            })
          );
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
    lockAspectRatioRef.current = lockAspectRatio;
  }, [lockAspectRatio]);

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

    const node = findDocumentNodeById(currentDocument, id);

    executeDocumentCommand(
      'inspector-resize',
      buildResizeDocument(
        currentDocument,
        id,
        {
          width: Math.max(24, snapValue(nextWidth)),
          height: Math.max(24, snapValue(nextHeight))
        },
        {
          preserveAspect: lockAspectRatio && isImageNode(node),
          selectedNode: node,
          selectedUiElement: selectedElement
        }
      )
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
  const isSelectedTextNode = isTextNode(selectedTreeNode);
  const isSelectedImageNode = isImageNode(selectedTreeNode);
  const selectedTemplate = findPaletteTemplate(selectedTemplateId);
  const selectedAsset = findImageAsset(imageAssets, selectedAssetId);
  const selectedFont = findFontAsset(fontAssets, selectedFontId);
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
  const selectedOrRootNode = documentRef.current ? findDocumentNodeById(documentRef.current, selectedOrRootId) : null;
  const siblingParentNode =
    selectedTreeItem?.parentId && documentRef.current
      ? findDocumentNodeById(documentRef.current, selectedTreeItem.parentId)
      : null;
  const parentElement = parentTreeItem?.id && runtimeRef.current ? runtimeRef.current.getElementById(parentTreeItem.id) : null;
  const canAddChild = canInsertTemplateIntoParent(selectedTemplate, selectedOrRootNode);
  const canAddSibling = !!selectedTreeItem?.parentId && canInsertTemplateIntoParent(selectedTemplate, siblingParentNode);
  const canDeleteSelected = !!selectedTreeItem && selectedTreeItem.id !== 'root.0';
  const canReparentIn = !!selectedTreeItem && !!previousSiblingNode && canHostAdditionalChildren(previousSiblingNode);
  const canReparentOut = !!selectedTreeItem && !!parentTreeItem?.parentId;
  const canApplySource = sourceDirty && sourceDraft.trim().length > 0;
  const childTargetLabel = selectedOrRootNode ? selectedOrRootNode.type : 'Canvas';
  const siblingTargetLabel = siblingParentNode ? siblingParentNode.type : 'Unavailable';
  const documentImageSources = collectDocumentImageSources(documentRef.current);
  const documentFontFamilies = collectDocumentFontFamilies(documentRef.current);
  const selectedImageNaturalSize = isSelectedImageNode ? getImageNaturalSize(imageSourceInput.trim()) : null;
  const selectedImageNaturalSizeLabel = selectedImageNaturalSize
    ? `${selectedImageNaturalSize.width}x${selectedImageNaturalSize.height}`
    : 'Loading or unavailable';
  const origin = worldToScreen({ x: 0, y: 0 }, cameraView);
  const canUndo = commandStackRef.current.canUndo();
  const canRedo = commandStackRef.current.canRedo();
  const overlayState = createViewportOverlayState({
    camera: cameraView,
    selectedElement,
    hoveredElement,
    parentElement,
    selectedNode: selectedTreeNode
  });
  const gridStep = Math.max(4, GRID_SIZE * cameraView.zoom);
  const gridOffsetX = -((cameraView.x * cameraView.zoom) % gridStep);
  const gridOffsetY = -((cameraView.y * cameraView.zoom) % gridStep);

  const onResizeHandlePointerDown: JSX.PointerEventHandler<HTMLButtonElement> = (event) => {
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

  const updateOverlaySetting = (key: keyof DebugOverlaySettings, value: boolean) => {
    setOverlaySettings((current) => ({
      ...current,
      [key]: value
    }));
  };

  const resolveImageTokenLabel = (source: string, index: number): string => {
    const knownAsset = imageAssets.find((asset) => asset.source === source) ?? null;
    if (knownAsset) {
      return knownAsset.title;
    }

    return source.startsWith('data:image/') ? `Embedded Image ${index + 1}` : `Image ${index + 1}`;
  };
  const resolveChromeLabel = (item: DesignerChromeItem): string => {
    if (item.labelBinding === 'documentFileName') {
      return documentFileName;
    }

    return item.label;
  };
  const commandHandlers: Record<string, { onClick: () => void; disabled?: boolean }> = {
    undo: { onClick: performUndo, disabled: !canUndo },
    redo: { onClick: performRedo, disabled: !canRedo },
    import: { onClick: openDocumentFilePicker },
    export: { onClick: () => void saveDocumentToFile() }
  };
  const statusValues: Record<string, string> = {
    status,
    zoom: `${(cameraView.zoom * 100).toFixed(0)}%`,
    snap: snapEnabled ? '8px' : 'Off',
    selection: selectedId ?? 'none'
  };
  const resolveStatusText = (item: DesignerChromeItem): string => {
    const value = item.valueBinding ? statusValues[item.valueBinding] : '';
    return item.label ? `${item.label} ${value}` : value;
  };

  return (
    <main className="designer-shell">
      <input
        ref={documentFileInputRef}
        className="visually-hidden"
        type="file"
        accept=".xaml,.xml,.txt,text/plain,application/xml"
        onChange={handleDocumentFileChange}
      />
      <input
        ref={imageAssetInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*,.svg"
        multiple
        onChange={handleImageAssetFileChange}
      />
      <input
        ref={fontAssetInputRef}
        className="visually-hidden"
        type="file"
        accept=".woff,.woff2,.ttf,.otf,font/*"
        multiple
        onChange={handleFontAssetFileChange}
      />

      <header className="blend-top-chrome">
        <div className="title-strip">
          <div className="app-mark" aria-hidden="true">X</div>
          <div className="window-title">{documentFileName} - Liquid XAML Blend</div>
          <nav className="menu-strip" aria-label="Application menu">
            {designerChromeDefinition.menuItems.map((item) => (
              <button key={item.id} type="button">{resolveChromeLabel(item)}</button>
            ))}
          </nav>
        </div>
        <div className="command-strip">
          {designerChromeDefinition.commandItems.map((item) => {
            const handler = commandHandlers[item.id];

            return (
              <button
                key={item.id}
                className="toolbar-btn"
                type="button"
                onClick={handler?.onClick}
                disabled={handler?.disabled}
              >
                {resolveChromeLabel(item)}
              </button>
            );
          })}
          <span className="quick-launch">Quick Launch (Ctrl+Q)</span>
        </div>
      </header>

      <section className="blend-workspace">
        <LeftRail
          dockTabs={designerChromeDefinition.leftDockTabs}
          status={status}
          origin={origin}
          cameraView={cameraView}
          snapEnabled={snapEnabled}
          documentFileName={documentFileName}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={performUndo}
          onRedo={performRedo}
          onSaveDraft={saveDraftToStorage}
          onLoadDraft={loadDraftFromStorage}
          onImportFile={openDocumentFilePicker}
          onExportFile={() => void saveDocumentToFile()}
          onClearDraftStorage={clearDraftStorage}
          paletteTemplates={PALETTE_TEMPLATES}
          selectedTemplateId={selectedTemplateId}
          selectedTemplateTitle={selectedTemplate.title}
          canUseTemplateAsChild={(template) => canInsertTemplateIntoParent(template, selectedOrRootNode)}
          canUseTemplateAsSibling={(template) => !!selectedTreeItem?.parentId && canInsertTemplateIntoParent(template, siblingParentNode)}
          onSelectTemplate={(id) => setSelectedTemplateId(id as PaletteTemplateId)}
          selectedTreeNodeLabel={selectedTreeNode ? selectedTreeNode.type : 'Root canvas'}
          selectedTreeItemId={selectedTreeItem?.id ?? null}
          childTargetLabel={childTargetLabel}
          siblingTargetLabel={siblingTargetLabel}
          canAddChild={canAddChild}
          canAddSibling={canAddSibling}
          canDeleteSelected={canDeleteSelected}
          canReparentIn={canReparentIn}
          canReparentOut={canReparentOut}
          onAddChild={createChildElement}
          onAddSibling={createSiblingElement}
          onDeleteSelected={deleteSelectedElement}
          onNestIn={reparentSelectedIn}
          onMoveOut={reparentSelectedOut}
          treeItems={treeItems}
          selectedId={selectedId}
          treeDragSourceId={treeDragSourceId}
          treeDropTargetId={treeDropTargetId}
          treeDropIntent={treeDropIntent}
          onSelectElement={setSelection}
          onTreeDragStart={handleTreeDragStart}
          onTreeDragOver={handleTreeDragOver}
          onTreeDrop={handleTreeDrop}
          onTreeDragEnd={clearTreeDragState}
          imageAssets={imageAssets}
          selectedAssetId={selectedAssetId}
          onSelectAsset={setSelectedAssetId}
          onApplySelectedAsset={applySelectedAssetToSelection}
          onInsertSelectedAsset={insertSelectedAssetImage}
          onImportImageAsset={openImageAssetFilePicker}
          onRemoveSelectedImageAsset={removeSelectedImageAsset}
          canRemoveSelectedImageAsset={selectedAsset.kind === 'imported'}
          documentImageSources={documentImageSources}
          resolveImageTokenLabel={resolveImageTokenLabel}
          fontAssets={fontAssets}
          selectedFontId={selectedFontId}
          onSelectFont={(id) => {
            const font = findFontAsset(fontAssets, id);
            setSelectedFontId(id);
            setFontFamilyInput(font.family);
          }}
          onApplySelectedFont={applySelectedFontToSelection}
          onImportFontAsset={openFontAssetFilePicker}
          onRemoveSelectedFont={removeSelectedFont}
          canRemoveSelectedFont={selectedFont.kind === 'imported'}
          documentFontFamilies={documentFontFamilies}
          selectedAssetTitle={selectedAsset.title}
          selectedFontTitle={selectedFont.title}
          hoveredId={hoveredId}
          overlaySettings={overlaySettings}
          onOverlaySettingChange={updateOverlaySetting}
          isSelectedImageNode={isSelectedImageNode}
          isSelectedTextNode={isSelectedTextNode}
        />

        <section className="document-area">
          <div className="document-tabs">
            {designerChromeDefinition.documentTabs.map((tab) => (
              <button key={tab.id} className={`document-tab ${tab.isActive ? 'is-active' : ''}`} type="button">
                {resolveChromeLabel(tab)}
              </button>
            ))}
          </div>
          <section className="artboard-region" aria-label="Designer artboard">
            <div className="tool-strip" aria-label="Tools">
              {designerChromeDefinition.toolStrip.map((tool) => (
                <button
                  key={tool.id}
                  className={tool.isActive ? 'is-active' : ''}
                  type="button"
                  title={tool.label}
                >
                  {tool.glyph}
                </button>
              ))}
            </div>
            <div className="ruler-stage">
              <div className="ruler ruler-horizontal" aria-hidden="true" />
              <div className="ruler ruler-vertical" aria-hidden="true" />
              <Viewport
                canvasRef={canvasRef}
                snapEnabled={snapEnabled}
                gridStep={gridStep}
                gridOffsetX={gridOffsetX}
                gridOffsetY={gridOffsetY}
                overlaySettings={overlaySettings}
                overlayState={overlayState}
                onResizeHandlePointerDown={onResizeHandlePointerDown}
              />
            </div>
          </section>
          <SourcePane
            tabs={designerChromeDefinition.sourceTabs}
            documentFileName={documentFileName}
            sourceDraft={sourceDraft}
            sourceDirty={sourceDirty}
            sourceDiagnostic={sourceDiagnostic}
            canApplySource={canApplySource}
            onChangeSourceDraft={(value) => {
              setSourceDraft(value);
              setSourceDirty(true);
              setSourceDiagnostic(null);
            }}
            onApplySource={applySourceDraft}
            onRevertSourceDraft={revertSourceDraft}
          />
        </section>

        <Inspector
          dockTabs={designerChromeDefinition.inspectorTabs}
          selectedId={selectedId}
          selectedElement={selectedElement}
          isSelectedImageNode={isSelectedImageNode}
          isSelectedTextNode={isSelectedTextNode}
          xInput={xInput}
          yInput={yInput}
          widthInput={widthInput}
          heightInput={heightInput}
          colorInput={colorInput}
          onChangeX={setXInput}
          onChangeY={setYInput}
          onChangeWidth={setWidthInput}
          onChangeHeight={setHeightInput}
          onChangeColor={setColorInput}
          onCommitPosition={commitInspectorPosition}
          onCommitSize={commitInspectorSize}
          onCommitColor={commitInspectorColor}
          onResetElement={() => {
            const id = selectedIdRef.current;
            if (id) {
              executeResetElementCommand(id);
            }
          }}
          imageSourceInput={imageSourceInput}
          imageStretchInput={imageStretchInput}
          imageOpacityInput={imageOpacityInput}
          selectedImageNaturalSizeLabel={selectedImageNaturalSizeLabel}
          lockAspectRatio={lockAspectRatio}
          onChangeImageSource={setImageSourceInput}
          onChangeImageStretch={setImageStretchInput}
          onChangeImageOpacity={setImageOpacityInput}
          onCommitImage={commitImageSettings}
          onApplyNaturalImageSize={applyNaturalImageSize}
          onChangeLockAspectRatio={setLockAspectRatio}
          fontFamilyInput={fontFamilyInput}
          fontSizeInput={fontSizeAttrInput}
          fontWeightInput={fontWeightInput}
          fontStyleInput={fontStyleInput}
          textAlignmentInput={textAlignmentInput}
          flowDirectionInput={flowDirectionInput}
          onChangeFontFamily={setFontFamilyInput}
          onChangeFontSize={setFontSizeAttrInput}
          onChangeFontWeight={setFontWeightInput}
          onChangeFontStyle={setFontStyleInput}
          onChangeTextAlignment={setTextAlignmentInput}
          onChangeFlowDirection={setFlowDirectionInput}
          onCommitTypography={commitTypographySettings}
        />
      </section>

      <footer className="blend-statusbar">
        {designerChromeDefinition.statusSegments.map((segment) => (
          <span key={segment.id}>{resolveStatusText(segment)}</span>
        ))}
      </footer>
    </main>
  );
}
