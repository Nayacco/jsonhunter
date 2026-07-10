# JSON Import Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty pre-import workbench with a full-page Astryx landing and restore experience that gives file, URL, and paste imports equal prominence before entering the existing workbench.

**Architecture:** `App` remains the import and worker orchestrator, but derives one top-level surface: hydration, import landing, source-aware restore, or loaded workbench. New project-page components own only presentation state; the existing workbench shell, store schema, worker protocol, persistence model, and pipeline behavior stay unchanged. Large-input confirmation becomes a promise-backed Astryx dialog so the existing async import functions can await the user's decision.

**Tech Stack:** React 19, TypeScript, Astryx Design System, Zustand, Vitest, React Testing Library, Playwright, Vite.

## Global Constraints

- The landing page uses Astryx `AppShell`, `TopNav`, `Section`, `Grid`, `Card`, inputs, buttons, status feedback, and dialog primitives.
- File, URL, and paste entry points must have equal visual prominence; do not hide any method behind tabs.
- Copy remains English and describes only the existing four viewers, JavaScript/DuckDB pipeline, browser execution, memory warning, and local persistence behavior.
- Do not add samples, cloud upload, sharing, authentication, server storage, or new pipeline behavior.
- Do not change Zustand domain state, worker protocol, project persistence records, or loaded-workbench layout.
- Do not add layout `<div>` elements; use Astryx layout primitives and semantic form/footer elements.
- Prefer Astryx props; custom application CSS must use Astryx tokens and contain no raw hex, rgba, or arbitrary pixel visual values.
- Do not add Tailwind, StyleX utility classes, a new styling runtime, or root semantic-token overrides.
- A failed import preserves input and any previously loaded project; project creation still follows successful worker parsing.
- The existing 100 MiB warning threshold and 10 MiB raw-persistence threshold remain unchanged.

---

## File Structure

- Create `src/features/projects/ProjectPageShell.tsx`: shared Astryx frame and top navigation for import, restore, and hydration pages.
- Create `src/features/projects/ImportLandingPage.tsx`: equal import cards, hero, trust copy, capability narrative, and presentation state.
- Create `src/features/projects/ImportLandingPage.test.tsx`: import-method, pending, validation, error-retention, and return-action tests.
- Create `src/features/projects/ProjectRestorePage.tsx`: source-aware full-page raw JSON restoration.
- Create `src/features/projects/ProjectRestorePage.test.tsx`: URL, file, and paste restore controls.
- Create `src/features/projects/ProjectLoadingPage.tsx`: full-page persisted-project hydration state.
- Create `src/features/projects/MemoryRiskDialog.tsx`: accessible large-JSON confirmation dialog.
- Create `src/features/projects/MemoryRiskDialog.test.tsx`: confirm and cancel behavior.
- Modify `src/app/App.tsx`: derive top-level surfaces, wire new page callbacks, and await memory confirmation.
- Modify `src/app/App.test.tsx`: assert top-level state transitions, preservation, restore, hydration, and dialog behavior.
- Modify `src/styles/app.css`: token-only landing atmosphere and minimal equal-height bridge styles.
- Modify `src/styles/app-css.test.ts`: lock landing CSS to Astryx tokens.
- Modify `src/styles/astryx-ui-props.test.ts`: enforce Astryx layout and the no-layout-`<div>` rule on new project pages.
- Modify `tests/e2e/workbench.spec.ts`: verify responsive import visibility and the landing-to-workbench transition.
- Delete `src/features/projects/ProjectLauncher.tsx` and `src/features/projects/ProjectLauncher.test.tsx` after `App` uses the new landing page.
- Delete `src/features/projects/ProjectRestorePanel.tsx` after `App` uses the new restore page.

---

### Task 1: Build the Equal-Weight Import Landing Page

**Files:**
- Create: `src/features/projects/ProjectPageShell.tsx`
- Create: `src/features/projects/ImportLandingPage.tsx`
- Create: `src/features/projects/ImportLandingPage.test.tsx`
- Modify: `src/styles/app.css`
- Modify: `src/styles/app-css.test.ts`
- Modify: `src/styles/astryx-ui-props.test.ts`

**Interfaces:**
- Consumes: Astryx page, navigation, form, grid, card, text, and status components.
- Produces:

```ts
export type ImportMethod = 'file' | 'url' | 'paste'

export type ImportLandingPageProps = {
  error?: string
  onClearError(): void
  onPasteJson(text: string): Promise<void>
  onLoadUrl(url: string): Promise<void>
  onOpenFile(file: File): Promise<void>
  onCancel?(): void
}

export type ProjectPageShellProps = {
  children: ReactNode
  height?: 'auto' | 'fill'
  onCancel?(): void
}
```

- [ ] **Step 1: Write failing landing-page behavior tests**

Create `src/features/projects/ImportLandingPage.test.tsx` with tests that render the page through `renderWithProviders` and assert the three simultaneous entry points, all three callbacks, pending locking, error retention, and optional return action:

