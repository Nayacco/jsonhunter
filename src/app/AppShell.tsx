import type { ReactNode } from 'react'
import { AppShell as AstryxAppShell } from '@astryxdesign/core/AppShell'
import { Layout, LayoutContent, LayoutHeader, LayoutPanel } from '@astryxdesign/core/Layout'

type AppShellProps = {
  pipeline: ReactNode
  viewer: ReactNode
  details: ReactNode
}

export function AppShell({ pipeline, viewer, details }: AppShellProps) {
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
          <LayoutPanel role="complementary" label="Details" hasDivider>
            {details}
          </LayoutPanel>
        }
      />
    </AstryxAppShell>
  )
}
