import type { JSX } from 'preact';
import type { UiElement } from '@ui-designer/ui-core';
import type { DesignerChromeItem } from '../designer/chrome';
import type { DesignerPanelsDefinition } from '../designer/panels';

interface InspectorProps {
  dockTabs: readonly DesignerChromeItem[];
  groups: DesignerPanelsDefinition['inspectorGroups'];
  selectedId: string | null;
  selectedElement: UiElement | null;
  isSelectedImageNode: boolean;
  isSelectedTextNode: boolean;
  xInput: string;
  yInput: string;
  widthInput: string;
  heightInput: string;
  colorInput: string;
  onChangeX: (value: string) => void;
  onChangeY: (value: string) => void;
  onChangeWidth: (value: string) => void;
  onChangeHeight: (value: string) => void;
  onChangeColor: (value: string) => void;
  onCommitPosition: () => void;
  onCommitSize: () => void;
  onCommitColor: () => void;
  onResetElement: () => void;
  imageSourceInput: string;
  imageStretchInput: string;
  imageOpacityInput: string;
  selectedImageNaturalSizeLabel: string;
  lockAspectRatio: boolean;
  onChangeImageSource: (value: string) => void;
  onChangeImageStretch: (value: string) => void;
  onChangeImageOpacity: (value: string) => void;
  onCommitImage: () => void;
  onApplyNaturalImageSize: () => void;
  onChangeLockAspectRatio: (value: boolean) => void;
  fontFamilyInput: string;
  fontSizeInput: string;
  fontWeightInput: string;
  fontStyleInput: string;
  textAlignmentInput: string;
  flowDirectionInput: string;
  onChangeFontFamily: (value: string) => void;
  onChangeFontSize: (value: string) => void;
  onChangeFontWeight: (value: string) => void;
  onChangeFontStyle: (value: string) => void;
  onChangeTextAlignment: (value: string) => void;
  onChangeFlowDirection: (value: string) => void;
  onCommitTypography: () => void;
}

function onEnter(event: JSX.TargetedKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, commit: () => void): void {
  if (event.key === 'Enter') {
    commit();
  }
}

