import type { DesignerChromeItem } from '../designer/chrome';

interface SourceDiagnostic {
  severity: 'error' | 'warning';
  message: string;
}

interface SourcePaneProps {
  tabs: readonly DesignerChromeItem[];
  documentFileName: string;
  sourceDraft: string;
  sourceDirty: boolean;
  sourceDiagnostic: SourceDiagnostic | null;
  canApplySource: boolean;
  onChangeSourceDraft: (value: string) => void;
  onApplySource: () => void;
  onRevertSourceDraft: () => void;
}

export function SourcePane(props: SourcePaneProps) {
  const {
    tabs,
    documentFileName,
    sourceDraft,
    sourceDirty,
    sourceDiagnostic,
    canApplySource,
    onChangeSourceDraft,
    onApplySource,
    onRevertSourceDraft
  } = props;
  const sourcePreviewClassName = [
    'source-preview',
    sourceDiagnostic?.severity === 'error' ? 'has-error' : '',
    sourceDiagnostic?.severity === 'warning' ? 'has-warning' : ''
  ].filter(Boolean).join(' ');
  const sourceDiagnosticLabel = sourceDiagnostic?.severity === 'warning' ? 'XAML warning' : 'XAML error';

  return (
    <section className="source-pane" aria-label="XAML source editor">
      <div className="source-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={`source-tab ${tab.isActive ? 'is-active' : ''}`} type="button">
            {tab.label}
          </button>
        ))}
        <span className="source-file">{documentFileName}{sourceDirty ? ' *' : ''}</span>
      </div>
      <textarea
        className={sourcePreviewClassName}
        value={sourceDraft}
        onInput={(event) => onChangeSourceDraft((event.target as HTMLTextAreaElement).value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            onApplySource();
          }
        }}
        spellcheck={false}
      />
      <div className="source-footer">
        {sourceDiagnostic ? (
          <p className={`source-diagnostic is-${sourceDiagnostic.severity}`}>
            {sourceDiagnosticLabel}: {sourceDiagnostic.message}
          </p>
        ) : (
          <p className="source-caption">Edit XAML source and apply it back into the live designer surface.</p>
        )}
        <div className="source-actions">
          <button className="toolbar-btn" type="button" onClick={onApplySource} disabled={!canApplySource}>
            Apply XAML
          </button>
          <button className="toolbar-btn" type="button" onClick={onRevertSourceDraft} disabled={!sourceDirty}>
            Revert
          </button>
        </div>
      </div>
    </section>
  );
}
