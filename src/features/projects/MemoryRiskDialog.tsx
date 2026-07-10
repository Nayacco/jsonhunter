import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'

type MemoryRiskDialogProps = {
  isOpen: boolean
  warningLimitMiB: number
  onCancel(): void
  onConfirm(): void
}

export function MemoryRiskDialog({
  isOpen,
  warningLimitMiB,
  onCancel,
  onConfirm,
}: MemoryRiskDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      purpose="required"
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
    >
      <Layout
        header={<DialogHeader title="Large JSON may use significant memory" />}
        content={
          <LayoutContent>
            <Text>
              This JSON is over {warningLimitMiB} MiB. Continuing may consume significant browser memory.
            </Text>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end" vAlign="center">
              <Button label="Cancel import" variant="secondary" onClick={onCancel} />
              <Button label="Continue loading" variant="primary" onClick={onConfirm} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
