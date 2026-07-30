import { lazy, Suspense } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Section } from '@astryxdesign/core/Section'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { Toolbar } from '@astryxdesign/core/Toolbar'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

type NodeEditorProps = {
  title?: string
  language: 'javascript' | 'sql'
  value: string
  onChange(value: string): void
  onRun(): void
  onSave(): void
  onCancel(): void
}

export function NodeEditor({
  title = 'Pipeline step',
  language,
  value,
  onChange,
  onRun,
  onSave,
  onCancel,
}: NodeEditorProps) {
  return (
    <Section className="pipelineEditor">
      <Toolbar
        label="Node editor heading"
        size="sm"
        startContent={
          <HStack gap={2} align="center">
            <Text type="label">{title}</Text>
            <Text type="supporting">{language === 'sql' ? 'DuckDB SQL' : 'JavaScript'} · Unsaved</Text>
          </HStack>
        }
      />
      <Suspense fallback={<Text type="supporting">Loading editor...</Text>}>
        <MonacoEditor
          height="calc(var(--spacing-12) * 4)"
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
            <Button label="Cancel" variant="ghost" onClick={onCancel} />
            <Button label="Save" onClick={onSave} />
            <Button label="Run" variant="primary" onClick={onRun}>
              Run preview
            </Button>
          </>
        }
      />
    </Section>
  )
}
