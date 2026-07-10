import { useState, type FormEvent } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { ProjectPageShell } from './ProjectPageShell'

type ProjectRestorePageProps = {
  sourceLabel: string
  error?: string
  onReloadUrl?: () => Promise<void>
  onReselectFile?: (file: File) => Promise<void>
  onPasteAgain?: (text: string) => Promise<void>
}

export function ProjectRestorePage({
  sourceLabel,
  error,
  onReloadUrl,
  onReselectFile,
  onPasteAgain,
}: ProjectRestorePageProps) {
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string>()
  const [file, setFile] = useState<File | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function runRestore(action: () => Promise<void>) {
    setIsPending(true)
    try {
      await action()
    } finally {
      setIsPending(false)
    }
  }

  function submitPaste(event: FormEvent) {
    event.preventDefault()
    if (!pasteText.trim()) {
      setPasteError('Paste JSON before restoring the project.')
      return
    }
    if (onPasteAgain) void runRestore(() => onPasteAgain(pasteText))
  }

  return (
    <ProjectPageShell>
      <Section variant="muted" padding={10} minHeight={600}>
        <VStack gap={6} hAlign="center">
          <VStack gap={2} hAlign="center" maxWidth={640} className="importLanding-intro">
            <Heading level={1}>Raw JSON required</Heading>
            <Text color="secondary">
              Restore the original source to continue this project's pipeline and viewer state.
            </Text>
          </VStack>

          <Card width="100%" maxWidth={640}>
            <VStack gap={4}>
              <Text type="supporting">{sourceLabel}</Text>
              {onReloadUrl && (
                <>
                  {error && <Banner status="error" title="Unable to reload JSON" description={error} />}
                  <Button
                    label="Reload from URL"
                    variant="primary"
                    isLoading={isPending}
                    clickAction={() => runRestore(onReloadUrl)}
                  />
                </>
              )}
              {onReselectFile && (
                <FileInput
                  label="Reselect file"
                  value={file}
                  accept="application/json,.json"
                  mode="dropzone"
                  isLoading={isPending}
                  status={error ? { type: 'error', message: error } : undefined}
                  onChange={(nextFile) => {
                    const selectedFile = Array.isArray(nextFile) ? nextFile[0] : nextFile
                    setFile(selectedFile ?? null)
                    if (selectedFile) void runRestore(() => onReselectFile(selectedFile))
                  }}
                />
              )}
              {onPasteAgain && (
                <VStack as="form" gap={4} onSubmit={submitPaste}>
                  <TextArea
                    label="Paste JSON again"
                    value={pasteText}
                    rows={10}
                    hasSpellCheck={false}
                    isLoading={isPending}
                    status={
                      pasteError || error
                        ? { type: 'error', message: pasteError ?? error }
                        : undefined
                    }
                    onChange={(value) => {
                      setPasteText(value)
                      setPasteError(undefined)
                    }}
                  />
                  <Button
                    label="Paste again"
                    type="submit"
                    variant="primary"
                    isLoading={isPending}
                  />
                </VStack>
              )}
            </VStack>
          </Card>
        </VStack>
      </Section>
    </ProjectPageShell>
  )
}
