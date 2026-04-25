import { useEffect, useRef, useState } from 'preact/hooks';
import { RuntimeHost } from '@ui-designer/ui-runtime-web';

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SAMPLE_IMAGE_SOURCE = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0d1b2a" />
      <stop offset="100%" stop-color="#2256d6" />
    </linearGradient>
  </defs>
  <rect width="320" height="200" rx="24" fill="url(#sky)" />
  <circle cx="250" cy="56" r="34" fill="#ffd166" fill-opacity="0.88" />
  <path d="M44 152C84 96 132 76 198 88C232 94 260 112 286 144" fill="none" stroke="#f8fafc" stroke-width="18" stroke-linecap="round" />
  <rect x="48" y="42" width="108" height="18" rx="9" fill="#f8fafc" fill-opacity="0.4" />
  <rect x="48" y="72" width="82" height="14" rx="7" fill="#f8fafc" fill-opacity="0.28" />
</svg>
`);

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
          Text="{Binding Path=HeroTitle}"
        />
        <TextBlock
          Width="220"
          TextWrapping="Wrap"
          FlowDirection="RightToLeft"
          Text="مرحبا بالنص عبر WebGPU مع اتجاه من اليمين إلى اليسار."
        />
        <Button Width="176" TextTrimming="CharacterEllipsis" Content="{Binding Action.Label}" />
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
        dataContext: {
          HeroTitle: 'Hello WebGPU XAML now supports runtime binding, wrapped text, and styled glyph rendering.',
          Action: { Label: 'Launch a much longer action label' }
        },
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
