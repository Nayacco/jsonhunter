type ProjectRestorePanelProps = {
  sourceLabel: string
  onReloadUrl?: () => void
  onReselectFile?: (file: File) => void
  onPasteAgain?: (text: string) => void
}

export function ProjectRestorePanel({
  sourceLabel,
  onReloadUrl,
  onReselectFile,
  onPasteAgain,
}: ProjectRestorePanelProps) {
  return (
    <section className="restorePanel">
      <h2>Raw JSON required</h2>
      <p>{sourceLabel}</p>
      {onReloadUrl && (
        <button type="button" onClick={onReloadUrl}>
          Reload from URL
        </button>
      )}
      {onReselectFile && (
        <label className="field">
          <span>Reselect file</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) onReselectFile(file)
            }}
          />
        </label>
      )}
      {onPasteAgain && (
        <button type="button" onClick={() => onPasteAgain('')}>
          Paste again
        </button>
      )}
    </section>
  )
}
