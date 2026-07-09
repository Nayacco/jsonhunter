import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { VStack } from '@astryxdesign/core/Stack'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'

type ProjectLauncherProps = {
  onPasteJson(text: string): void
  onLoadUrl(url: string): void
  onOpenFile(file: File): void
  onCancel?(): void
}

export function ProjectLauncher({ onPasteJson, onLoadUrl, onOpenFile, onCancel }: ProjectLauncherProps) {
  const [pasteText, setPasteText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)

  return (
    <Section>
      <VStack gap={4}>
        <Heading level={1}>JSON Hunter</Heading>
        {onCancel && <Button label="Back to current project" variant="ghost" onClick={onCancel} />}
        <TextArea
          label="Paste JSON"
          value={pasteText}
          onChange={setPasteText}
          rows={8}
          hasSpellCheck={false}
        />
        <Button label="Create from paste" variant="primary" onClick={() => onPasteJson(pasteText)} />
        <TextInput
          label="JSON URL"
          value={url}
          onChange={setUrl}
          placeholder="https://example.com/data.json"
        />
        <Button label="Load URL" onClick={() => onLoadUrl(url)} />
        <FileInput
          label="Open file"
          value={file}
          accept="application/json,.json"
          onChange={(nextFile) => {
            const selectedFile = Array.isArray(nextFile) ? nextFile[0] : nextFile
            setFile(selectedFile ?? null)
            if (selectedFile) onOpenFile(selectedFile)
          }}
        />
      </VStack>
    </Section>
  )
}
