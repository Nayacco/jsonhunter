import { Heading } from '@astryxdesign/core/Heading'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { Section } from '@astryxdesign/core/Section'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'

type DetailsPreviewProps = {
  path: string
  type: string
  valuePreview: string
  sourceNodeLabel: string
}

export function DetailsPreview({ path, type, valuePreview, sourceNodeLabel }: DetailsPreviewProps) {
  return (
    <Section>
      <VStack gap={4} as="section" aria-label="Details preview">
        <VStack gap={1}>
          <Heading level={2}>Details</Heading>
          <Text type="supporting" display="block" wordBreak="break-word">
            {path}
          </Text>
        </VStack>

        <MetadataList title="Selection">
          <MetadataListItem label="Type">
            <Token label={type} />
          </MetadataListItem>
          <MetadataListItem label="Value">
            <Text type="code" wordBreak="break-word">
              {valuePreview}
            </Text>
          </MetadataListItem>
          <MetadataListItem label="Source">{sourceNodeLabel}</MetadataListItem>
        </MetadataList>

        <Section>
          <Heading level={3}>Provenance</Heading>
          <Text type="supporting" display="block">
            Derived from the currently selected pipeline node.
          </Text>
        </Section>

        <Section>
          <Heading level={3}>Comparison</Heading>
          <Text type="supporting" display="block">
            Diff appears when comparison data is available.
          </Text>
        </Section>

        <Section>
          <Heading level={3}>Related values</Heading>
          <Text type="supporting" display="block">
            Related paths appear when indexes are available.
          </Text>
        </Section>
      </VStack>
    </Section>
  )
}