```tsx
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { ImportLandingPage } from './ImportLandingPage'

function renderLanding(overrides: Partial<React.ComponentProps<typeof ImportLandingPage>> = {}) {
  const props: React.ComponentProps<typeof ImportLandingPage> = {
    onClearError: vi.fn(),
    onPasteJson: vi.fn(async () => {}),
    onLoadUrl: vi.fn(async () => {}),
    onOpenFile: vi.fn(async () => {}),
    ...overrides,
  }
  renderWithProviders(<ImportLandingPage {...props} />)
  return props
}

describe('ImportLandingPage', () => {
  it('shows all three import methods at once', () => {
    renderLanding()
    expect(screen.getByRole('heading', { name: /open a file/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /load from url/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /paste json/i })).toBeVisible()
  })

  it('submits URL, paste, and file inputs unchanged', async () => {
    const user = userEvent.setup()
    const props = renderLanding()
    await user.type(screen.getByLabelText(/json url/i), 'https://example.com/data.json')
    await user.click(screen.getByRole('button', { name: /load json/i }))
    fireEvent.change(screen.getByLabelText(/paste json/i), { target: { value: '{"ok":true}' } })
    await user.click(screen.getByRole('button', { name: /create project/i }))
    const file = new File(['{"file":true}'], 'data.json', { type: 'application/json' })
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file)
    expect(props.onLoadUrl).toHaveBeenCalledWith('https://example.com/data.json')
    expect(props.onPasteJson).toHaveBeenCalledWith('{"ok":true}')
    expect(props.onOpenFile).toHaveBeenCalledWith(file)
  })

  it('locks every entry point while one import is pending', async () => {
    let finish!: () => void
    const pending = new Promise<void>((resolve) => { finish = resolve })
    renderLanding({ onLoadUrl: vi.fn(() => pending) })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/json url/i), 'https://example.com/data.json')
    await user.click(screen.getByRole('button', { name: /load json/i }))
    expect(screen.getByRole('button', { name: /load json/i })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText(/paste json/i)).toHaveAttribute('aria-disabled', 'true')
    expect(document.querySelector('input[type="file"]')).toBeDisabled()
    finish()
  })

  it('keeps entered text and associates an import error with the attempted method', async () => {
    const user = userEvent.setup()
    const baseProps: React.ComponentProps<typeof ImportLandingPage> = {
      onClearError: vi.fn(),
      onPasteJson: vi.fn(async () => {}),
      onLoadUrl: vi.fn(async () => {}),
      onOpenFile: vi.fn(async () => {}),
    }
    const view = renderWithProviders(<ImportLandingPage {...baseProps} />)
    await user.type(screen.getByLabelText(/paste json/i), '{broken}')
    await user.click(screen.getByRole('button', { name: /create project/i }))
    view.rerender(<ImportLandingPage {...baseProps} error="Unexpected token at position 1" />)
    expect(screen.getByLabelText(/paste json/i)).toHaveValue('{broken}')
    expect(screen.getByText(/unexpected token/i)).toBeVisible()
  })

  it('shows the return action only when a current project exists', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const { unmount } = renderWithProviders(
      <ImportLandingPage
        onClearError={() => {}}
        onPasteJson={async () => {}}
        onLoadUrl={async () => {}}
        onOpenFile={async () => {}}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole('button', { name: /back to current project/i }))
    expect(onCancel).toHaveBeenCalledOnce()
    unmount()
    renderLanding()
    expect(screen.queryByRole('button', { name: /back to current project/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Run the new tests and verify the missing component failure**

Run: `npm test -- src/features/projects/ImportLandingPage.test.tsx`

Expected: FAIL because `./ImportLandingPage` does not exist.

- [ ] **Step 3: Implement the shared project-page shell**

Create `src/features/projects/ProjectPageShell.tsx`:

```tsx
import type { ReactNode } from 'react'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav'

