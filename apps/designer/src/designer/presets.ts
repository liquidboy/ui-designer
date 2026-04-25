import type { XamlNode } from '@ui-designer/xaml-schema';

export interface DesignerImageAsset {
  id: string;
  kind: 'builtin' | 'imported';
  title: string;
  description: string;
  source: string;
  background: string;
  originLabel: string;
}

export interface DesignerFontAsset {
  id: string;
  kind: 'builtin' | 'imported';
  title: string;
  family: string;
  sample: string;
  note: string;
  originLabel: string;
  source?: string;
  weight?: string | number;
  style?: string;
}

export type PaletteTemplateId =
  | 'accent-rectangle'
  | 'text-label'
  | 'image-frame'
  | 'primary-button'
  | 'content-stack'
  | 'metric-card'
  | 'swatch-grid'
  | 'section-frame';

export interface PaletteTemplate {
  id: PaletteTemplateId;
  title: string;
  description: string;
  accent: string;
  parentTypes?: readonly string[];
  build(index: number): XamlNode;
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const IMAGE_ASSET_HORIZON = svgDataUri(`
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

const IMAGE_ASSET_BLUEPRINT = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
  <rect width="320" height="200" rx="24" fill="#091119" />
  <rect x="26" y="26" width="268" height="148" rx="14" fill="none" stroke="#6fd3ff" stroke-width="4" stroke-opacity="0.35" />
  <path d="M52 64H268M52 100H268M52 136H268M92 38V162M160 38V162M228 38V162" stroke="#6fd3ff" stroke-width="2" stroke-opacity="0.22" />
  <path d="M86 138L132 84L176 110L232 62" fill="none" stroke="#ffd166" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="232" cy="62" r="10" fill="#ffd166" />
</svg>
`);

const IMAGE_ASSET_POSTER = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="poster" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#2a142f" />
      <stop offset="100%" stop-color="#a83d7a" />
    </linearGradient>
  </defs>
  <rect width="320" height="200" rx="24" fill="url(#poster)" />
  <rect x="38" y="34" width="92" height="132" rx="18" fill="#f8fafc" fill-opacity="0.12" />
  <circle cx="214" cy="74" r="42" fill="#ffcf7a" fill-opacity="0.95" />
  <path d="M72 150C108 116 152 102 198 108C232 112 260 126 286 148" fill="none" stroke="#f8fafc" stroke-width="16" stroke-linecap="round" />
  <rect x="160" y="40" width="96" height="18" rx="9" fill="#f8fafc" fill-opacity="0.42" />
  <rect x="160" y="68" width="74" height="12" rx="6" fill="#f8fafc" fill-opacity="0.28" />
</svg>
`);

export const GRID_SIZE = 8;
export const DEFAULT_FILE_NAME = 'designer-document.xaml';
export const DEFAULT_NODE_COLORS = ['#3472ff', '#ff8157', '#3fca9d', '#ffd166', '#6fd3ff', '#b88cff'] as const;

export const BUILTIN_IMAGE_ASSETS: readonly DesignerImageAsset[] = [
  {
    id: 'builtin-horizon',
    kind: 'builtin',
    title: 'Horizon',
    description: 'Soft hero art for product, landing, or dashboard compositions.',
    source: IMAGE_ASSET_HORIZON,
    background: '#101823',
    originLabel: 'Built-in'
  },
  {
    id: 'builtin-blueprint',
    kind: 'builtin',
    title: 'Blueprint',
    description: 'Diagram-like art with grid rhythm and strong contrast.',
    source: IMAGE_ASSET_BLUEPRINT,
    background: '#091119',
    originLabel: 'Built-in'
  },
  {
    id: 'builtin-poster',
    kind: 'builtin',
    title: 'Poster',
    description: 'Editorial-style art block for cards, promos, and showcases.',
    source: IMAGE_ASSET_POSTER,
    background: '#2a142f',
    originLabel: 'Built-in'
  }
] as const;

export const BUILTIN_FONT_ASSETS: readonly DesignerFontAsset[] = [
  {
    id: 'builtin-ui-sans',
    kind: 'builtin',
    title: 'UI Sans',
    family: '"Segoe UI", system-ui, sans-serif',
    sample: 'Fast readable product UI',
    note: 'Balanced default for controls and dashboards.',
    originLabel: 'Built-in'
  },
  {
    id: 'builtin-editorial-serif',
    kind: 'builtin',
    title: 'Editorial Serif',
    family: 'Georgia, "Times New Roman", serif',
    sample: 'Opinionated display copy',
    note: 'Good for headings and narrative blocks.',
    originLabel: 'Built-in'
  },
  {
    id: 'builtin-humanist-sans',
    kind: 'builtin',
    title: 'Humanist Sans',
    family: '"Avenir Next", "Segoe UI", sans-serif',
    sample: 'Warm expressive interface text',
    note: 'A softer alternative for labels and hero copy.',
    originLabel: 'Built-in'
  },
  {
    id: 'builtin-mono',
    kind: 'builtin',
    title: 'Mono',
    family: '"IBM Plex Mono", "SFMono-Regular", Menlo, monospace',
    sample: 'Structured metrics and code',
    note: 'Useful for inspector values and technical surfaces.',
    originLabel: 'Built-in'
  }
] as const;

function xamlNode(
  type: string,
  attributes: Record<string, string | number | boolean>,
  children: XamlNode[] = []
): XamlNode {
  return {
    type,
    attributes,
    children
  };
}

export const sampleXaml = `
<Canvas Width="1600" Height="1200">
  <Grid Rows="2" Columns="2" Width="980" Height="640" X="120" Y="80">
    <Border Grid.Row="0" Grid.Column="0" Background="#18222e" Padding="16">
      <StackPanel Spacing="12">
        <TextBlock FontStyle="Italic" FontFamily="Georgia" Text="Inspector-Driven Design Surface" />
        <TextBlock
          Width="260"
          TextWrapping="Wrap"
          Text="WebGPU text now wraps, clips, uses fallback-aware font loading, and shares the canvas with image-backed components."
        />
        <TextBlock
          Width="260"
          TextWrapping="Wrap"
          FlowDirection="RightToLeft"
          Text="مرحبا بالنص عبر WebGPU مع اتجاه من اليمين إلى اليسار داخل المصمم."
        />
        <Button Width="186" TextTrimming="CharacterEllipsis" Content="Primary Action with Extended Copy" />
      </StackPanel>
    </Border>
    <Image Grid.Row="0" Grid.Column="1" Source="${BUILTIN_IMAGE_ASSETS[0].source}" Stretch="UniformToFill" Background="#101823" />
    <Rectangle Grid.Row="1" Grid.Column="0" Fill="#ff8157" />
    <Rectangle Grid.Row="1" Grid.Column="1" Fill="#3fca9d" />
  </Grid>
</Canvas>
`;

export const PALETTE_TEMPLATES: readonly PaletteTemplate[] = [
  {
    id: 'accent-rectangle',
    title: 'Accent Rectangle',
    description: 'Simple visual block for wireframes, artwork, or emphasis.',
    accent: '#3472ff',
    build: (index) =>
      xamlNode('Rectangle', {
        Width: 160,
        Height: 96,
        Fill: DEFAULT_NODE_COLORS[index % DEFAULT_NODE_COLORS.length]
      })
  },
  {
    id: 'text-label',
    title: 'Text Label',
    description: 'Single-line copy block for headings or supporting text.',
    accent: '#6fd3ff',
    build: (index) =>
      xamlNode('TextBlock', {
        Text: `Label ${index + 1}`
      })
  },
  {
    id: 'image-frame',
    title: 'Image Frame',
    description: 'Image-backed block for hero art, thumbnails, or composition tests.',
    accent: '#ffd166',
    build: () =>
      xamlNode('Image', {
        Width: 220,
        Height: 140,
        Source: BUILTIN_IMAGE_ASSETS[0].source,
        Stretch: 'UniformToFill',
        Background: BUILTIN_IMAGE_ASSETS[0].background
      })
  },
  {
    id: 'primary-button',
    title: 'Primary Button',
    description: 'Action button with a strong default size and call-to-action label.',
    accent: '#3fca9d',
    build: (index) =>
      xamlNode('Button', {
        Content: `Action ${index + 1}`,
        Width: 152,
        Height: 40
      })
  },
  {
    id: 'content-stack',
    title: 'Content Stack',
    description: 'Headline, supporting copy, and a primary action in a vertical rhythm.',
    accent: '#b88cff',
    build: (index) =>
      xamlNode(
        'StackPanel',
        {
          Width: 260,
          Spacing: 10,
          Background: '#18222e'
        },
        [
          xamlNode('TextBlock', { Text: `Section ${index + 1}`, FontFamily: 'Georgia' }),
          xamlNode('TextBlock', {
            Width: 260,
            TextWrapping: 'Wrap',
            Text: 'Concise supporting copy for the selected design block with real wrapped text.'
          }),
          xamlNode('Button', {
            Content: 'Continue with a longer call to action',
            Width: 168,
            Height: 40,
            TextTrimming: 'CharacterEllipsis'
          })
        ]
      )
  },
  {
    id: 'metric-card',
    title: 'Metric Card',
    description: 'A bordered summary tile with a label and a large value.',
    accent: '#ff8157',
    build: (index) =>
      xamlNode(
        'Border',
        {
          Width: 240,
          Height: 132,
          Background: '#18222e',
          Padding: 16
        },
        [
          xamlNode('StackPanel', { Spacing: 10 }, [
            xamlNode('TextBlock', { Text: `Metric ${index + 1}` }),
            xamlNode('TextBlock', { Text: '128' })
          ])
        ]
      )
  },
  {
    id: 'swatch-grid',
    title: 'Swatch Grid',
    description: 'A compact 2x2 composition for testing nested layout and color systems.',
    accent: '#ffd166',
    build: (index) =>
      xamlNode(
        'Grid',
        {
          Width: 280,
          Height: 180,
          Rows: 2,
          Columns: 2,
          Background: '#18222e'
        },
        [
          xamlNode('Rectangle', {
            'Grid.Row': 0,
            'Grid.Column': 0,
            Fill: DEFAULT_NODE_COLORS[index % DEFAULT_NODE_COLORS.length]
          }),
          xamlNode('Rectangle', {
            'Grid.Row': 0,
            'Grid.Column': 1,
            Fill: DEFAULT_NODE_COLORS[(index + 1) % DEFAULT_NODE_COLORS.length]
          }),
          xamlNode('Rectangle', {
            'Grid.Row': 1,
            'Grid.Column': 0,
            Fill: DEFAULT_NODE_COLORS[(index + 2) % DEFAULT_NODE_COLORS.length]
          }),
          xamlNode('Rectangle', {
            'Grid.Row': 1,
            'Grid.Column': 1,
            Fill: DEFAULT_NODE_COLORS[(index + 3) % DEFAULT_NODE_COLORS.length]
          })
        ]
      )
  },
  {
    id: 'section-frame',
    title: 'Section Frame',
    description: 'Container block with a heading and room for nested content or imagery.',
    accent: '#6fd3ff',
    build: (index) =>
      xamlNode(
        'Border',
        {
          Width: 280,
          Height: 180,
          Background: '#111923',
          Padding: 18
        },
        [
          xamlNode('StackPanel', { Spacing: 12 }, [
            xamlNode('TextBlock', { Text: `Frame ${index + 1}` }),
            xamlNode('Image', {
              Width: 220,
              Height: 88,
              Source: BUILTIN_IMAGE_ASSETS[0].source,
              Stretch: 'UniformToFill',
              Background: DEFAULT_NODE_COLORS[(index + 4) % DEFAULT_NODE_COLORS.length]
            })
          ])
        ]
      )
  }
] as const;

export function findPaletteTemplate(templateId: string): PaletteTemplate {
  return PALETTE_TEMPLATES.find((template) => template.id === templateId) ?? PALETTE_TEMPLATES[0];
}

export function findImageAsset(assets: readonly DesignerImageAsset[], assetId: string): DesignerImageAsset {
  return assets.find((asset) => asset.id === assetId) ?? assets[0] ?? BUILTIN_IMAGE_ASSETS[0];
}

export function findFontAsset(fonts: readonly DesignerFontAsset[], fontId: string): DesignerFontAsset {
  return fonts.find((font) => font.id === fontId) ?? fonts[0] ?? BUILTIN_FONT_ASSETS[0];
}
