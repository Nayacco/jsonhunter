import { lazy, Suspense } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Section } from '@astryxdesign/core/Section'
import { Text } from '@astryxdesign/core/Text'
import { Toolbar } from '@astryxdesign/core/Toolbar'

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
    <Section variant="transparent" padding={3}>
      <Suspense fallback={<Text type="supporting">Loading editor...</Text>}>
        <MonacoEditor
          height="180px"
          language={language}
          value={value}
          theme="vs-dark"
          onChange={(next) => onChange(next ?? '')}
          options={{ minimap: { enabled: false }, scrollBeyondLastLine: false }}
        />
      </Suspense>
      <Toolbar
        label="Node editor actions"
        size="sm"
        endContent={
          <>
            <Button label="Run" variant="primary" onClick={onRun} />
            <Button label="Save" onClick={onSave} />
            <Button label="Cancel" variant="ghost" onClick={onCancel} />
          </>
        }
      />
    </Section>
  )
}
