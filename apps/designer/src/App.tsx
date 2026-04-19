import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  CommandStack,
  createCameraState,
  screenToWorld,
  worldToScreen,
  type CameraState,
  type DesignerCommand
} from '@ui-designer/designer-core';
import { createPropertySections, type PropertyField, type PropertySection } from '@ui-designer/designer-widgets';
import { RuntimeHost } from '@ui-designer/ui-runtime-web';
import type { Point, UiElement } from '@ui-designer/ui-core';

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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<RuntimeHost | null>(null);
  const [status, setStatus] = useState('Initializing designer viewport...');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<UiElement | null>(null);
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [snapEnabled, setSnapEnabled] = useState(true);
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
  const dragLastWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeElementIdRef = useRef<string | null>(null);
  const resizeStartSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const resizeStartWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartCameraRef = useRef<CameraState>(cameraView);
  const sections = useMemo(() => createPropertySections(), []);
  const snapEnabledRef = useRef(snapEnabled);

  const snapValue = (value: number, enabled = snapEnabledRef.current) => {
    if (!enabled) {
      return value;
    }

    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const syncSelectedElement = () => {
    const runtime = runtimeRef.current;
    const id = selectedIdRef.current;

    if (!runtime || !id) {
      setSelectedElement(null);
      setXInput('');
      setYInput('');
      setWidthInput('');
      setHeightInput('');
      return;
    }

    const element = runtime.getElementById(id);
    setSelectedElement(element);

    if (element) {
      setXInput(element.layout.x.toFixed(0));
      setYInput(element.layout.y.toFixed(0));
      setWidthInput(element.layout.width.toFixed(0));
      setHeightInput(element.layout.height.toFixed(0));
    }
  };

  const executeMoveCommand = (elementId: string, from: Point, to: Point, label: string) => {
    if (from.x === to.x && from.y === to.y) {
      return;
    }

    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const command: DesignerCommand = {
      id: label,
      apply: () => {
        runtime.setElementOffset(elementId, to);
      },
      undo: () => {
        runtime.setElementOffset(elementId, from);
      }
    };

    commandStackRef.current.execute(command);
    syncSelectedElement();
  };

  const executeResizeCommand = (
    elementId: string,
    from: { width: number; height: number },
    to: { width: number; height: number },
    label: string
  ) => {
    if (from.width === to.width && from.height === to.height) {
      return;
    }

    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    const command: DesignerCommand = {
      id: label,
      apply: () => {
        runtime.setElementSize(elementId, to);
      },
      undo: () => {
        runtime.setElementSize(elementId, from);
      }
    };

    commandStackRef.current.execute(command);
    syncSelectedElement();
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

    const runtime = new RuntimeHost(canvas);
    runtimeRef.current = runtime;
    runtime.setCamera(cameraRef.current);

    runtime
      .boot({
        xaml: sampleXaml,
        canvas,
        onHoveredElementChange: setHoveredId,
        onSelectedElementChange: (id: string | null) => {
          selectedIdRef.current = id;
          setSelectedId(id);
          setSelectedElement(id ? runtime.getElementById(id) : null);
          if (id) {
            const element = runtime.getElementById(id);
            setXInput(element ? element.layout.x.toFixed(0) : '');
            setYInput(element ? element.layout.y.toFixed(0) : '');
            setWidthInput(element ? element.layout.width.toFixed(0) : '');
            setHeightInput(element ? element.layout.height.toFixed(0) : '');
          } else {
            setXInput('');
            setYInput('');
            setWidthInput('');
            setHeightInput('');
          }
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
        if (!runtime) {
          return;
        }

        const point = toCanvasPoint(event);
        const id = runtime.pickElementAtScreenPoint(point);
        if (!id) {
          return;
        }

        isDraggingRef.current = true;
        dragElementIdRef.current = id;
        dragStartOffsetRef.current = runtime.getElementOffset(id);
        const selected = runtime.getElementById(id);
        dragStartElementPositionRef.current = selected
          ? { x: selected.layout.x, y: selected.layout.y }
          : { x: 0, y: 0 };
        dragStartWorldRef.current = screenToWorld(point, cameraRef.current);
        dragLastWorldRef.current = screenToWorld(point, cameraRef.current);
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
        const runtime = runtimeRef.current;
        if (!runtime) {
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

        runtime.setElementSize(resizeElementIdRef.current, { width: nextWidth, height: nextHeight });

        if (selectedIdRef.current === resizeElementIdRef.current) {
          const updated = runtime.getElementById(resizeElementIdRef.current);
          setSelectedElement(updated ?? null);
          if (updated) {
            setXInput(updated.layout.x.toFixed(0));
            setYInput(updated.layout.y.toFixed(0));
            setWidthInput(updated.layout.width.toFixed(0));
            setHeightInput(updated.layout.height.toFixed(0));
          }
        }
        return;
      }

      if (isDraggingRef.current && dragElementIdRef.current) {
        const runtime = runtimeRef.current;
        if (!runtime) {
          return;
        }

        const point = toCanvasPoint(event);
        const world = screenToWorld(point, cameraRef.current);
        const previous = dragLastWorldRef.current;
        const dx = world.x - previous.x;
        const dy = world.y - previous.y;

        const id = dragElementIdRef.current;
        runtime.moveElementBy(id, { x: dx, y: dy });
        dragLastWorldRef.current = world;

        if (snapEnabledRef.current && !event.altKey) {
          const startWorld = dragStartWorldRef.current;
          const startOffset = dragStartOffsetRef.current;
          const startPosition = dragStartElementPositionRef.current;
          const unsnappedX = startPosition.x + (world.x - startWorld.x);
          const unsnappedY = startPosition.y + (world.y - startWorld.y);
          const snappedX = snapValue(unsnappedX, true);
          const snappedY = snapValue(unsnappedY, true);

          runtime.setElementOffset(id, {
            x: startOffset.x + (snappedX - startPosition.x),
            y: startOffset.y + (snappedY - startPosition.y)
          });
        }

        if (selectedIdRef.current === id) {
          const updated = runtime.getElementById(id);
          setSelectedElement(updated ?? null);
          if (updated) {
            setXInput(updated.layout.x.toFixed(0));
            setYInput(updated.layout.y.toFixed(0));
            setWidthInput(updated.layout.width.toFixed(0));
            setHeightInput(updated.layout.height.toFixed(0));
          }
        }
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
        if (runtime && id) {
          const from = resizeStartSizeRef.current;
          const selected = runtime.getElementById(id);
          const to = selected
            ? { width: selected.layout.width, height: selected.layout.height }
            : from;
          executeResizeCommand(id, from, to, 'handle-resize');
        }

        isResizingRef.current = false;
        resizeElementIdRef.current = null;
        canvas.classList.remove('is-resizing');
      }

      if (isDraggingRef.current) {
        const runtime = runtimeRef.current;
        const id = dragElementIdRef.current;
        if (runtime && id) {
          const from = dragStartOffsetRef.current;
          const to = runtime.getElementOffset(id);
          executeMoveCommand(id, from, to, 'drag-move');
        }

        isDraggingRef.current = false;
        dragElementIdRef.current = null;
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
        commandStackRef.current.undo();
        syncSelectedElement();
        return;
      }

      if (isRedoMac || isRedoWin) {
        event.preventDefault();
        commandStackRef.current.redo();
        syncSelectedElement();
        return;
      }

      if (isArrow) {
        const runtime = runtimeRef.current;
        const id = selectedIdRef.current;
        if (!runtime || !id) {
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

        const from = runtime.getElementOffset(id);
        const to = { x: from.x + dx, y: from.y + dy };
        executeMoveCommand(id, from, to, 'nudge-move');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [snapEnabled]);

  const commitInspectorPosition = () => {
    const runtime = runtimeRef.current;
    const id = selectedIdRef.current;

    if (!runtime || !id || !selectedElement) {
      return;
    }

    const nextX = Number.parseFloat(xInput);
    const nextY = Number.parseFloat(yInput);

    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      setXInput(selectedElement.layout.x.toFixed(0));
      setYInput(selectedElement.layout.y.toFixed(0));
      return;
    }

    const currentOffset = runtime.getElementOffset(id);
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

    executeMoveCommand(id, currentOffset, nextOffset, 'inspector-move');
  };

  const commitInspectorSize = () => {
    const runtime = runtimeRef.current;
    const id = selectedIdRef.current;

    if (!runtime || !id || !selectedElement) {
      return;
    }

    const nextWidth = Number.parseFloat(widthInput);
    const nextHeight = Number.parseFloat(heightInput);

    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight) || nextWidth <= 0 || nextHeight <= 0) {
      setWidthInput(selectedElement.layout.width.toFixed(0));
      setHeightInput(selectedElement.layout.height.toFixed(0));
      return;
    }

    executeResizeCommand(
      id,
      { width: selectedElement.layout.width, height: selectedElement.layout.height },
      { width: Math.max(24, snapValue(nextWidth)), height: Math.max(24, snapValue(nextHeight)) },
      'inspector-resize'
    );
  };

  const origin = worldToScreen({ x: 0, y: 0 }, cameraView);
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
    const canvas = canvasRef.current;
    const id = selectedIdRef.current;
    if (!runtime || !canvas || !id) {
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
          </section>
        ) : null}
        {sections.map((section: PropertySection) => (
          <section key={section.id} className="inspector-group">
            <h3>{section.title}</h3>
            {section.fields.map((field: PropertyField) => (
              <label key={field.key} className="field">
                <span>{field.label}</span>
                <input readOnly value={String(field.value)} />
              </label>
            ))}
          </section>
        ))}
      </aside>
    </main>
  );
}
