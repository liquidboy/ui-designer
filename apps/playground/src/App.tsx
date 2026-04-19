import { useEffect, useRef, useState } from 'preact/hooks';
import { RuntimeHost } from '@ui-designer/ui-runtime-web';

const sampleXaml = `
<Canvas Width="1280" Height="720">
  <StackPanel Width="320">
    <TextBlock Text="Hello WebGPU XAML" />
    <Button Content="Click me" />
  </StackPanel>
</Canvas>
`;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<RuntimeHost | null>(null);
  const [status, setStatus] = useState('Booting runtime...');

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
        canvas
      })
      .then(() => {
        setStatus('Runtime booted. Rendering XAML scene through WebGPU.');
        runtime.start();
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        setStatus(`Runtime failed: ${reason}`);
      });

    return () => {
      runtime.stop();
      runtimeRef.current = null;
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <h1>UI Runtime Playground</h1>
        <p>{status}</p>
      </header>
      <section className="viewport-wrap">
        <canvas ref={canvasRef} className="viewport" />
      </section>
    </main>
  );
}
