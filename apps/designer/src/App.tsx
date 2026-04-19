import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createCameraState, screenToWorld, worldToScreen, type CameraState } from '@ui-designer/designer-core';
import { createPropertySections, type PropertyField, type PropertySection } from '@ui-designer/designer-widgets';
import { RuntimeHost } from '@ui-designer/ui-runtime-web';
import type { UiElement } from '@ui-designer/ui-core';

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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<RuntimeHost | null>(null);
  const [status, setStatus] = useState('Initializing designer viewport...');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<UiElement | null>(null);
  const [cameraView, setCameraView] = useState<CameraState>(() => createCameraState());
  const cameraRef = useRef<CameraState>(cameraView);
  const isPanningRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragElementIdRef = useRef<string | null>(null);
  const dragLastWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartCameraRef = useRef<CameraState>(cameraView);
  const sections = useMemo(() => createPropertySections(), []);

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
          setSelectedId(id);
          setSelectedElement(id ? runtime.getElementById(id) : null);
        }
      })
      .then(() => {
        setStatus('Design surface online. Left-drag to move, middle-drag to pan, wheel to zoom.');
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

        runtime.moveElementBy(dragElementIdRef.current, { x: dx, y: dy });
        dragLastWorldRef.current = world;

        if (selectedId === dragElementIdRef.current) {
          setSelectedElement(runtime.getElementById(selectedId) ?? null);
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
      if (isDraggingRef.current) {
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
    };
  }, []);

  const origin = worldToScreen({ x: 0, y: 0 }, cameraView);

  return (
    <main className="designer-shell">
      <aside className="left-rail">
        <h1>Designer</h1>
        <p>{status}</p>
        <div className="origin">Screen origin: {origin.x.toFixed(0)}, {origin.y.toFixed(0)}</div>
        <div className="origin">Camera: {cameraView.x.toFixed(0)}, {cameraView.y.toFixed(0)}</div>
        <div className="origin">Zoom: {(cameraView.zoom * 100).toFixed(0)}%</div>
        <div className="origin">Hover: {hoveredId ?? 'none'}</div>
        <div className="origin">Selected: {selectedId ?? 'none'}</div>
      </aside>
      <section className="canvas-wrap">
        <canvas className="canvas" ref={canvasRef} />
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
              <input readOnly value={selectedElement.layout.x.toFixed(0)} />
            </label>
            <label className="field">
              <span>Y</span>
              <input readOnly value={selectedElement.layout.y.toFixed(0)} />
            </label>
            <label className="field">
              <span>Width</span>
              <input readOnly value={selectedElement.layout.width.toFixed(0)} />
            </label>
            <label className="field">
              <span>Height</span>
              <input readOnly value={selectedElement.layout.height.toFixed(0)} />
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
