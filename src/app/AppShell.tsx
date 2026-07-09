import type { ReactNode } from 'react'

type AppShellProps = {
  pipeline: ReactNode
  viewer: ReactNode
  details: ReactNode
}

export function AppShell({ pipeline, viewer, details }: AppShellProps) {
  return (
    <main className="workbenchShell">
      <section className="leftPane">
        <div className="pipelinePane">{pipeline}</div>
        <div className="viewerPane">{viewer}</div>
      </section>
      <aside className="detailsPane">{details}</aside>
    </main>
  )
}
