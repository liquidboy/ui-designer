import type { JSX } from 'preact';
import type { CameraState, DesignerTreeItem } from '@ui-designer/designer-core';
import type { DesignerChromeItem } from '../designer/chrome';
import type { DebugOverlaySettings } from '../designer/overlays';
import type { TreeDropIntent } from '../designer/document';
import type { DesignerPanelId, DesignerPanelsDefinition } from '../designer/panels';
import type { DesignerFontAsset, DesignerImageAsset, PaletteTemplate } from '../designer/presets';

interface DesignerVisualStateOption {
  id: string;
  label: string;
  description: string;
  accent: string;
}

interface LeftRailProps {
  dockTabs: readonly DesignerChromeItem[];
  activeDockTabId: string;
  onSelectDockTab: (id: string) => void;
  panels: DesignerPanelsDefinition['panels'];
  status: string;
  origin: { x: number; y: number };
  cameraView: CameraState;
  snapEnabled: boolean;
  documentFileName: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveDraft: () => void;
  onLoadDraft: () => void;
  onImportFile: () => void;
  onExportFile: () => void;
  onClearDraftStorage: () => void;
  paletteTemplates: readonly PaletteTemplate[];
  selectedTemplateId: string;
  selectedTemplateTitle: string;
  canUseTemplateAsChild: (template: PaletteTemplate) => boolean;
  canUseTemplateAsSibling: (template: PaletteTemplate) => boolean;
  onSelectTemplate: (id: string) => void;
  selectedTreeNodeLabel: string;
  selectedTreeItemId: string | null;
  childTargetLabel: string;
  siblingTargetLabel: string;
  canAddChild: boolean;
  canAddSibling: boolean;
  canDeleteSelected: boolean;
  canDuplicateSelected: boolean;
  canReparentIn: boolean;
  canReparentOut: boolean;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onNestIn: () => void;
  onMoveOut: () => void;
  treeItems: readonly DesignerTreeItem[];
  selectedId: string | null;
  treeDragSourceId: string | null;
  treeDropTargetId: string | null;
  treeDropIntent: TreeDropIntent | null;
  onSelectElement: (id: string) => void;
  onTreeDragStart: (itemId: string, event: JSX.TargetedDragEvent<HTMLButtonElement>) => void;
  onTreeDragOver: (itemId: string, event: JSX.TargetedDragEvent<HTMLButtonElement>) => void;
  onTreeDrop: (itemId: string, event: JSX.TargetedDragEvent<HTMLButtonElement>) => void;
  onTreeDragEnd: () => void;
  imageAssets: readonly DesignerImageAsset[];
  selectedAssetId: string;
  onSelectAsset: (id: string) => void;
  onApplySelectedAsset: () => void;
  onInsertSelectedAsset: () => void;
  onImportImageAsset: () => void;
  onRemoveSelectedImageAsset: () => void;
  canRemoveSelectedImageAsset: boolean;
  documentImageSources: readonly string[];
  resolveImageTokenLabel: (source: string, index: number) => string;
  fontAssets: readonly DesignerFontAsset[];
  selectedFontId: string;
  onSelectFont: (id: string) => void;
  onApplySelectedFont: () => void;
  onImportFontAsset: () => void;
  onRemoveSelectedFont: () => void;
  canRemoveSelectedFont: boolean;
  documentFontFamilies: readonly string[];
  selectedAssetTitle: string;
  selectedFontTitle: string;
  visualStates: readonly DesignerVisualStateOption[];
  selectedVisualStateId: string;
  isVisualStateRecording: boolean;
  canRecordVisualState: boolean;
  visualStateTargetLabel: string;
  onSelectVisualState: (id: string) => void;
  onToggleVisualStateRecording: () => void;
  hoveredId: string | null;
  overlaySettings: DebugOverlaySettings;
  onOverlaySettingChange: (key: keyof DebugOverlaySettings, value: boolean) => void;
  isSelectedImageNode: boolean;
  isSelectedTextNode: boolean;
}

