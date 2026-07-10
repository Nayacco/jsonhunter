import type { ReactNode } from 'react'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav'

type ProjectPageShellProps = {
  children: ReactNode
  height?: 'auto' | 'fill'
  onCancel?(): void
}

export function ProjectPageShell({ children, height = 'auto', onCancel }: ProjectPageShellProps) {
  return (
    <AppShell
      contentPadding={0}
      height={height}
      variant="surface"
      topNav={
        <TopNav
          label="JSON Hunter navigation"
          heading={<TopNavHeading heading="JSON Hunter" subheading="Local JSON workbench" />}
          endContent={
            onCancel ? (
              <Button label="Back to current project" variant="ghost" onClick={onCancel} />
            ) : undefined
          }
        />
      }
    >
      {children}
    </AppShell>
  )
}
