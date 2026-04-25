import { useEffect, useRef } from 'preact/hooks';
import { useSignalState } from '@ui-designer/ui-runtime-web';
import { WebGPURenderer } from './services/WebGPURenderer';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useSignalState('Initializing WebGPU...');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setStatus('Canvas unavailable.');
      return;
    }

    const renderer = new WebGPURenderer(canvas);

    renderer
      .initialize()
      .then((message) => {
        setStatus(message);
        renderer.start();
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        setStatus(`WebGPU initialization failed: ${reason}`);
      });

    return () => {
      renderer.stop();
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <h1>WebGPU UI Designer</h1>
        <p>{status}</p>
      </header>
      <section className="viewport-wrap">
        <canvas ref={canvasRef} className="viewport" />
      </section>
    </main>
  );
}