export type ProjectPageShellProps = {
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
```

- [ ] **Step 4: Implement the landing page with three equal Astryx cards**

Create `src/features/projects/ImportLandingPage.tsx`. Use these exact state transitions and public copy; render the three cards inside one responsive `Grid columns={{ minWidth: 280, max: 3, repeat: 'fit' }}` with `width="100%"` and `maxWidth={1120}`:

```tsx
import { useState, type FormEvent } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { ProjectPageShell } from './ProjectPageShell'

export type ImportMethod = 'file' | 'url' | 'paste'

export type ImportLandingPageProps = {
  error?: string
  onClearError(): void
  onPasteJson(text: string): Promise<void>
  onLoadUrl(url: string): Promise<void>
  onOpenFile(file: File): Promise<void>
  onCancel?(): void
}

export function ImportLandingPage(props: ImportLandingPageProps) {
  const [pasteText, setPasteText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pendingMethod, setPendingMethod] = useState<ImportMethod>()
  const [lastAttemptedMethod, setLastAttemptedMethod] = useState<ImportMethod>()
  const [localErrors, setLocalErrors] = useState<Partial<Record<ImportMethod, string>>>({})

  const isBusy = pendingMethod !== undefined

  function statusFor(method: ImportMethod) {
    const message = localErrors[method] ?? (lastAttemptedMethod === method ? props.error : undefined)
    return message ? { type: 'error' as const, message } : undefined
  }

  function clearMethod(method: ImportMethod) {
    setLocalErrors((current) => ({ ...current, [method]: undefined }))
    if (lastAttemptedMethod === method) setLastAttemptedMethod(undefined)
  }

  async function runImport(method: ImportMethod, action: () => Promise<void>) {
    props.onClearError()
    setLocalErrors((current) => ({ ...current, [method]: undefined }))
    setLastAttemptedMethod(method)
    setPendingMethod(method)
    try {
      await action()
    } finally {
      setPendingMethod(undefined)
    }
  }

  function submitUrl(event: FormEvent) {
    event.preventDefault()
    if (!url.trim()) {
      setLocalErrors((current) => ({ ...current, url: 'Enter a JSON URL.' }))
      return
    }
    void runImport('url', () => props.onLoadUrl(url.trim()))
  }

  function submitPaste(event: FormEvent) {
    event.preventDefault()
    if (!pasteText.trim()) {
      setLocalErrors((current) => ({ ...current, paste: 'Paste JSON before creating a project.' }))
      return
    }
    void runImport('paste', () => props.onPasteJson(pasteText))
  }

  return (
    <ProjectPageShell onCancel={props.onCancel}>
      <Section variant="muted" padding={10} minHeight={600}>
        <VStack gap={8} hAlign="center" className="importLanding-hero">
          <VStack gap={2} hAlign="center" maxWidth={720} className="importLanding-intro">
            <Text type="supporting">Inspect · Transform · Understand</Text>
            <Heading level={1}>Make complex JSON feel navigable.</Heading>
            <Text type="large" color="secondary">
              Open a file, load a URL, or paste raw JSON. Every route leads to the same focused workbench.
            </Text>
          </VStack>

          <Grid
            className="importLanding-grid"
            columns={{ minWidth: 280, max: 3, repeat: 'fit' }}
            gap={4}
            width="100%"
            maxWidth={1120}
          >
            <Card height="100%">
              <VStack gap={4} height="100%">
                <Heading level={2}>Open a file</Heading>
                <Text type="supporting">Drop a JSON document here or browse from your device.</Text>
                <FileInput
                  label="Open file"
                  value={file}
                  accept="application/json,.json"
                  mode="dropzone"
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'file'}
                  status={statusFor('file')}
                  onChange={(nextFile) => {
                    const selectedFile = Array.isArray(nextFile) ? nextFile[0] : nextFile
                    setFile(selectedFile ?? null)
                    clearMethod('file')
                    if (selectedFile) void runImport('file', () => props.onOpenFile(selectedFile))
                  }}
                />
              </VStack>
            </Card>

            <Card height="100%">
              <VStack as="form" gap={4} height="100%" onSubmit={submitUrl}>
                <Heading level={2}>Load from URL</Heading>
                <Text type="supporting">Fetch a public JSON response and open it directly.</Text>
                <TextInput
                  label="JSON URL"
                  value={url}
                  placeholder="https://example.com/data.json"
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'url'}
                  status={statusFor('url')}
                  onChange={(value) => {
                    setUrl(value)
                    clearMethod('url')
                  }}
                />
                <Button
                  label="Load JSON"
                  type="submit"
                  variant="secondary"
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'url'}
                />
              </VStack>
            </Card>

            <Card height="100%">
              <VStack as="form" gap={4} height="100%" onSubmit={submitPaste}>
                <Heading level={2}>Paste JSON</Heading>
                <TextArea
                  label="Paste JSON"
                  value={pasteText}
                  rows={8}
                  hasSpellCheck={false}
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'paste'}
                  status={statusFor('paste')}
                  onChange={(value) => {
                    setPasteText(value)
                    clearMethod('paste')
                  }}
                />
                <Button
                  label="Create project"
                  type="submit"
                  variant="secondary"
                  isDisabled={isBusy}
                  isLoading={pendingMethod === 'paste'}
                />
              </VStack>
            </Card>
          </Grid>

          <HStack gap={4} wrap="wrap" hAlign="center">
            <Text type="supporting">Runs in your browser</Text>
            <Text type="supporting">Warns before memory-risk input</Text>
            <Text type="supporting">Project state stays local</Text>
          </HStack>
        </VStack>
      </Section>

      <Section variant="transparent" padding={10}>
        <VStack gap={8} maxWidth={1120} className="importLanding-story">
          <VStack gap={2} maxWidth={720}>
            <Heading level={2}>From raw payload to a useful view.</Heading>
            <Text color="secondary">Inspect structure, shape data, and return without losing the thread.</Text>
          </VStack>
          <Grid columns={{ minWidth: 280, max: 3, repeat: 'fit' }} gap={8}>
            <VStack gap={2}><Text type="supporting">01 · Inspect</Text><Heading level={3}>Four views, one path</Heading><Text color="secondary">Columns, Tree, Table, and Source stay connected to the JSON path you are exploring.</Text></VStack>
            <VStack gap={2}><Text type="supporting">02 · Transform</Text><Heading level={3}>Build a data pipeline</Heading><Text color="secondary">Shape raw input with JavaScript or DuckDB while every processing step remains visible.</Text></VStack>
            <VStack gap={2}><Text type="supporting">03 · Continue</Text><Heading level={3}>Return with context</Heading><Text color="secondary">Local project persistence restores available source and workbench state.</Text></VStack>
          </Grid>
        </VStack>
      </Section>

      <Section variant="transparent" padding={6} dividers={['top']}>
        <HStack hAlign="between"><Text type="supporting">JSON Hunter</Text><Text type="supporting">Local JSON workbench</Text></HStack>
      </Section>
    </ProjectPageShell>
  )
}
```

- [ ] **Step 5: Add token-only landing bridge styles and policy tests**

Append only the layout details Astryx cannot express directly to `src/styles/app.css`:

```css
.importLanding-hero {
  background-image: radial-gradient(circle at top, var(--color-background-surface), transparent);
}

