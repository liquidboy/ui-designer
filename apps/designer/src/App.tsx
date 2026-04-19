import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createCameraState, worldToScreen } from '@ui-designer/designer-core';
import { createPropertySections, type PropertyField, type PropertySection } from '@ui-designer/designer-widgets';
import { WebGPUCanvasRenderer } from '@ui-designer/webgpu-renderer';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState('Initializing designer viewport...');
  const camera = useMemo(() => createCameraState(), []);
  const sections = useMemo(() => createPropertySections(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setStatus('Canvas unavailable.');
      return;
    }

    const renderer = new WebGPUCanvasRenderer(canvas);
    let frame = 0;

    renderer
      .initialize()
      .then(() => {
        setStatus('Infinite canvas online. Pan/zoom integration is ready for next iteration.');

        const tick = () => {
          renderer.resize();
          renderer.renderClear(0.07, 0.08, 0.1);
          frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to initialize viewport: ${reason}`);
      });

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [camera]);

  const origin = worldToScreen({ x: 0, y: 0 }, camera);

  return (
    <main className="designer-shell">
      <aside className="left-rail">
        <h1>Designer</h1>
        <p>{status}</p>
        <div className="origin">Screen origin: {origin.x.toFixed(0)}, {origin.y.toFixed(0)}</div>
      </aside>
      <section className="canvas-wrap">
        <canvas className="canvas" ref={canvasRef} />
      </section>
      <aside className="inspector">
        <h2>Inspector</h2>
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
