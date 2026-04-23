import { useEffect, useRef, useState } from 'preact/hooks';
import { RuntimeHost } from '@ui-designer/ui-runtime-web';

const SAMPLE_IMAGE_SOURCE =
  'data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 320 200%27%3E%3Cdefs%3E%3ClinearGradient id=%27g%27 x1=%270%27 x2=%271%27 y1=%270%27 y2=%271%27%3E%3Cstop offset=%270%25%27 stop-color=%27%230d1b2a%27/%3E%3Cstop offset=%27100%25%27 stop-color=%27%232256d6%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%27320%27 height=%27200%27 rx=%2724%27 fill=%27url(%23g)%27/%3E%3Ccircle cx=%27250%27 cy=%2756%27 r=%2734%27 fill=%27%23ffd166%27 fill-opacity=%270.88%27/%3E%3Cpath d=%27M44 152C84 96 132 76 198 88C232 94 260 112 286 144%27 fill=%27none%27 stroke=%27%23f8fafc%27 stroke-width=%2718%27 stroke-linecap=%27round%27/%3E%3Crect x=%2748%27 y=%2742%27 width=%27108%27 height=%2718%27 rx=%279%27 fill=%27%23f8fafc%27 fill-opacity=%270.4%27/%3E%3Crect x=%2748%27 y=%2772%27 width=%2782%27 height=%2714%27 rx=%277%27 fill=%27%23f8fafc%27 fill-opacity=%270.28%27/%3E%3C/svg%3E';

const sampleXaml = `
<Canvas Width="1280" Height="720">
  <Grid Rows="2" Columns="2" Width="760" Height="460" X="40" Y="40">
    <Border Grid.Row="0" Grid.Column="0" Background="#1f2937" Padding="12">
      <StackPanel Spacing="10">
        <TextBlock
          Width="220"
          TextWrapping="Wrap"
          FontStyle="Italic"
          FontFamily="Georgia"
          Text="Hello WebGPU XAML now supports wrapped text, fallback-aware font loading, and styled glyph rendering."
        />
        <Button Width="176" TextTrimming="CharacterEllipsis" Content="Launch a much longer action label" />
      </StackPanel>
    </Border>
    <Image Grid.Row="0" Grid.Column="1" Source="${SAMPLE_IMAGE_SOURCE}" Stretch="UniformToFill" Background="#111923" />
    <Rectangle Grid.Row="1" Grid.Column="0" Fill="#ff7b5b" />
    <Rectangle Grid.Row="1" Grid.Column="1" Fill="#40c89a" />
  </Grid>
</Canvas>
`;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<RuntimeHost | null>(null);
  const [status, setStatus] = useState('Booting runtime...');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        onSelectedElementChange: setSelectedId
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
        <p>Hover: {hoveredId ?? 'none'}</p>
        <p>Selected: {selectedId ?? 'none'}</p>
      </header>
      <section className="viewport-wrap">
        <canvas ref={canvasRef} className="viewport" />
      </section>
    </main>
  );
}
