import { useState } from 'react'

type ProjectLauncherProps = {
  onPasteJson(text: string): void
  onLoadUrl(url: string): void
  onOpenFile(file: File): void
}

export function ProjectLauncher({ onPasteJson, onLoadUrl, onOpenFile }: ProjectLauncherProps) {
  const [pasteText, setPasteText] = useState('')
  const [url, setUrl] = useState('')

  return (
    <section className="launcher">
      <h1>JSON Hunter</h1>

      <label className="field">
        <span>Paste JSON</span>
        <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} />
      </label>

      <button type="button" onClick={() => onPasteJson(pasteText)}>
        Create from paste
      </button>

      <label className="field">
        <span>JSON URL</span>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/data.json"
        />
      </label>

      <button type="button" onClick={() => onLoadUrl(url)}>
        Load URL
      </button>

      <label className="field">
        <span>Open file</span>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) onOpenFile(file)
          }}
        />
      </label>
    </section>
  )
}