export function Inspector(props: InspectorProps) {
  const {
    dockTabs,
    groups,
    selectedId,
    selectedElement,
    isSelectedImageNode,
    isSelectedTextNode,
    xInput,
    yInput,
    widthInput,
    heightInput,
    colorInput,
    onChangeX,
    onChangeY,
    onChangeWidth,
    onChangeHeight,
    onChangeColor,
    onCommitPosition,
    onCommitSize,
    onCommitColor,
    onResetElement,
    imageSourceInput,
    imageStretchInput,
    imageOpacityInput,
    selectedImageNaturalSizeLabel,
    lockAspectRatio,
    onChangeImageSource,
    onChangeImageStretch,
    onChangeImageOpacity,
    onCommitImage,
    onApplyNaturalImageSize,
    onChangeLockAspectRatio,
    fontFamilyInput,
    fontSizeInput,
    fontWeightInput,
    fontStyleInput,
    textAlignmentInput,
    flowDirectionInput,
    onChangeFontFamily,
    onChangeFontSize,
    onChangeFontWeight,
    onChangeFontStyle,
    onChangeTextAlignment,
    onChangeFlowDirection,
    onCommitTypography
  } = props;

  return (
    <aside className="inspector">
      <div className="dock-tabs" role="tablist" aria-label="Inspector panels">
        {dockTabs.map((tab) => (
          <button key={tab.id} className={`dock-tab ${tab.isActive ? 'is-active' : ''}`} type="button">
            {tab.label}
          </button>
        ))}
      </div>
      <div className="property-target">
        <span className="target-icon" aria-hidden="true" />
        <div>
          <span className="target-label">Name</span>
          <strong>{selectedId ?? '<No Name>'}</strong>
        </div>
        <div>
          <span className="target-label">Type</span>
          <strong>{selectedElement?.type ?? 'No selection'}</strong>
        </div>
      </div>
      {selectedElement ? (
        <section className="inspector-group">
          <h3>{groups.element.title}</h3>
          <label className="field">
            <span>Type</span>
            <input readOnly value={selectedElement.type} />
          </label>
          <label className="field">
            <span>X</span>
            <input
              value={xInput}
              onInput={(event) => onChangeX((event.target as HTMLInputElement).value)}
              onBlur={onCommitPosition}
              onKeyDown={(event) => onEnter(event, onCommitPosition)}
            />
          </label>
          <label className="field">
            <span>Y</span>
            <input
              value={yInput}
              onInput={(event) => onChangeY((event.target as HTMLInputElement).value)}
              onBlur={onCommitPosition}
              onKeyDown={(event) => onEnter(event, onCommitPosition)}
            />
          </label>
          <label className="field">
            <span>Width</span>
            <input
              value={widthInput}
              onInput={(event) => onChangeWidth((event.target as HTMLInputElement).value)}
              onBlur={onCommitSize}
              onKeyDown={(event) => onEnter(event, onCommitSize)}
            />
          </label>
          <label className="field">
            <span>Height</span>
            <input
              value={heightInput}
              onInput={(event) => onChangeHeight((event.target as HTMLInputElement).value)}
              onBlur={onCommitSize}
              onKeyDown={(event) => onEnter(event, onCommitSize)}
            />
          </label>
          <label className="field">
            <span>Color</span>
            <input
              value={colorInput}
              onInput={(event) => onChangeColor((event.target as HTMLInputElement).value)}
              onBlur={onCommitColor}
              onKeyDown={(event) => onEnter(event, onCommitColor)}
            />
          </label>
          <button className="toolbar-btn full-width" type="button" onClick={onResetElement}>
            Reset Element Edits
          </button>
        </section>
      ) : null}

      {selectedElement && isSelectedImageNode ? (
        <section className="inspector-group">
          <h3>{groups.image.title}</h3>
          <p className="source-caption">Natural size: {selectedImageNaturalSizeLabel}</p>
          <label className="field">
            <span>Source</span>
            <input
              value={imageSourceInput}
              onInput={(event) => onChangeImageSource((event.target as HTMLInputElement).value)}
              onBlur={onCommitImage}
              onKeyDown={(event) => onEnter(event, onCommitImage)}
            />
          </label>
          <label className="field">
            <span>Stretch</span>
            <select
              value={imageStretchInput}
              onInput={(event) => onChangeImageStretch((event.target as HTMLSelectElement).value)}
              onBlur={onCommitImage}
            >
              <option value="Fill">Fill</option>
              <option value="Uniform">Uniform</option>
              <option value="UniformToFill">UniformToFill</option>
              <option value="None">None</option>
            </select>
          </label>
          <label className="field">
            <span>Opacity</span>
            <input
              value={imageOpacityInput}
              onInput={(event) => onChangeImageOpacity((event.target as HTMLInputElement).value)}
              onBlur={onCommitImage}
              onKeyDown={(event) => onEnter(event, onCommitImage)}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={lockAspectRatio}
              onInput={(event) => onChangeLockAspectRatio((event.target as HTMLInputElement).checked)}
            />
            <span>Preserve aspect ratio while resizing</span>
          </label>
          <div className="toolbar-row">
            <button className="toolbar-btn" type="button" onClick={onCommitImage}>
              Apply Image
            </button>
            <button className="toolbar-btn" type="button" onClick={onApplyNaturalImageSize}>
              Use Natural Size
            </button>
          </div>
        </section>
      ) : null}

      {selectedElement && isSelectedTextNode ? (
        <section className="inspector-group">
          <h3>{groups.typography.title}</h3>
          <label className="field">
            <span>Font Family</span>
            <input
              value={fontFamilyInput}
              onInput={(event) => onChangeFontFamily((event.target as HTMLInputElement).value)}
              onBlur={onCommitTypography}
              onKeyDown={(event) => onEnter(event, onCommitTypography)}
            />
          </label>
          <label className="field">
            <span>Font Size</span>
            <input
              value={fontSizeInput}
              onInput={(event) => onChangeFontSize((event.target as HTMLInputElement).value)}
              onBlur={onCommitTypography}
              onKeyDown={(event) => onEnter(event, onCommitTypography)}
            />
          </label>
          <label className="field">
            <span>Font Weight</span>
            <input
              value={fontWeightInput}
              onInput={(event) => onChangeFontWeight((event.target as HTMLInputElement).value)}
              onBlur={onCommitTypography}
              onKeyDown={(event) => onEnter(event, onCommitTypography)}
            />
          </label>
          <label className="field">
            <span>Font Style</span>
            <select
              value={fontStyleInput}
              onInput={(event) => onChangeFontStyle((event.target as HTMLSelectElement).value)}
              onBlur={onCommitTypography}
            >
              <option value="Normal">Normal</option>
              <option value="Italic">Italic</option>
              <option value="Oblique">Oblique</option>
            </select>
          </label>
          <label className="field">
            <span>Text Alignment</span>
            <select
              value={textAlignmentInput}
              onInput={(event) => onChangeTextAlignment((event.target as HTMLSelectElement).value)}
              onBlur={onCommitTypography}
            >
              <option value="Left">Left</option>
              <option value="Center">Center</option>
              <option value="Right">Right</option>
            </select>
          </label>
          <label className="field">
            <span>Flow Direction</span>
            <select
              value={flowDirectionInput}
              onInput={(event) => onChangeFlowDirection((event.target as HTMLSelectElement).value)}
              onBlur={onCommitTypography}
            >
              <option value="Auto">Auto</option>
              <option value="LeftToRight">LeftToRight</option>
              <option value="RightToLeft">RightToLeft</option>
            </select>
          </label>
          <button className="toolbar-btn full-width" type="button" onClick={onCommitTypography}>
            Apply Typography
          </button>
        </section>
      ) : null}
    </aside>
  );
}
