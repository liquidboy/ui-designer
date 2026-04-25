import type { DesignerFontAsset, DesignerImageAsset } from './presets';

const DRAFT_STORAGE_KEY = 'ui-designer:document-draft:v1';
const CHROME_DRAFT_STORAGE_KEY = 'ui-designer:chrome-draft:v1';
const CHROME_APPLIED_STORAGE_KEY = 'ui-designer:chrome-applied:v1';
const PANELS_DRAFT_STORAGE_KEY = 'ui-designer:panels-draft:v1';
const PANELS_APPLIED_STORAGE_KEY = 'ui-designer:panels-applied:v1';
const CUSTOM_IMAGE_ASSET_STORAGE_KEY = 'ui-designer:custom-image-assets:v1';
const CUSTOM_FONT_ASSET_STORAGE_KEY = 'ui-designer:custom-font-assets:v1';

function readStorageValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort local persistence.
  }
}

function removeStorageValue(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Best-effort local persistence cleanup.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseJson<T>(key: string, map: (value: unknown) => T | null): T | null {
  const raw = readStorageValue(key);
  if (!raw) {
    return null;
  }

  try {
    return map(JSON.parse(raw));
  } catch {
    return null;
  }
}

function asImageAsset(value: unknown): DesignerImageAsset | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.source !== 'string' ||
    typeof value.background !== 'string' ||
    typeof value.originLabel !== 'string'
  ) {
    return null;
  }

  if (value.kind !== 'builtin' && value.kind !== 'imported') {
    return null;
  }

  return {
    id: value.id,
    kind: value.kind,
    title: value.title,
    description: value.description,
    source: value.source,
    background: value.background,
    originLabel: value.originLabel
  };
}

function asFontAsset(value: unknown): DesignerFontAsset | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.family !== 'string' ||
    typeof value.sample !== 'string' ||
    typeof value.note !== 'string' ||
    typeof value.originLabel !== 'string'
  ) {
    return null;
  }

  if (value.kind !== 'builtin' && value.kind !== 'imported') {
    return null;
  }

  return {
    id: value.id,
    kind: value.kind,
    title: value.title,
    family: value.family,
    sample: value.sample,
    note: value.note,
    originLabel: value.originLabel,
    source: typeof value.source === 'string' ? value.source : undefined,
    weight: typeof value.weight === 'string' || typeof value.weight === 'number' ? value.weight : undefined,
    style: typeof value.style === 'string' ? value.style : undefined
  };
}

export function readDraftXaml(): string | null {
  return readStorageValue(DRAFT_STORAGE_KEY);
}

export function writeDraftXaml(xaml: string): void {
  writeStorageValue(DRAFT_STORAGE_KEY, xaml);
}

export function clearDraftXaml(): void {
  removeStorageValue(DRAFT_STORAGE_KEY);
}

export function readChromeDraftXaml(): string | null {
  return readStorageValue(CHROME_DRAFT_STORAGE_KEY);
}

export function writeChromeDraftXaml(xaml: string): void {
  writeStorageValue(CHROME_DRAFT_STORAGE_KEY, xaml);
}

export function clearChromeDraftXaml(): void {
  removeStorageValue(CHROME_DRAFT_STORAGE_KEY);
}

export function readAppliedChromeXaml(): string | null {
  return readStorageValue(CHROME_APPLIED_STORAGE_KEY);
}

export function writeAppliedChromeXaml(xaml: string): void {
  writeStorageValue(CHROME_APPLIED_STORAGE_KEY, xaml);
}

export function clearAppliedChromeXaml(): void {
  removeStorageValue(CHROME_APPLIED_STORAGE_KEY);
}

export function readPanelsDraftXaml(): string | null {
  return readStorageValue(PANELS_DRAFT_STORAGE_KEY);
}

export function writePanelsDraftXaml(xaml: string): void {
  writeStorageValue(PANELS_DRAFT_STORAGE_KEY, xaml);
}

export function clearPanelsDraftXaml(): void {
  removeStorageValue(PANELS_DRAFT_STORAGE_KEY);
}

export function readAppliedPanelsXaml(): string | null {
  return readStorageValue(PANELS_APPLIED_STORAGE_KEY);
}

export function writeAppliedPanelsXaml(xaml: string): void {
  writeStorageValue(PANELS_APPLIED_STORAGE_KEY, xaml);
}

export function clearAppliedPanelsXaml(): void {
  removeStorageValue(PANELS_APPLIED_STORAGE_KEY);
}

export function readCustomImageAssets(): DesignerImageAsset[] {
  return (
    parseJson(CUSTOM_IMAGE_ASSET_STORAGE_KEY, (value) => {
      if (!Array.isArray(value)) {
        return null;
      }

      return value.map(asImageAsset).filter((asset): asset is DesignerImageAsset => asset !== null && asset.kind === 'imported');
    }) ?? []
  );
}

export function writeCustomImageAssets(assets: readonly DesignerImageAsset[]): void {
  writeStorageValue(
    CUSTOM_IMAGE_ASSET_STORAGE_KEY,
    JSON.stringify(assets.filter((asset) => asset.kind === 'imported'))
  );
}

export function readCustomFontAssets(): DesignerFontAsset[] {
  return (
    parseJson(CUSTOM_FONT_ASSET_STORAGE_KEY, (value) => {
      if (!Array.isArray(value)) {
        return null;
      }

      return value.map(asFontAsset).filter((asset): asset is DesignerFontAsset => asset !== null && asset.kind === 'imported');
    }) ?? []
  );
}

export function writeCustomFontAssets(fonts: readonly DesignerFontAsset[]): void {
  writeStorageValue(
    CUSTOM_FONT_ASSET_STORAGE_KEY,
    JSON.stringify(fonts.filter((font) => font.kind === 'imported'))
  );
}