.importLanding-intro {
  text-align: center;
}

.importLanding-grid > * {
  min-width: 0;
}

.importLanding-story {
  margin-inline: auto;
}
```

Extend `src/styles/app-css.test.ts`:

```ts
it('keeps landing page atmosphere on Astryx tokens', () => {
  expect(css).toMatch(/\.importLanding-hero\s*\{[^}]*var\(--color-background-surface\)/s)
  expect(css).not.toMatch(/\.importLanding-[^{]+\{[^}]*(?:#[0-9a-fA-F]{3,8}|rgba?\(|\d+px)/s)
})
```

Extend `src/styles/astryx-ui-props.test.ts` by reading the two new files separately:

```ts
const projectPageSource = [
  'src/features/projects/ProjectPageShell.tsx',
  'src/features/projects/ImportLandingPage.tsx',
].map((filePath) => readFileSync(filePath, 'utf8')).join('\n')

it('uses Astryx primitives for the full-page project launcher', () => {
  expect(projectPageSource).not.toMatch(/<div\b/)
  expect(projectPageSource).toContain('height={height}')
  expect(projectPageSource).toContain("columns={{ minWidth: 280, max: 3, repeat: 'fit' }}")
})
```

Adjust the existing blanket AppShell/Section-default assertion so it continues to cover workbench files but excludes `ProjectPageShell.tsx` and `ImportLandingPage.tsx`, where explicit full-page region props are required by the approved design.

- [ ] **Step 6: Run landing and style tests**

Run: `npm test -- src/features/projects/ImportLandingPage.test.tsx src/styles/app-css.test.ts src/styles/astryx-ui-props.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the landing page slice**

```bash
git add src/features/projects/ProjectPageShell.tsx src/features/projects/ImportLandingPage.tsx src/features/projects/ImportLandingPage.test.tsx src/styles/app.css src/styles/app-css.test.ts src/styles/astryx-ui-props.test.ts
git commit -m "feat(landing): add equal JSON import entry points"
```

---

### Task 2: Build Full-Page Restore and Hydration Surfaces

**Files:**
- Create: `src/features/projects/ProjectRestorePage.tsx`
- Create: `src/features/projects/ProjectRestorePage.test.tsx`
- Create: `src/features/projects/ProjectLoadingPage.tsx`

**Interfaces:**
- Consumes: `ProjectPageShell` from Task 1.
- Produces:

```ts
export type ProjectRestorePageProps = {
  sourceLabel: string
  error?: string
  onReloadUrl?: () => Promise<void>
  onReselectFile?: (file: File) => Promise<void>
  onPasteAgain?: (text: string) => Promise<void>
}
```

- [ ] **Step 1: Write failing restore-page tests**

Create `src/features/projects/ProjectRestorePage.test.tsx` with three tests:

```tsx
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { ProjectRestorePage } from './ProjectRestorePage'

describe('ProjectRestorePage', () => {
  it('reloads a stored URL', async () => {
    const onReloadUrl = vi.fn(async () => {})
    renderWithProviders(<ProjectRestorePage sourceLabel="https://example.com/data.json" onReloadUrl={onReloadUrl} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /reload from url/i }))
    expect(onReloadUrl).toHaveBeenCalledOnce()
  })

  it('reselects a stored file', async () => {
    const onReselectFile = vi.fn(async () => {})
    renderWithProviders(<ProjectRestorePage sourceLabel="data.json" onReselectFile={onReselectFile} />)
    const file = new File(['{"ok":true}'], 'data.json', { type: 'application/json' })
    await userEvent.setup().upload(document.querySelector('input[type="file"]') as HTMLInputElement, file)
    expect(onReselectFile).toHaveBeenCalledWith(file)
  })

  it('preserves pasted replacement JSON while reporting an error', async () => {
    const onPasteAgain = vi.fn(async () => {})
    const view = renderWithProviders(<ProjectRestorePage sourceLabel="Pasted JSON" onPasteAgain={onPasteAgain} />)
    fireEvent.change(screen.getByLabelText(/paste json again/i), { target: { value: '{broken}' } })
    await userEvent.setup().click(screen.getByRole('button', { name: /paste again/i }))
    view.rerender(<ProjectRestorePage sourceLabel="Pasted JSON" error="Unexpected token" onPasteAgain={onPasteAgain} />)
    expect(screen.getByLabelText(/paste json again/i)).toHaveValue('{broken}')
    expect(screen.getByText(/unexpected token/i)).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the restore tests and verify the missing component failure**

Run: `npm test -- src/features/projects/ProjectRestorePage.test.tsx`

Expected: FAIL because `./ProjectRestorePage` does not exist.

- [ ] **Step 3: Implement source-aware restore and hydration pages**

Create `src/features/projects/ProjectRestorePage.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { ProjectPageShell } from './ProjectPageShell'

export type ProjectRestorePageProps = {
  sourceLabel: string
  error?: string
  onReloadUrl?: () => Promise<void>
  onReselectFile?: (file: File) => Promise<void>
  onPasteAgain?: (text: string) => Promise<void>
}

export function ProjectRestorePage({
  sourceLabel,
  error,
  onReloadUrl,
  onReselectFile,
  onPasteAgain,
}: ProjectRestorePageProps) {
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string>()
  const [file, setFile] = useState<File | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function runRestore(action: () => Promise<void>) {
    setIsPending(true)
    try {
      await action()
    } finally {
      setIsPending(false)
    }
  }

  function submitPaste(event: FormEvent) {
    event.preventDefault()
    if (!pasteText.trim()) {
      setPasteError('Paste JSON before restoring the project.')
      return
    }
    if (onPasteAgain) void runRestore(() => onPasteAgain(pasteText))
  }

  return (
    <ProjectPageShell>
      <Section variant="muted" padding={10} minHeight={600}>
        <VStack gap={6} hAlign="center">
          <VStack gap={2} hAlign="center" maxWidth={640} className="importLanding-intro">
            <Heading level={1}>Raw JSON required</Heading>
            <Text color="secondary">
              Restore the original source to continue this project's pipeline and viewer state.
            </Text>
          </VStack>
          <Card width="100%" maxWidth={640}>
            <VStack gap={4}>
              <Text type="supporting">{sourceLabel}</Text>
              {onReloadUrl && (
                <>
                  {error && <Banner status="error" title="Unable to reload JSON" description={error} />}
                  <Button
                    label="Reload from URL"
                    variant="primary"
                    isLoading={isPending}
                    clickAction={() => runRestore(onReloadUrl)}
                  />
                </>
              )}
              {onReselectFile && (
                <FileInput
                  label="Reselect file"
                  value={file}
                  accept="application/json,.json"
                  mode="dropzone"
                  isLoading={isPending}
                  status={error ? { type: 'error', message: error } : undefined}
                  onChange={(nextFile) => {
                    const selectedFile = Array.isArray(nextFile) ? nextFile[0] : nextFile
                    setFile(selectedFile ?? null)
                    if (selectedFile) void runRestore(() => onReselectFile(selectedFile))
                  }}
                />
              )}
              {onPasteAgain && (
                <VStack as="form" gap={4} onSubmit={submitPaste}>
                  <TextArea
                    label="Paste JSON again"
                    value={pasteText}
                    rows={10}
                    hasSpellCheck={false}
                    isLoading={isPending}
                    status={
                      pasteError || error
                        ? { type: 'error', message: pasteError ?? error }
                        : undefined
                    }
                    onChange={(value) => {
                      setPasteText(value)
                      setPasteError(undefined)
                    }}
                  />
                  <Button
                    label="Paste again"
                    type="submit"
                    variant="primary"
                    isLoading={isPending}
                  />
                </VStack>
              )}
            </VStack>
          </Card>
        </VStack>
      </Section>
    </ProjectPageShell>
  )
}
```

Create `src/features/projects/ProjectLoadingPage.tsx`:

```tsx
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
```

- [ ] **Step 4: Run restore tests**

Run: `npm test -- src/features/projects/ProjectRestorePage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the restore/loading slice**

```bash
git add src/features/projects/ProjectRestorePage.tsx src/features/projects/ProjectRestorePage.test.tsx src/features/projects/ProjectLoadingPage.tsx
git commit -m "feat(landing): add full-page project restoration"
```

---

### Task 3: Switch `App` Between Landing, Restore, Hydration, and Workbench

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Delete: `src/features/projects/ProjectLauncher.tsx`
- Delete: `src/features/projects/ProjectLauncher.test.tsx`
- Delete: `src/features/projects/ProjectRestorePanel.tsx`

**Interfaces:**
- Consumes: `ImportLandingPage`, `ProjectRestorePage`, and `ProjectLoadingPage` from Tasks 1–2.
- Produces: one mutually exclusive top-level page surface from `App`.

- [ ] **Step 1: Add failing top-level surface tests**

Add these assertions to `src/app/App.test.tsx`:

```tsx
it('shows the full landing page without empty workbench regions', async () => {
  renderWithProviders(<App />)
  expect(await screen.findByRole('heading', { name: /make complex json feel navigable/i })).toBeVisible()
  expect(screen.queryByRole('banner', { name: /pipeline/i })).toBeNull()
  expect(screen.queryByRole('region', { name: /json viewer/i })).toBeNull()
  expect(screen.queryByRole('complementary', { name: /details/i })).toBeNull()
})

it('returns from the new-project landing page to the unchanged workbench', async () => {
  const user = userEvent.setup()
  await createPasteProject(user)
  await user.click(screen.getByRole('button', { name: /open another json/i }))
  expect(await screen.findByRole('heading', { name: /make complex json feel navigable/i })).toBeVisible()
  await user.click(screen.getByRole('button', { name: /back to current project/i }))
  expect(await screen.findByRole('button', { name: /raw/i })).toBeVisible()
})

it('shows source restoration without workbench regions', async () => {
  listProjects.mockImplementation(async () => [makeUrlProject()])
  renderWithProviders(<App />)
  expect(await screen.findByRole('heading', { name: /raw json required/i })).toBeVisible()
  expect(screen.queryByRole('banner', { name: /pipeline/i })).toBeNull()
  expect(screen.queryByRole('region', { name: /json viewer/i })).toBeNull()
  expect(screen.queryByRole('complementary', { name: /details/i })).toBeNull()
})

it('shows a full-page hydration state without flashing the launcher', async () => {
  const deferred = createDeferred<WorkerResponse>()
  workerRequest.mockImplementationOnce(() => deferred.promise)
  listProjects.mockImplementation(async () => [makePasteProject()])
  renderWithProviders(<App />)
  expect(await screen.findByText(/restoring project/i)).toBeVisible()
  expect(screen.queryByRole('heading', { name: /make complex json feel navigable/i })).toBeNull()
})
```

- [ ] **Step 2: Run the focused App tests and verify they fail against the old shell**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the old workbench shell still renders on the launcher and restore states.

- [ ] **Step 3: Replace launcher/panel composition with early top-level page returns**

In `src/app/App.tsx`, replace `ProjectLauncher` and `ProjectRestorePanel` imports with:

```ts
import type { ReactNode } from 'react'
import { ImportLandingPage } from '../features/projects/ImportLandingPage'
import { ProjectLoadingPage } from '../features/projects/ProjectLoadingPage'
import { ProjectRestorePage } from '../features/projects/ProjectRestorePage'
```

Merge the `ReactNode` type into the existing React import rather than adding a second import declaration.

Keep the current async handlers. Immediately before the loaded workbench JSX, derive one `content` value in this order:

```tsx
let content: ReactNode

if (isHydrating) {
  content = <ProjectLoadingPage />
} else if (!hasProject || isProjectLauncherOpen) {
  content = (
    <ImportLandingPage
      error={error}
      onClearError={() => setError(undefined)}
      onPasteJson={handleCreateFromPaste}
      onLoadUrl={handleLoadUrl}
      onOpenFile={handleOpenFile}
      onCancel={hasProject ? handleCloseProjectLauncher : undefined}
    />
  )
} else if (!hasLoadedRaw) {
  if (project.rawSource.type === 'url') {
    const { url } = project.rawSource
    content = <ProjectRestorePage sourceLabel={url} error={error} onReloadUrl={() => handleReloadUrl(url)} />
  } else if (project.rawSource.type === 'file') {
    content = (
      <ProjectRestorePage
        sourceLabel={project.rawSource.fileName}
        error={error}
        onReselectFile={handleRestoreFile}
      />
    )
  } else {
    content = (
      <ProjectRestorePage
        sourceLabel={project.rawSource.label}
        error={error}
        onPasteAgain={handleRestorePaste}
      />
    )
  }
} else {
  content = loadedWorkbench
}

return content
```

Define `loadedWorkbench` immediately before this selection from the existing workbench shell with `PipelineFlow`, `ErrorBanner`, `NodeEditor`/`JsonViewer`, and `DetailsPreview`. Remove `projectLauncher`, the fallback branch of `pipelinePane`, `restorePane`, the no-project branch of `viewerPane`, and `isAutoHydratingPersistedRawProject` because those states no longer reach the workbench JSX.

Delete the old launcher and restore-panel files only after all imports are gone.

- [ ] **Step 4: Run App and project feature tests**

Run: `npm test -- src/app/App.test.tsx src/features/projects/ImportLandingPage.test.tsx src/features/projects/ProjectRestorePage.test.tsx`

Expected: PASS. Existing import helpers still find `Paste JSON` and `Create project` by accessible name.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS with no stale imports or callback return-type errors.

- [ ] **Step 6: Commit the top-level state transition**

```bash
git add src/app/App.tsx src/app/App.test.tsx src/features/projects/ProjectLauncher.tsx src/features/projects/ProjectLauncher.test.tsx src/features/projects/ProjectRestorePanel.tsx
git commit -m "refactor(app): separate import pages from workbench"
```

---

### Task 4: Replace Native Memory Confirmation With an Astryx Dialog

**Files:**
- Create: `src/features/projects/MemoryRiskDialog.tsx`
- Create: `src/features/projects/MemoryRiskDialog.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `RAW_WARNING_LIMIT_BYTES` and `getRawSizeBytes` already imported by `App`.
- Produces:

```ts
export type MemoryRiskDialogProps = {
  isOpen: boolean
  warningLimitMiB: number
  onCancel(): void
  onConfirm(): void
}

type MemoryRiskRequest = {
  warningLimitMiB: number
  resolve(shouldContinue: boolean): void
}
```

- [ ] **Step 1: Write failing dialog tests**

Create `MemoryRiskDialog.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { MemoryRiskDialog } from './MemoryRiskDialog'

describe('MemoryRiskDialog', () => {
  it('requires an explicit continue or cancel decision', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    renderWithProviders(
      <MemoryRiskDialog isOpen warningLimitMiB={100} onCancel={onCancel} onConfirm={onConfirm} />,
    )
    expect(screen.getByRole('heading', { name: /large json may use significant memory/i })).toBeVisible()
    expect(screen.getByText(/100 mib/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /continue loading/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: /cancel import/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the dialog test and verify the missing component failure**

Run: `npm test -- src/features/projects/MemoryRiskDialog.test.tsx`

Expected: FAIL because `./MemoryRiskDialog` does not exist.

- [ ] **Step 3: Implement the required-purpose Astryx dialog**

Create `MemoryRiskDialog.tsx`:

```tsx
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'

export type MemoryRiskDialogProps = {
  isOpen: boolean
  warningLimitMiB: number
  onCancel(): void
  onConfirm(): void
}

export function MemoryRiskDialog({ isOpen, warningLimitMiB, onCancel, onConfirm }: MemoryRiskDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      purpose="required"
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
    >
      <Layout
        header={<DialogHeader title="Large JSON may use significant memory" />}
        content={
          <LayoutContent>
            <Text>
              This JSON is over {warningLimitMiB} MiB. Continuing may consume significant browser memory.
            </Text>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel import" variant="secondary" onClick={onCancel} />
              <Button label="Continue loading" variant="primary" onClick={onConfirm} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
```

- [ ] **Step 4: Add failing App tests for cancel and continue**

Replace the `window.confirm` test in `App.test.tsx` with:

```tsx
it('cancels memory-risk JSON without parsing or leaving the landing page', async () => {
  const user = userEvent.setup()
  rawSizeBytesOverride.value = 100 * 1024 * 1024 + 1

  await createPasteProjectFromText(user, '{"items":[]}')

  expect(await screen.findByRole('heading', { name: /large json may use significant memory/i })).toBeVisible()
  expect(workerRequest).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'parseRaw' }))
  await user.click(screen.getByRole('button', { name: /cancel import/i }))
  expect(screen.getByRole('heading', { name: /make complex json feel navigable/i })).toBeVisible()
  expect(screen.getByLabelText(/paste json/i)).toHaveValue('{"items":[]}')
  expect(workerRequest).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'parseRaw' }))
})

it('continues parsing memory-risk JSON after explicit confirmation', async () => {
  const user = userEvent.setup()
  rawSizeBytesOverride.value = 100 * 1024 * 1024 + 1

  await createPasteProjectFromText(user, '{"items":[]}')

  expect(await screen.findByRole('heading', { name: /large json may use significant memory/i })).toBeVisible()
  expect(workerRequest).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'parseRaw' }))
  await user.click(screen.getByRole('button', { name: /continue loading/i }))
  expect(await screen.findByRole('button', { name: /raw/i })).toBeVisible()
  expect(workerRequest).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'parseRaw', rawJsonText: '{"items":[]}' }),
  )
})
```

- [ ] **Step 5: Add promise-backed memory confirmation to `App`**

Delete the module-level `shouldContinueMemoryRiskLoad` function. Add state and helpers inside `App`:

```tsx
type MemoryRiskRequest = {
  warningLimitMiB: number
  resolve(shouldContinue: boolean): void
}

const [memoryRiskRequest, setMemoryRiskRequest] = useState<MemoryRiskRequest>()

function requestMemoryRiskConfirmation(rawJsonText: string): Promise<boolean> {
  const rawSizeBytes = getRawSizeBytes(rawJsonText)
  if (rawSizeBytes <= RAW_WARNING_LIMIT_BYTES) return Promise.resolve(true)
  const warningLimitMiB = Math.round(RAW_WARNING_LIMIT_BYTES / 1024 / 1024)
  return new Promise((resolve) => setMemoryRiskRequest({ warningLimitMiB, resolve }))
}

function resolveMemoryRiskRequest(shouldContinue: boolean) {
  const request = memoryRiskRequest
  if (!request) return
  setMemoryRiskRequest(undefined)
  request.resolve(shouldContinue)
}
```

Change both guards to await the decision:

```ts
if (!(await requestMemoryRiskConfirmation(rawJsonText))) return
```

Render the dialog alongside every top-level surface by assigning the chosen page to a `content` variable and returning a fragment:

```tsx
return (
  <>
    {content}
    <MemoryRiskDialog
      isOpen={memoryRiskRequest !== undefined}
      warningLimitMiB={memoryRiskRequest?.warningLimitMiB ?? Math.round(RAW_WARNING_LIMIT_BYTES / 1024 / 1024)}
      onCancel={() => resolveMemoryRiskRequest(false)}
      onConfirm={() => resolveMemoryRiskRequest(true)}
    />
  </>
)
```

Replace Task 3's `return content` with this fragment so an oversized landing or restore submission can open the modal over the current page.

- [ ] **Step 6: Run dialog and App tests**

Run: `npm test -- src/features/projects/MemoryRiskDialog.test.tsx src/app/App.test.tsx`

Expected: PASS, and no test spies on `window.confirm`.

- [ ] **Step 7: Commit the dialog slice**

```bash
git add src/features/projects/MemoryRiskDialog.tsx src/features/projects/MemoryRiskDialog.test.tsx src/app/App.tsx src/app/App.test.tsx
git commit -m "feat(landing): confirm large JSON with Astryx dialog"
```

---

### Task 5: Verify Responsive Landing Behavior and the Full Workflow

**Files:**
- Modify: `tests/e2e/workbench.spec.ts`

**Interfaces:**
- Consumes: `.importLanding-grid`, accessible import headings, and the existing Raw pipeline button.
- Produces: desktop/tablet/mobile coverage for the entry page and one complete landing-to-workbench path.

- [ ] **Step 1: Add a failing responsive landing E2E test**

Add to `tests/e2e/workbench.spec.ts`:

```ts
test('keeps all import methods visible while the grid reflows', async ({ page }) => {
  await page.goto('/')

  for (const viewport of [
    { width: 1440, height: 1000, expectedColumns: 3 },
    { width: 800, height: 900, expectedColumns: 2 },
    { width: 390, height: 844, expectedColumns: 1 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('heading', { name: /open a file/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /load from url/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /paste json/i })).toBeVisible()

    const columns = await page.locator('.importLanding-grid').evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
    )
    expect(columns).toBe(viewport.expectedColumns)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
})
```

- [ ] **Step 2: Run the focused E2E test and inspect any responsive mismatch**

Run: `npm run e2e -- --grep "keeps all import methods visible"`

Expected: PASS. If Astryx `Grid` resolves a different tablet column count, adjust only the documented `minWidth` component prop and rerun; do not add manual CSS grid or raw-pixel media queries.

- [ ] **Step 3: Update the existing paste-project E2E flow**

Add these assertions to the beginning of the existing `creates a paste project and restores it after refresh` test, immediately after `page.goto('/')`:

```ts
await expect(page.getByRole('heading', { name: /make complex json feel navigable/i })).toBeVisible()
await expect(page.getByRole('banner', { name: /pipeline/i })).toHaveCount(0)
await expect(page.getByRole('region', { name: /json viewer/i })).toHaveCount(0)
await expect(page.getByRole('complementary', { name: /details/i })).toHaveCount(0)
```

After the existing Raw-button assertion, add:

```ts
await expect(page.getByRole('banner', { name: /pipeline/i })).toBeVisible()
await expect(page.getByRole('region', { name: /json viewer/i })).toBeVisible()
await expect(page.getByRole('complementary', { name: /details/i })).toBeVisible()
await expect(page.getByRole('heading', { name: /make complex json feel navigable/i })).toHaveCount(0)
```

Keep the existing accessible selectors for `Paste JSON`, `Create project`, and `Raw`; these assertions prove the page transition rather than merely project creation.

- [ ] **Step 4: Run the complete verification suite**

Run each command independently:

```bash
npm test
npm run typecheck
npm run build
npm run e2e
```

Expected: every command exits 0. Record the test counts and any intentionally skipped Playwright projects in the handoff.

- [ ] **Step 5: Inspect desktop and mobile pages in a real browser**

Start Vite, open the landing page at 1440×1000 and 390×844, and verify:

- All three import cards have equal hierarchy.
- The file dropzone, URL input, and paste area remain usable.
- No card content clips or creates horizontal overflow.
- The capability narrative follows the hero without resembling an empty workbench.
- `Open another JSON` shows the landing page and `Back to current project` returns to the prior workbench.
- A failed parse leaves pasted text and the prior project intact.

- [ ] **Step 6: Commit the E2E and final-polish slice**

```bash
git add tests/e2e/workbench.spec.ts src/styles/app.css src/styles/app-css.test.ts src/styles/astryx-ui-props.test.ts
git commit -m "test(landing): cover responsive import workflow"
```

---

## Final Verification Checklist

- [ ] `git status --short` contains only intended plan or implementation files.
- [ ] No production file imports `ProjectLauncher` or `ProjectRestorePanel`.
- [ ] `rg -n "window\.confirm|<div\\b|#[0-9a-fA-F]{3,8}|rgba?\\(" src/app src/features/projects src/styles/app.css` reports no new prohibited landing implementation.
- [ ] Landing, restore, hydration, dialog, and workbench states are mutually exclusive except that the dialog overlays the active page.
- [ ] File, URL, and paste remain simultaneously discoverable at desktop, tablet, and mobile widths.
- [ ] A canceled or failed import does not replace an existing project.
- [ ] Unit tests, typecheck, build, and Playwright all exit 0.
