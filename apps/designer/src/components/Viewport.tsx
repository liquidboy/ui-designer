import type { JSX } from 'preact';
import type { DebugOverlaySettings, ViewportOverlayState } from '../designer/overlays';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const RESIZE_HANDLES: readonly { id: ResizeHandle; label: string }[] = [
  { id: 'nw', label: 'Resize from top left' },
  { id: 'n', label: 'Resize from top' },
  { id: 'ne', label: 'Resize from top right' },
  { id: 'e', label: 'Resize from right' },
  { id: 'se', label: 'Resize from bottom right' },
  { id: 's', label: 'Resize from bottom' },
  { id: 'sw', label: 'Resize from bottom left' },
  { id: 'w', label: 'Resize from left' }
];

interface ViewportProps {
  canvasRef: { current: HTMLCanvasElement | null };
  activeToolId: string;
  insertionPreview: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  } | null;
  snapEnabled: boolean;
  gridStep: number;
  gridOffsetX: number;
  gridOffsetY: number;
  overlaySettings: DebugOverlaySettings;
  overlayState: ViewportOverlayState;
  onResizeHandlePointerDown: (handle: ResizeHandle, event: JSX.TargetedPointerEvent<HTMLButtonElement>) => void;
}

export function Viewport(props: ViewportProps) {
  const {
    canvasRef,
    activeToolId,
    insertionPreview,
    snapEnabled,
    gridStep,
    gridOffsetX,
    gridOffsetY,
    overlaySettings,
    overlayState,
    onResizeHandlePointerDown
  } = props;

  return (
    <section className="canvas-wrap">
      <div className="viewport-layer">
        <div
          className={`grid-overlay ${snapEnabled ? 'is-visible' : ''}`}
          style={{
            backgroundSize: `${gridStep}px ${gridStep}px`,
            backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`
          }}
        />
        <canvas className="canvas" data-tool={activeToolId} ref={canvasRef} />

        {insertionPreview ? (
          <div
            className="insertion-preview"
            style={{
              left: `${insertionPreview.x}px`,
              top: `${insertionPreview.y}px`,
              width: `${insertionPreview.width}px`,
              height: `${insertionPreview.height}px`
            }}
          >
            <span className="overlay-chip insertion-chip">{insertionPreview.label}</span>
          </div>
        ) : null}

        {overlaySettings.parentBounds && overlayState.parentRect ? (
          <div
            className="parent-rect"
            style={{
              left: `${overlayState.parentRect.x}px`,
              top: `${overlayState.parentRect.y}px`,
              width: `${overlayState.parentRect.width}px`,
              height: `${overlayState.parentRect.height}px`
            }}
          >
            <span className="overlay-chip parent-chip">Parent bounds</span>
          </div>
        ) : null}

        {overlaySettings.hover && overlayState.hoveredRect ? (
          <div
            className="hover-rect"
            style={{
              left: `${overlayState.hoveredRect.x}px`,
              top: `${overlayState.hoveredRect.y}px`,
              width: `${overlayState.hoveredRect.width}px`,
              height: `${overlayState.hoveredRect.height}px`
            }}
          >
            {overlayState.hoverLabel ? <span className="overlay-chip hover-chip">{overlayState.hoverLabel}</span> : null}
          </div>
        ) : null}

        {overlaySettings.content && overlayState.textGuide ? (
          <div
            className="text-guide"
            style={{
              left: `${overlayState.textGuide.frame.x}px`,
              top: `${overlayState.textGuide.frame.y}px`,
              width: `${overlayState.textGuide.frame.width}px`,
              height: `${overlayState.textGuide.frame.height}px`
            }}
          >
            <div
              className="text-guide-lines"
              style={{
                backgroundSize: `100% ${Math.max(6, overlayState.textGuide.lineHeight)}px`
              }}
            />
            <span className="overlay-chip text-chip">
              {overlayState.textGuide.directionLabel} • {overlayState.textGuide.fontSize}px • {overlayState.textGuide.fontFamily}
            </span>
          </div>
        ) : null}

        {overlaySettings.content && overlayState.imageGuide ? (
          <div
            className="image-guide"
            style={{
              left: `${overlayState.imageGuide.frame.x}px`,
              top: `${overlayState.imageGuide.frame.y}px`,
              width: `${overlayState.imageGuide.frame.width}px`,
              height: `${overlayState.imageGuide.frame.height}px`
            }}
          >
            {overlayState.imageGuide.mediaFrame ? (
              <div
                className={`image-media-frame ${overlayState.imageGuide.cropAxis ? 'is-cropped' : ''}`}
                style={{
                  left: `${overlayState.imageGuide.mediaFrame.x - overlayState.imageGuide.frame.x}px`,
                  top: `${overlayState.imageGuide.mediaFrame.y - overlayState.imageGuide.frame.y}px`,
                  width: `${overlayState.imageGuide.mediaFrame.width}px`,
                  height: `${overlayState.imageGuide.mediaFrame.height}px`
                }}
              />
            ) : null}
            <span className="overlay-chip image-chip">
              {overlayState.imageGuide.stretchLabel}
              {overlayState.imageGuide.naturalSizeLabel ? ` • ${overlayState.imageGuide.naturalSizeLabel}` : ''}
              {overlayState.imageGuide.cropAxis ? ` • crop ${overlayState.imageGuide.cropAxis.toUpperCase()} ${Math.round(overlayState.imageGuide.cropPercent * 100)}%` : ''}
            </span>
          </div>
        ) : null}

        {overlaySettings.layout && overlayState.selectedRect ? (
          <div
            className="selection-rect"
            style={{
              left: `${overlayState.selectedRect.x}px`,
              top: `${overlayState.selectedRect.y}px`,
              width: `${overlayState.selectedRect.width}px`,
              height: `${overlayState.selectedRect.height}px`
            }}
          >
            {overlayState.selectionLabel ? <span className="overlay-chip selection-chip">{overlayState.selectionLabel}</span> : null}
            {overlayState.layoutBadge ? <span className="overlay-chip layout-chip">{overlayState.layoutBadge}</span> : null}
            {RESIZE_HANDLES.map((handle) => (
              <button
                key={handle.id}
                className={`resize-handle resize-handle-${handle.id}`}
                type="button"
                aria-label={handle.label}
                title={handle.label}
                onPointerDown={(event) => onResizeHandlePointerDown(handle.id, event)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
