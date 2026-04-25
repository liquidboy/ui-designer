import { ensureImageNaturalSize } from '@ui-designer/ui-core';
import { BUILTIN_FONT_ASSETS, BUILTIN_IMAGE_ASSETS, type DesignerFontAsset, type DesignerImageAsset } from './presets';

export interface DesignerFontFaceDefinition {
  family: string;
  source: string;
  weight?: string | number;
  style?: string;
}

const DEFAULT_IMPORTED_IMAGE_BACKGROUND = '#101823';
const MAX_INSERT_IMAGE_SIZE = { width: 360, height: 240 };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}.`));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Failed to read ${file.name} as a data URL.`));
        return;
      }

      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function normalizeFileStem(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '').trim();
  return stem || 'Imported Resource';
}

function titleCase(input: string): string {
  return input
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function createImportedId(prefix: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'resource';
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  return `${prefix}-${slug}-${unique}`;
}

function inferFontWeight(fileName: string): string | undefined {
  const normalized = fileName.toLowerCase();
  if (normalized.includes('thin')) return '100';
  if (normalized.includes('extralight') || normalized.includes('ultralight')) return '200';
  if (normalized.includes('light')) return '300';
  if (normalized.includes('medium')) return '500';
  if (normalized.includes('semibold') || normalized.includes('demibold')) return '600';
  if (normalized.includes('extrabold') || normalized.includes('ultrabold')) return '800';
  if (normalized.includes('black') || normalized.includes('heavy')) return '900';
  if (normalized.includes('bold')) return '700';
  return undefined;
}

function inferFontStyle(fileName: string): string | undefined {
  const normalized = fileName.toLowerCase();
  if (normalized.includes('italic')) {
    return 'italic';
  }

  if (normalized.includes('oblique')) {
    return 'oblique';
  }

  return undefined;
}

function normalizeFontFaceSource(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('url(')) {
    return trimmed;
  }

  return `url("${trimmed.replace(/"/g, '\\"')}")`;
}

export function buildImageLibrary(customAssets: readonly DesignerImageAsset[]): DesignerImageAsset[] {
  return [...BUILTIN_IMAGE_ASSETS, ...customAssets];
}

export function buildFontLibrary(customFonts: readonly DesignerFontAsset[]): DesignerFontAsset[] {
  return [...BUILTIN_FONT_ASSETS, ...customFonts];
}

export async function importImageAssetFiles(files: readonly File[]): Promise<DesignerImageAsset[]> {
  const assets = await Promise.all(
    files.map(async (file) => {
      const title = titleCase(normalizeFileStem(file.name));
      const source = await readFileAsDataUrl(file);
      await ensureImageNaturalSize(source);
      return {
        id: createImportedId('image', title),
        kind: 'imported' as const,
        title,
        description: `Imported from ${file.name}`,
        source,
        background: DEFAULT_IMPORTED_IMAGE_BACKGROUND,
        originLabel: 'Imported'
      };
    })
  );

  return mergeImageAssets([], assets);
}

export async function importFontAssetFiles(files: readonly File[]): Promise<DesignerFontAsset[]> {
  const fonts = await Promise.all(
    files.map(async (file) => {
      const title = titleCase(normalizeFileStem(file.name));
      const source = await readFileAsDataUrl(file);
      return {
        id: createImportedId('font', title),
        kind: 'imported' as const,
        title,
        family: title,
        sample: 'Sphinx of black quartz, judge my vow.',
        note: `Imported from ${file.name}`,
        originLabel: 'Imported',
        source,
        weight: inferFontWeight(file.name),
        style: inferFontStyle(file.name)
      };
    })
  );

  return mergeFontAssets([], fonts);
}

export function mergeImageAssets(
  currentAssets: readonly DesignerImageAsset[],
  incomingAssets: readonly DesignerImageAsset[]
): DesignerImageAsset[] {
  const bySource = new Map<string, DesignerImageAsset>();
  for (const asset of [...currentAssets, ...incomingAssets]) {
    bySource.set(asset.source, asset);
  }
  return Array.from(bySource.values());
}

export function mergeFontAssets(
  currentFonts: readonly DesignerFontAsset[],
  incomingFonts: readonly DesignerFontAsset[]
): DesignerFontAsset[] {
  const byKey = new Map<string, DesignerFontAsset>();
  for (const font of [...currentFonts, ...incomingFonts]) {
    byKey.set(`${font.family}\u0000${font.source ?? ''}`, font);
  }
  return Array.from(byKey.values());
}

export function fontAssetToFaceDefinition(font: DesignerFontAsset): DesignerFontFaceDefinition | null {
  if (!font.source) {
    return null;
  }

  return {
    family: font.family,
    source: normalizeFontFaceSource(font.source),
    weight: font.weight,
    style: font.style
  };
}

export function fontAssetsToFaceDefinitions(fonts: readonly DesignerFontAsset[]): DesignerFontFaceDefinition[] {
  return fonts
    .map((font) => fontAssetToFaceDefinition(font))
    .filter((definition): definition is DesignerFontFaceDefinition => definition !== null && definition.source.length > 0);
}

export async function resolveImageInsertionSize(source: string): Promise<{ width: number; height: number }> {
  const natural = await ensureImageNaturalSize(source);
  if (!natural) {
    return { width: 220, height: 140 };
  }

  const scale = Math.min(
    1,
    MAX_INSERT_IMAGE_SIZE.width / Math.max(1, natural.width),
    MAX_INSERT_IMAGE_SIZE.height / Math.max(1, natural.height)
  );

  return {
    width: Math.max(24, Math.round(natural.width * scale)),
    height: Math.max(24, Math.round(natural.height * scale))
  };
}
