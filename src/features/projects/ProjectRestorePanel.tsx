import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'

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
  const [pasteText, setPasteText] = useState('')
  const [file, setFile] = useState<File | null>(null)

  return (
    <Section>
      <VStack gap={4}>
        <Heading level={2}>Raw JSON required</Heading>
        <Text type="supporting" display="block">
          {sourceLabel}
        </Text>
        {onReloadUrl && <Button label="Reload from URL" variant="primary" onClick={onReloadUrl} />}
        {onReselectFile && (
          <FileInput
            label="Reselect file"
            value={file}
            accept="application/json,.json"
            onChange={(nextFile) => {
              const selectedFile = Array.isArray(nextFile) ? nextFile[0] : nextFile
              setFile(selectedFile ?? null)
              if (selectedFile) onReselectFile(selectedFile)
            }}
          />
        )}
        {onPasteAgain && (
          <>
            <TextArea
              label="Paste JSON again"
              value={pasteText}
              onChange={setPasteText}
              rows={8}
              hasSpellCheck={false}
            />
            <Button label="Paste again" variant="primary" onClick={() => onPasteAgain(pasteText)} />
          </>
        )}
      </VStack>
    </Section>
  )
}
