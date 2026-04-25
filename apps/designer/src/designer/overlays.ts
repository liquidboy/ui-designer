import type { CameraState } from '@ui-designer/designer-core';
import { getImageNaturalSize, inferTextDirection, type UiElement } from '@ui-designer/ui-core';
import type { XamlNode } from '@ui-designer/xaml-schema';
import { asFiniteNumber, isImageNode, isTextNode, readStringAttribute } from './document';

export interface DebugOverlaySettings {
  hover: boolean;
  parentBounds: boolean;
  layout: boolean;
  content: boolean;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportTextGuide {
  frame: ScreenRect;
  lineHeight: number;
  fontFamily: string;
  fontSize: number;
  directionLabel: string;
}

export interface ViewportImageGuide {
  frame: ScreenRect;
  mediaFrame: ScreenRect | null;
  naturalSizeLabel: string | null;
  stretchLabel: string;
  cropAxis: 'x' | 'y' | null;
  cropPercent: number;
}

export interface ViewportOverlayState {
  selectedRect: ScreenRect | null;
  hoveredRect: ScreenRect | null;
  parentRect: ScreenRect | null;
  selectionLabel: string | null;
  hoverLabel: string | null;
  layoutBadge: string | null;
  textGuide: ViewportTextGuide | null;
  imageGuide: ViewportImageGuide | null;
}

export const DEFAULT_DEBUG_OVERLAY_SETTINGS: DebugOverlaySettings = {
  hover: true,
  parentBounds: true,
  layout: true,
  content: true
};

function toScreenRect(
  layout: { x: number; y: number; width: number; height: number },
  camera: CameraState
): ScreenRect {
  return {
    x: (layout.x - camera.x) * camera.zoom,
    y: (layout.y - camera.y) * camera.zoom,
    width: Math.max(8, layout.width * camera.zoom),
    height: Math.max(8, layout.height * camera.zoom)
  };
}

function insetRect(rect: ScreenRect, insets: { top: number; right: number; bottom: number; left: number }): ScreenRect {
  return {
    x: rect.x + insets.left,
    y: rect.y + insets.top,
    width: Math.max(0, rect.width - insets.left - insets.right),
    height: Math.max(0, rect.height - insets.top - insets.bottom)
  };
}

function textGuideForSelection(
  selectedNode: XamlNode | null,
  selectedElement: UiElement | null,
  camera: CameraState
): ViewportTextGuide | null {
  if (!selectedNode || !selectedElement || !isTextNode(selectedNode)) {
    return null;
  }

  const fontSize = Math.max(
    1,
    asFiniteNumber(selectedNode.attributes.FontSize) ?? (selectedNode.type.toLowerCase() === 'button' ? 15 : 16)
  );
  const lineHeight = Math.max(fontSize, asFiniteNumber(selectedNode.attributes.LineHeight) ?? Math.ceil(fontSize * 1.25));
  const insets = selectedNode.type.toLowerCase() === 'button'
    ? { top: 6, right: 14, bottom: 6, left: 14 }
    : { top: 4, right: 0, bottom: 4, left: 0 };
  const screenInsets = {
    top: insets.top * camera.zoom,
    right: insets.right * camera.zoom,
    bottom: insets.bottom * camera.zoom,
    left: insets.left * camera.zoom
  };
  const rect = insetRect(toScreenRect(selectedElement.layout, camera), screenInsets);
  const text =
    readStringAttribute(selectedNode, selectedNode.type.toLowerCase() === 'button' ? 'Content' : 'Text') ||
    readStringAttribute(selectedNode, 'Text');
  const flowDirection = readStringAttribute(selectedNode, 'FlowDirection').trim().toLowerCase();
  const inferredDirection = inferTextDirection(text || '');
  const directionLabel =
    flowDirection === 'righttoleft'
      ? 'RTL'
      : flowDirection === 'lefttoright'
        ? 'LTR'
        : `Auto -> ${inferredDirection.toUpperCase()}`;

  return {
    frame: rect,
    lineHeight: Math.max(1, lineHeight * camera.zoom),
    fontFamily: readStringAttribute(selectedNode, 'FontFamily') || 'system-ui, sans-serif',
    fontSize,
    directionLabel
  };
}

function imageGuideForSelection(
  selectedNode: XamlNode | null,
  selectedElement: UiElement | null,
  camera: CameraState
): ViewportImageGuide | null {
  if (!selectedNode || !selectedElement || !isImageNode(selectedNode)) {
    return null;
  }

  const source = readStringAttribute(selectedNode, 'Source').trim();
  const natural = source ? getImageNaturalSize(source) : null;
  const stretch = readStringAttribute(selectedNode, 'Stretch').trim() || 'UniformToFill';
  const frame = toScreenRect(selectedElement.layout, camera);
  const naturalSizeLabel = natural ? `${natural.width}x${natural.height}` : null;

  if (!natural || natural.width <= 0 || natural.height <= 0) {
    return {
      frame,
      mediaFrame: frame,
      naturalSizeLabel,
      stretchLabel: stretch,
      cropAxis: null,
      cropPercent: 0
    };
  }

  const boundsWidth = Math.max(1, selectedElement.layout.width);
  const boundsHeight = Math.max(1, selectedElement.layout.height);
  const imageAspect = natural.width / natural.height;
  const boundsAspect = boundsWidth / boundsHeight;
  let mediaFrame: ScreenRect | null = frame;
  let cropAxis: 'x' | 'y' | null = null;
  let cropPercent = 0;

  switch (stretch.toLowerCase()) {
    case 'uniform': {
      const scale = Math.min(boundsWidth / natural.width, boundsHeight / natural.height);
      const drawWidth = natural.width * scale;
      const drawHeight = natural.height * scale;
      mediaFrame = {
        x: frame.x + (boundsWidth - drawWidth) * 0.5 * camera.zoom,
        y: frame.y + (boundsHeight - drawHeight) * 0.5 * camera.zoom,
        width: Math.max(1, drawWidth * camera.zoom),
        height: Math.max(1, drawHeight * camera.zoom)
      };
      break;
    }
    case 'uniformtofill': {
      if (boundsAspect > imageAspect) {
        const visibleSourceHeight = natural.width / boundsAspect;
        cropAxis = 'y';
        cropPercent = Math.max(0, 1 - visibleSourceHeight / natural.height);
      } else {
        const visibleSourceWidth = natural.height * boundsAspect;
        cropAxis = 'x';
        cropPercent = Math.max(0, 1 - visibleSourceWidth / natural.width);
      }
      mediaFrame = frame;
      break;
    }
    case 'none': {
      const drawWidth = Math.min(boundsWidth, natural.width);
      const drawHeight = Math.min(boundsHeight, natural.height);
      mediaFrame = {
        x: frame.x,
        y: frame.y,
        width: Math.max(1, drawWidth * camera.zoom),
        height: Math.max(1, drawHeight * camera.zoom)
      };
      break;
    }
    case 'fill':
    default:
      mediaFrame = frame;
      break;
  }

  return {
    frame,
    mediaFrame,
    naturalSizeLabel,
    stretchLabel: stretch,
    cropAxis,
    cropPercent
  };
}

export function createViewportOverlayState(params: {
  camera: CameraState;
  selectedElement: UiElement | null;
  hoveredElement: UiElement | null;
  parentElement: UiElement | null;
  selectedNode: XamlNode | null;
}): ViewportOverlayState {
  const { camera, selectedElement, hoveredElement, parentElement, selectedNode } = params;
  const selectedRect = selectedElement ? toScreenRect(selectedElement.layout, camera) : null;
  const hoveredRect =
    hoveredElement && hoveredElement.id !== selectedElement?.id ? toScreenRect(hoveredElement.layout, camera) : null;
  const parentRect = parentElement ? toScreenRect(parentElement.layout, camera) : null;

  return {
    selectedRect,
    hoveredRect,
    parentRect,
    selectionLabel: selectedElement
      ? `${selectedElement.type} • ${Math.round(selectedElement.layout.width)}x${Math.round(selectedElement.layout.height)}`
      : null,
    hoverLabel: hoveredElement
      ? `${hoveredElement.type} • ${Math.round(hoveredElement.layout.width)}x${Math.round(hoveredElement.layout.height)}`
      : null,
    layoutBadge: selectedElement
      ? `x ${Math.round(selectedElement.layout.x)} • y ${Math.round(selectedElement.layout.y)}`
      : null,
    textGuide: textGuideForSelection(selectedNode, selectedElement, camera),
    imageGuide: imageGuideForSelection(selectedNode, selectedElement, camera)
  };
}
