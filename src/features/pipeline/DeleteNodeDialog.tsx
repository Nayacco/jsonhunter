import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import type { ProcessingNode } from '../../domain/pipelineTypes'

type DeleteNodeDialogProps = {
  isOpen: boolean
  nodes: ProcessingNode[]
  onCancel(): void
  onConfirm(): void
}

export function DeleteNodeDialog({
  isOpen,
  nodes,
  onCancel,
  onConfirm,
}: DeleteNodeDialogProps) {
  const firstNode = nodes[0]
  const count = nodes.length

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && onCancel()} purpose="form">
      <Layout
        header={
          <DialogHeader
            title={
              firstNode
                ? `Delete ${firstNode.label} and downstream steps?`
                : 'Delete pipeline steps?'
            }
            onOpenChange={(open) => !open && onCancel()}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={2}>
              <Text type="body">
                This permanently removes the selected step and every step after it.
              </Text>
              <Text type="supporting" wordBreak="break-word">
                {nodes.map((node) => node.label).join(', ')}
              </Text>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onCancel} />
              <Button
                label={`Delete ${count} ${count === 1 ? 'step' : 'steps'}`}
                variant="destructive"
                onClick={onConfirm}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