export function LeftRail(props: LeftRailProps) {
  const {
    dockTabs,
    activeDockTabId,
    onSelectDockTab,
    panels,
    status,
    origin,
    cameraView,
    snapEnabled,
    documentFileName,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onSaveDraft,
    onLoadDraft,
    onImportFile,
    onExportFile,
    onClearDraftStorage,
    paletteTemplates,
    selectedTemplateId,
    selectedTemplateTitle,
    canUseTemplateAsChild,
    canUseTemplateAsSibling,
    onSelectTemplate,
    selectedTreeNodeLabel,
    selectedTreeItemId,
    childTargetLabel,
    siblingTargetLabel,
    canAddChild,
    canAddSibling,
    canDeleteSelected,
    canDuplicateSelected,
    canReparentIn,
    canReparentOut,
    onAddChild,
    onAddSibling,
    onDuplicateSelected,
    onDeleteSelected,
    onNestIn,
    onMoveOut,
    treeItems,
    selectedId,
    treeDragSourceId,
    treeDropTargetId,
    treeDropIntent,
    onSelectElement,
    onTreeDragStart,
    onTreeDragOver,
    onTreeDrop,
    onTreeDragEnd,
    imageAssets,
    selectedAssetId,
    onSelectAsset,
    onApplySelectedAsset,
    onInsertSelectedAsset,
    onImportImageAsset,
    onRemoveSelectedImageAsset,
    canRemoveSelectedImageAsset,
    documentImageSources,
    resolveImageTokenLabel,
    fontAssets,
    selectedFontId,
    onSelectFont,
    onApplySelectedFont,
    onImportFontAsset,
    onRemoveSelectedFont,
    canRemoveSelectedFont,
    documentFontFamilies,
    selectedAssetTitle,
    selectedFontTitle,
    visualStates,
    selectedVisualStateId,
    isVisualStateRecording,
    canRecordVisualState,
    visualStateTargetLabel,
    onSelectVisualState,
    onToggleVisualStateRecording,
    hoveredId,
    overlaySettings,
    onOverlaySettingChange,
    isSelectedImageNode,
    isSelectedTextNode
  } = props;
  const showPanel = (panelId: DesignerPanelId) => panels[panelId].dockTabId === activeDockTabId;

  return (
    <aside className="left-rail">
      <div className="dock-tabs" role="tablist" aria-label="Designer panels">
        {dockTabs.map((tab) => (
          <button
            key={tab.id}
            className={`dock-tab ${tab.id === activeDockTabId ? 'is-active' : ''}`}
            type="button"
            onClick={() => onSelectDockTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {showPanel('solution') ? (
        <>
          <h1>{panels.solution.title}</h1>
          <p>{status}</p>
          <div className="origin">Screen origin: {origin.x.toFixed(0)}, {origin.y.toFixed(0)}</div>
          <div className="origin">Camera: {cameraView.x.toFixed(0)}, {cameraView.y.toFixed(0)}</div>
          <div className="origin">Zoom: {(cameraView.zoom * 100).toFixed(0)}%</div>
          <div className="origin">Snap: {snapEnabled ? 'On (8px)' : 'Off'} (toggle: Shift+G)</div>
          <div className="origin">File: {documentFileName}</div>
          <div className="toolbar-row">
            <button className="toolbar-btn" type="button" onClick={onUndo} disabled={!canUndo}>
              Undo
            </button>
            <button className="toolbar-btn" type="button" onClick={onRedo} disabled={!canRedo}>
              Redo
            </button>
          </div>
          <div className="toolbar-row">
            <button className="toolbar-btn" type="button" onClick={onSaveDraft}>
              Save Draft
            </button>
            <button className="toolbar-btn" type="button" onClick={onLoadDraft}>
              Load Draft
            </button>
          </div>
          <div className="toolbar-row">
            <button className="toolbar-btn" type="button" onClick={onImportFile}>
              Import File
            </button>
            <button className="toolbar-btn" type="button" onClick={onExportFile}>
              Export File
            </button>
          </div>
          <button className="toolbar-btn full-width" type="button" onClick={onClearDraftStorage}>
            Clear Draft Storage
          </button>
        </>
      ) : null}

      {showPanel('palette') ? (
        <section className="palette-panel">
          <h2>{panels.palette.title}</h2>
          {panels.palette.caption ? <p className="tree-caption">{panels.palette.caption}</p> : null}
          <div className="palette-grid">
            {paletteTemplates.map((template) => {
              const childEnabled = canUseTemplateAsChild(template);
              const siblingEnabled = canUseTemplateAsSibling(template);

              return (
                <button
                  key={template.id}
                  className={`palette-card ${selectedTemplateId === template.id ? 'is-selected' : ''}`}
                  type="button"
                  onClick={() => onSelectTemplate(template.id)}
                >
                  <span className="palette-swatch" style={{ background: template.accent }} />
                  <span className="palette-title">{template.title}</span>
                  <span className="palette-description">{template.description}</span>
                  <span className="palette-meta">
                    {childEnabled ? 'Child OK' : 'Child blocked'} | {siblingEnabled ? 'Sibling OK' : 'Sibling blocked'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {showPanel('tree') ? (
        <section className="tree-panel">
          <h2>{panels.tree.title}</h2>
          <p className="tree-caption">
            Target: {selectedTreeNodeLabel}{selectedTreeItemId ? ` (${selectedTreeItemId})` : ''}
          </p>
          <p className="tree-caption">
            Template: {selectedTemplateTitle} | Child target: {childTargetLabel} | Sibling target: {siblingTargetLabel}
          </p>
          <div className="tree-toolbar">
            <div className="toolbar-row">
              <button className="toolbar-btn" type="button" onClick={onAddChild} disabled={!canAddChild}>
                Add Child
              </button>
              <button className="toolbar-btn" type="button" onClick={onAddSibling} disabled={!canAddSibling}>
                Add Sibling
              </button>
            </div>
            <div className="toolbar-row">
              <button className="toolbar-btn" type="button" onClick={onNestIn} disabled={!canReparentIn}>
                Nest In
              </button>
              <button className="toolbar-btn" type="button" onClick={onMoveOut} disabled={!canReparentOut}>
                Move Out
              </button>
            </div>
            <button className="toolbar-btn full-width" type="button" onClick={onDuplicateSelected} disabled={!canDuplicateSelected}>
              Duplicate Selected
            </button>
            <button className="toolbar-btn full-width" type="button" onClick={onDeleteSelected} disabled={!canDeleteSelected}>
              Delete Selected
            </button>
          </div>
          <div className="tree-list" role="tree">
            {treeItems.map((item) => (
              <button
                key={item.id}
                className={`tree-item ${selectedId === item.id ? 'is-selected' : ''} ${
                  treeDragSourceId === item.id ? 'is-drag-source' : ''
                } ${treeDropTargetId === item.id && treeDropIntent === 'before' ? 'drop-before' : ''} ${
                  treeDropTargetId === item.id && treeDropIntent === 'inside' ? 'drop-inside' : ''
                } ${treeDropTargetId === item.id && treeDropIntent === 'after' ? 'drop-after' : ''}`}
                style={{ paddingLeft: `${12 + item.depth * 16}px` }}
                type="button"
                draggable={item.id !== 'root.0'}
                onClick={() => onSelectElement(item.id)}
                onDragStart={(event) => onTreeDragStart(item.id, event)}
                onDragOver={(event) => onTreeDragOver(item.id, event)}
                onDrop={(event) => onTreeDrop(item.id, event)}
                onDragEnd={onTreeDragEnd}
              >
                <span className="tree-type">{item.type}</span>
                <span className="tree-label">{item.label}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showPanel('assets') ? (
        <section className="library-panel">
        <h2>{panels.assets.title}</h2>
        {panels.assets.caption ? <p className="tree-caption">{panels.assets.caption}</p> : null}
        <div className="toolbar-row">
          <button className="toolbar-btn" type="button" onClick={onImportImageAsset}>
            Import Image
          </button>
          <button className="toolbar-btn" type="button" onClick={onRemoveSelectedImageAsset} disabled={!canRemoveSelectedImageAsset}>
            Remove Asset
          </button>
        </div>
        <div className="asset-grid">
          {imageAssets.map((asset) => (
            <button
              key={asset.id}
              className={`asset-card ${selectedAssetId === asset.id ? 'is-selected' : ''}`}
              type="button"
              onClick={() => onSelectAsset(asset.id)}
            >
              <span
                className="asset-preview"
                style={{
                  backgroundColor: asset.background,
                  backgroundImage: `url(${asset.source})`
                }}
              />
              <span className="palette-title">{asset.title}</span>
              <span className="palette-description">{asset.description}</span>
              <span className="asset-origin">{asset.originLabel}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-row">
          <button className="toolbar-btn" type="button" onClick={onApplySelectedAsset} disabled={!isSelectedImageNode}>
            Apply to Image
          </button>
          <button className="toolbar-btn" type="button" onClick={onInsertSelectedAsset}>
            Insert Asset
          </button>
        </div>
        <div className="library-summary">
          <span className="summary-label">Document assets</span>
          <div className="token-list">
            {documentImageSources.length > 0 ? (
              documentImageSources.map((source, index) => (
                <span key={`${source}-${index}`} className="library-token">
                  {resolveImageTokenLabel(source, index)}
                </span>
              ))
            ) : (
              <span className="library-empty">No image assets in this document yet.</span>
            )}
          </div>
        </div>
      </section>
      ) : null}

      {showPanel('fonts') ? (
        <section className="library-panel">
        <h2>{panels.fonts.title}</h2>
        {panels.fonts.caption ? <p className="tree-caption">{panels.fonts.caption}</p> : null}
        <div className="toolbar-row">
          <button className="toolbar-btn" type="button" onClick={onImportFontAsset}>
            Import Font
          </button>
          <button className="toolbar-btn" type="button" onClick={onRemoveSelectedFont} disabled={!canRemoveSelectedFont}>
            Remove Font
          </button>
        </div>
        <div className="font-grid">
          {fontAssets.map((font) => (
            <button
              key={font.id}
              className={`font-card ${selectedFontId === font.id ? 'is-selected' : ''}`}
              type="button"
              onClick={() => onSelectFont(font.id)}
            >
              <span className="font-preview" style={{ fontFamily: font.family }}>
                {font.sample}
              </span>
              <span className="palette-title">{font.title}</span>
              <span className="palette-description">{font.note}</span>
              <span className="asset-origin">{font.originLabel}</span>
            </button>
          ))}
        </div>
        <button className="toolbar-btn full-width" type="button" onClick={onApplySelectedFont} disabled={!isSelectedTextNode}>
          Apply Font
        </button>
        <div className="library-summary">
          <span className="summary-label">Document fonts</span>
          <div className="token-list">
            {documentFontFamilies.length > 0 ? (
              documentFontFamilies.map((family) => (
                <span key={family} className="library-token" style={{ fontFamily: family }}>
                  {family}
                </span>
              ))
            ) : (
              <span className="library-empty">No explicit font families in this document yet.</span>
            )}
          </div>
        </div>
        <p className="tree-caption">
          Active library picks: image {selectedAssetTitle}, font {selectedFontTitle}.
        </p>
      </section>
      ) : null}

      {showPanel('visualStates') ? (
        <section className="visual-states-panel">
          <h2>{panels.visualStates.title}</h2>
          {panels.visualStates.caption ? <p className="tree-caption">{panels.visualStates.caption}</p> : null}
          <div className="state-target">
            <span className="summary-label">Target</span>
            <strong>{visualStateTargetLabel}</strong>
          </div>
          <div className="state-list" role="listbox" aria-label="Visual states">
            {visualStates.map((state) => (
              <button
                key={state.id}
                className={`state-card ${selectedVisualStateId === state.id ? 'is-selected' : ''}`}
                type="button"
                role="option"
                aria-selected={selectedVisualStateId === state.id}
                onClick={() => onSelectVisualState(state.id)}
              >
                <span className="state-accent" style={{ background: state.accent }} />
                <span className="palette-title">{state.label}</span>
                <span className="palette-description">{state.description}</span>
              </button>
            ))}
          </div>
          <button
            className="toolbar-btn full-width"
            type="button"
            onClick={onToggleVisualStateRecording}
            disabled={!canRecordVisualState}
          >
            {isVisualStateRecording ? 'Stop Recording' : 'Record State'}
          </button>
        </section>
      ) : null}

      {showPanel('overlays') ? (
        <section className="library-panel">
        <h2>{panels.overlays.title}</h2>
        {panels.overlays.caption ? <p className="tree-caption">{panels.overlays.caption}</p> : null}
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlaySettings.layout}
            onInput={(event) => onOverlaySettingChange('layout', (event.target as HTMLInputElement).checked)}
          />
          <span>Show selected bounds and measurement badges</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlaySettings.hover}
            onInput={(event) => onOverlaySettingChange('hover', (event.target as HTMLInputElement).checked)}
          />
          <span>Show hovered component outline</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlaySettings.parentBounds}
            onInput={(event) => onOverlaySettingChange('parentBounds', (event.target as HTMLInputElement).checked)}
          />
          <span>Show parent layout bounds</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlaySettings.content}
            onInput={(event) => onOverlaySettingChange('content', (event.target as HTMLInputElement).checked)}
          />
          <span>Show text and image content guides</span>
        </label>
      </section>
      ) : null}

      <div className="origin">Hover: {hoveredId ?? 'none'}</div>
      <div className="origin">Selected: {selectedId ?? 'none'}</div>
    </aside>
  );
}
