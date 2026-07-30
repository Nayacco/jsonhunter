import type { ReactNode, SVGProps } from 'react'
import { AppShell as AstryxAppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
import { Layout, LayoutContent, LayoutHeader, LayoutPanel } from '@astryxdesign/core/Layout'
import { ResizeHandle, useResizable } from '@astryxdesign/core/Resizable'
import { VStack } from '@astryxdesign/core/Stack'
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav'

type AppShellProps = {
  projectName: string
  onOpenJson(): void
  pipeline: ReactNode
  editor?: ReactNode
  viewer: ReactNode
  details: ReactNode
}

export function AppShell({
  projectName,
  onOpenJson,
  pipeline,
  editor,
  viewer,
  details,
}: AppShellProps) {
  const detailsPanel = useResizable({
    defaultSize: 360,
    minSizePx: 280,
    maxSizePx: 640,
    autoSaveId: 'jsonhunter-details-panel',
  })

  return (
    <AstryxAppShell
      topNav={
        <TopNav
          label="JSON Hunter navigation"
          heading={<TopNavHeading heading="JSON Hunter" subheading={projectName} />}
          endContent={
            <Button
              label="Open JSON"
              variant="primary"
              icon={<OpenJsonIcon />}
              onClick={onOpenJson}
            />
          }
        />
      }
    >
      <Layout
        content={
          <Layout
            header={
              <LayoutHeader role="banner" label="Pipeline" hasDivider>
                {pipeline}
              </LayoutHeader>
            }
            content={
              <LayoutContent role="region" label="JSON viewer">
                <VStack gap={0} height="100%" className="workbench-content">
                  <VStack
                    gap={0}
                    as="section"
                    aria-label="Node editor"
                    aria-hidden={editor ? undefined : true}
                    data-open={Boolean(editor)}
                    className="workbench-editorSlot"
                  >
                    <VStack gap={0} className="workbench-editorSlotInner">
                      {editor}
                    </VStack>
                  </VStack>
                  {viewer}
                </VStack>
              </LayoutContent>
            }
          />
        }
        end={
          <>
            <ResizeHandle
              resizable={detailsPanel.props}
              isReversed
              hasDivider
              label="Resize details panel"
            />
            <LayoutPanel role="complementary" label="Details" resizable={detailsPanel.props} padding={4}>
              {details}
            </LayoutPanel>
          </>
        }
      />
    </AstryxAppShell>
  )
}

function OpenJsonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M3.5 5.5h5l1.5 2h6.5v7.5H3.5z" />
      <path d="M3.5 7.5v-2a1 1 0 0 1 1-1h3.25l1.5 2H15a1 1 0 0 1 1 1" />
    </svg>
  )
}
