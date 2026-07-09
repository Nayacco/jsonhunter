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
    <AstryxAppShell contentPadding={0} height="fill" variant="section">
      <Layout
        height="fill"
        content={
          <Layout
            height="fill"
            header={
              <LayoutHeader role="banner" label="Pipeline" hasDivider>
                {pipeline}
              </LayoutHeader>
            }
            content={
              <LayoutContent role="region" label="JSON viewer" isScrollable>
                {viewer}
              </LayoutContent>
            }
          />
        }
        end={
          <LayoutPanel role="complementary" label="Details" hasDivider isScrollable>
            {details}
          </LayoutPanel>
        }
      />
    </AstryxAppShell>
  )
}
