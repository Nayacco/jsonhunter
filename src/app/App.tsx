import { AppShell } from './AppShell'
import { ProjectLauncher } from '../features/projects/ProjectLauncher'

export function App() {
  return (
    <AppShell
      pipeline={<div>Pipeline</div>}
      viewer={<ProjectLauncher onPasteJson={() => {}} onLoadUrl={() => {}} onOpenFile={() => {}} />}
      details={<div>Details</div>}
    />
  )
}
