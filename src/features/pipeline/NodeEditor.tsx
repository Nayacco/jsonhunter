import { lazy, Suspense } from 'react'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

type NodeEditorProps = {
  language: 'javascript' | 'sql'
  value: string
  onChange(value: string): void
  onRun(): void
  onSave(): void
  onCancel(): void
}

export function NodeEditor({ language, value, onChange, onRun, onSave, onCancel }: NodeEditorProps) {
  return (
    <section className="nodeEditor">
      <Suspense fallback={<div>Loading editor...</div>}>
        <MonacoEditor
          height="180px"
          language={language}
          value={value}
          theme="vs-dark"
          onChange={(next) => onChange(next ?? '')}
          options={{ minimap: { enabled: false }, scrollBeyondLastLine: false }}
        />
      </Suspense>
      <div className="nodeEditorActions">
        <button type="button" onClick={onRun}>
          Run
        </button>
        <button type="button" onClick={onSave}>
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
