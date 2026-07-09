import type { ReactNode } from 'react'
import { AppShell as AstryxAppShell } from '@astryxdesign/core/AppShell'
import { Layout, LayoutContent, LayoutHeader, LayoutPanel } from '@astryxdesign/core/Layout'
import { ResizeHandle, useResizable } from '@astryxdesign/core/Resizable'

type AppShellProps = {
  pipeline: ReactNode
  viewer: ReactNode
  details: ReactNode
}

export function AppShell({ pipeline, viewer, details }: AppShellProps) {
  const detailsPanel = useResizable({
    defaultSize: 360,
    minSizePx: 280,
    maxSizePx: 640,
    autoSaveId: 'jsonhunter-details-panel',
  })

  return (
    <AstryxAppShell>
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
                {viewer}
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
