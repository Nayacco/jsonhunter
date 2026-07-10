import { Center } from '@astryxdesign/core/Center'
import { Spinner } from '@astryxdesign/core/Spinner'
import { ProjectPageShell } from './ProjectPageShell'

export function ProjectLoadingPage() {
  return (
    <ProjectPageShell height="fill">
      <Center height="100%">
        <Spinner size="lg" label="Restoring project" />
      </Center>
    </ProjectPageShell>
  )
}
