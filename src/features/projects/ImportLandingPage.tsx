import { useState, type FormEvent } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { ProjectPageShell } from './ProjectPageShell'

export type ImportMethod = 'file' | 'url' | 'paste'

type ImportLandingPageProps = {
  error?: string
  onClearError(): void
  onPasteJson(text: string): Promise<void>
  onLoadUrl(url: string): Promise<void>
  onOpenFile(file: File): Promise<void>
  onCancel?(): void
}

export function ImportLandingPage(props: ImportLandingPageProps) {
  const [pasteText, setPasteText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pendingMethod, setPendingMethod] = useState<ImportMethod>()
  const [lastAttemptedMethod, setLastAttemptedMethod] = useState<ImportMethod>()
  const [localErrors, setLocalErrors] = useState<Partial<Record<ImportMethod, string>>>({})

  const isBusy = pendingMethod !== undefined

  function statusFor(method: ImportMethod) {
    const message = localErrors[method] ?? (lastAttemptedMethod === method ? props.error : undefined)
    return message ? { type: 'error' as const, message } : undefined
  }

  function clearMethod(method: ImportMethod) {
    setLocalErrors((current) => ({ ...current, [method]: undefined }))
    if (lastAttemptedMethod === method) setLastAttemptedMethod(undefined)
  }

  async function runImport(method: ImportMethod, action: () => Promise<void>) {
    props.onClearError()
    setLocalErrors((current) => ({ ...current, [method]: undefined }))
    setLastAttemptedMethod(method)
    setPendingMethod(method)
    try {
      await action()
    } finally {
      setPendingMethod(undefined)
    }
  }

  function submitUrl(event: FormEvent) {
    event.preventDefault()
    if (!url.trim()) {
      setLocalErrors((current) => ({ ...current, url: 'Enter a JSON URL.' }))
      return
    }
    void runImport('url', () => props.onLoadUrl(url.trim()))
  }

  function submitPaste(event: FormEvent) {
    event.preventDefault()
    if (!pasteText.trim()) {
      setLocalErrors((current) => ({ ...current, paste: 'Paste JSON before creating a project.' }))
      return
    }
    void runImport('paste', () => props.onPasteJson(pasteText))
  }

  return (
    <ProjectPageShell onCancel={props.onCancel}>
      <Section variant="muted" padding={10} minHeight={600}>
        <VStack gap={8} hAlign="center" className="importLanding-hero">
          <VStack gap={2} hAlign="center" maxWidth={720} className="importLanding-intro">
            <Text type="supporting">Inspect · Transform · Understand</Text>
            <Heading level={1}>Make complex JSON feel navigable.</Heading>
            <Text type="large" color="secondary">
              Open a file, load a URL, or paste raw JSON. Every route leads to the same focused workbench.
            </Text>
          </VStack>

          <Grid
            className="importLanding-grid"
            columns={{ minWidth: 280, max: 3, repeat: 'fit' }}
            gap={4}
            width="100%"
            maxWidth={1120}
          >
            <Card height="100%">
              <VStack gap={4} height="100%">
                <VStack gap={1}>
                  <Heading level={2}>Open a file</Heading>
                  <Text type="supporting">Drop a JSON document here or browse from your device.</Text>
                </VStack>
                <FileInput
                  label="Open file"
                  value={file}
                  accept="application/json,.json"
                  mode="dropzone"
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'file'}
                  status={statusFor('file')}
                  onChange={(nextFile) => {
                    const selectedFile = Array.isArray(nextFile) ? nextFile[0] : nextFile
                    setFile(selectedFile ?? null)
                    clearMethod('file')
                    if (selectedFile) void runImport('file', () => props.onOpenFile(selectedFile))
                  }}
                />
              </VStack>
            </Card>

            <Card height="100%">
              <VStack as="form" gap={4} height="100%" onSubmit={submitUrl}>
                <VStack gap={1}>
                  <Heading level={2}>Load from URL</Heading>
                  <Text type="supporting">Fetch a public JSON response and open it directly.</Text>
                </VStack>
                <TextInput
                  label="JSON URL"
                  value={url}
                  placeholder="https://example.com/data.json"
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'url'}
                  status={statusFor('url')}
                  onChange={(value) => {
                    setUrl(value)
                    clearMethod('url')
                  }}
                />
                <Button
                  label="Load JSON"
                  type="submit"
                  variant="secondary"
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'url'}
                />
              </VStack>
            </Card>

            <Card height="100%">
              <VStack as="form" gap={4} height="100%" onSubmit={submitPaste}>
                <Heading level={2}>Paste JSON</Heading>
                <TextArea
                  label="Paste JSON"
                  value={pasteText}
                  rows={8}
                  hasSpellCheck={false}
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'paste'}
                  status={statusFor('paste')}
                  onChange={(value) => {
                    setPasteText(value)
                    clearMethod('paste')
                  }}
                />
                <Button
                  label="Create project"
                  type="submit"
                  variant="secondary"
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'paste'}
                />
              </VStack>
            </Card>
          </Grid>

          <HStack gap={4} wrap="wrap" hAlign="center">
            <Text type="supporting">Runs in your browser</Text>
            <Text type="supporting">Warns before memory-risk input</Text>
            <Text type="supporting">Project state stays local</Text>
          </HStack>
        </VStack>
      </Section>

      <Section variant="transparent" padding={10}>
        <VStack gap={8} maxWidth={1120} className="importLanding-story">
          <VStack gap={2} maxWidth={720}>
            <Heading level={2}>From raw payload to a useful view.</Heading>
            <Text color="secondary">Inspect structure, shape data, and return without losing the thread.</Text>
          </VStack>
          <Grid columns={{ minWidth: 280, max: 3, repeat: 'fit' }} gap={8}>
            <VStack gap={2}>
              <Text type="supporting">01 · Inspect</Text>
              <Heading level={3}>Four views, one path</Heading>
              <Text color="secondary">
                Columns, Tree, Table, and Source stay connected to the JSON path you are exploring.
              </Text>
            </VStack>
            <VStack gap={2}>
              <Text type="supporting">02 · Transform</Text>
              <Heading level={3}>Build a data pipeline</Heading>
              <Text color="secondary">
                Shape raw input with JavaScript or DuckDB while every processing step remains visible.
              </Text>
            </VStack>
            <VStack gap={2}>
              <Text type="supporting">03 · Continue</Text>
              <Heading level={3}>Return with context</Heading>
              <Text color="secondary">Local project persistence restores available source and workbench state.</Text>
            </VStack>
          </Grid>
        </VStack>
      </Section>

      <Section variant="transparent" padding={6} dividers={['top']}>
        <HStack hAlign="between" vAlign="center">
          <Text type="supporting">JSON Hunter</Text>
          <Text type="supporting">Local JSON workbench</Text>
        </HStack>
      </Section>
    </ProjectPageShell>
  )
}
