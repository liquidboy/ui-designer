import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createCameraState, worldToScreen } from '@ui-designer/designer-core';
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
  const camera = useMemo(() => createCameraState(), []);
  const sections = useMemo(() => createPropertySections(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setStatus('Canvas unavailable.');
      return;
    }

    const runtime = new RuntimeHost(canvas);
    runtimeRef.current = runtime;

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
        setStatus('Design surface online. Hover or click any rendered element.');
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
  }, [camera]);

  const origin = worldToScreen({ x: 0, y: 0 }, camera);

  return (
    <main className="designer-shell">
      <aside className="left-rail">
        <h1>Designer</h1>
        <p>{status}</p>
        <div className="origin">Screen origin: {origin.x.toFixed(0)}, {origin.y.toFixed(0)}</div>
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
