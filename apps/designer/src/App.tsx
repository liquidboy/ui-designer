import { useEffect, useRef, useState } from 'preact/hooks';
import {
  CommandStack,
  buildDesignerTree,
  cloneXamlDocument,
  createCameraState,
  findDocumentNodeById,
  parseDesignerDocument,
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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<RuntimeHost | null>(null);
  const [status, setStatus] = useState('Initializing designer viewport...');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<UiElement | null>(null);
  const [documentXaml, setDocumentXaml] = useState(sampleXaml);
  const [treeItems, setTreeItems] = useState<ReturnType<typeof buildDesignerTree>>([]);
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

  const applyRenderedDocument = (document: DesignerDocument, commit: boolean) => {
    const runtime = runtimeRef.current;
    const nextXaml = serializeDesignerDocument(document);

    if (commit) {
      documentRef.current = cloneXamlDocument(document);
      setDocumentXaml(nextXaml);
      setTreeItems(buildDesignerTree(document));
    }

    if (!runtime) {
      return;
    }

    runtime.clearAllOverrides();
    runtime.setXaml(nextXaml);

    const currentSelectionId = selectedIdRef.current;
    const nextSelectionId =
      currentSelectionId && runtime.getElementById(currentSelectionId) ? currentSelectionId : null;
    runtime.setSelectedElement(nextSelectionId);
  };

  const applyCommittedDocument = (document: DesignerDocument, options?: { setAsBase?: boolean }) => {
    const committedDocument = cloneXamlDocument(document);

    if (options?.setAsBase) {
      baseDocumentRef.current = cloneXamlDocument(committedDocument);
    }

    applyRenderedDocument(committedDocument, true);
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

  const executeDocumentCommand = (label: string, nextDocument: DesignerDocument) => {
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
        applyCommittedDocument(afterDocument);
      },
      undo: () => {
        applyCommittedDocument(beforeDocument);
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

    try {
      const nextDocument = parseDesignerDocument(draftXaml);
      selectedIdRef.current = null;
      setSelectedId(null);
      applyCommittedDocument(nextDocument, { setAsBase: true });
      commandStackRef.current.clear();
      setHistoryVersion((value) => value + 1);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to load draft: ${reason}`);
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
      <aside className="left-rail">
        <h1>Designer</h1>
        <p>{status}</p>
        <div className="origin">Screen origin: {origin.x.toFixed(0)}, {origin.y.toFixed(0)}</div>
        <div className="origin">Camera: {cameraView.x.toFixed(0)}, {cameraView.y.toFixed(0)}</div>
        <div className="origin">Zoom: {(cameraView.zoom * 100).toFixed(0)}%</div>
        <div className="origin">Snap: {snapEnabled ? `On (${GRID_SIZE}px)` : 'Off'} (toggle: G)</div>
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
        <button className="toolbar-btn full-width" type="button" onClick={clearDraftFromStorage}>
          Clear Draft Storage
        </button>
        <section className="tree-panel">
          <h2>Component Tree</h2>
          <div className="tree-list" role="tree">
            {treeItems.map((item) => (
              <button
                key={item.id}
                className={`tree-item ${selectedId === item.id ? 'is-selected' : ''}`}
                style={{ paddingLeft: `${12 + item.depth * 16}px` }}
                type="button"
                onClick={() => selectElement(item.id)}
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
          <textarea className="source-preview" readOnly value={documentXaml} />
        </section>
      </aside>
    </main>
  );
}
