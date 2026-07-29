import { Heading } from '@astryxdesign/core/Heading'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { Section } from '@astryxdesign/core/Section'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'

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
          <Text type="supporting" display="block" wordBreak="break-word" className="json-viewMeta">
            {path}
          </Text>
        </VStack>

        <MetadataList title="Selection">
          <MetadataListItem label="Type" className="json-viewKey">
            <Text type="supporting" className="json-viewValue">
              {type}
            </Text>
          </MetadataListItem>
          <MetadataListItem label="Value" className="json-viewKey">
            <Text type="supporting" wordBreak="break-word" className="json-viewValue">
              {valuePreview}
            </Text>
          </MetadataListItem>
          <MetadataListItem label="Source" className="json-viewKey">
            <Text type="supporting" wordBreak="break-word" className="json-viewValue">
              {sourceNodeLabel}
            </Text>
          </MetadataListItem>
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
