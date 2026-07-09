# Astryx UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workbench's custom HTML/CSS UI with Astryx components while preserving existing JSON pipeline behavior.

**Architecture:** Keep the current business orchestration and feature boundaries intact. Replace each presentation component with Astryx primitives, allowing small DOM bridge wrappers only for Monaco and TanStack Virtual. Reduce `src/styles/app.css` to token-based bridge styles.

**Tech Stack:** Vite, React, TypeScript, Astryx, Zustand, Monaco, TanStack Virtual, Vitest, React Testing Library, Playwright.

---

## File Structure

- Modify: `src/app/AppShell.tsx`
  - Responsibility: Workbench frame using Astryx `AppShell`, `Layout`, `LayoutHeader`, `LayoutContent`, and `LayoutPanel`.
- Create: `src/app/AppShell.test.tsx`
  - Responsibility: Locks accessible frame regions without testing Astryx internals.
- Modify: `src/app/App.tsx`
  - Responsibility: Remove custom `editorPane` wrappers and pass Astryx-ready nodes into the frame.
- Modify: `src/features/projects/ProjectLauncher.tsx`
  - Responsibility: Launcher form using Astryx `Section`, `VStack`, `Heading`, `TextArea`, `TextInput`, `FileInput`, and `Button`.
- Modify: `src/features/projects/ProjectRestorePanel.tsx`
  - Responsibility: Restore form using Astryx inputs and sections.
- Modify: `src/features/projects/ProjectLauncher.test.tsx`
  - Responsibility: Preserve paste, URL, and file workflows through accessible fields.
- Modify: `src/features/pipeline/PipelineFlow.tsx`
  - Responsibility: Pipeline node rows/actions using Astryx `Toolbar`, `Item`, `Token`, `StatusDot`, and `Button`.
- Modify: `src/features/pipeline/NodeEditor.tsx`
  - Responsibility: Monaco bridge wrapped in Astryx `Section`, `Toolbar`, and `Button`.
- Modify: `src/features/pipeline/ErrorBanner.tsx`
  - Responsibility: Error feedback using Astryx `Banner`.
- Modify: `src/features/pipeline/*.test.tsx`
  - Responsibility: Preserve node selection, editor actions, and error alert behavior.
- Modify: `src/features/viewer/JsonViewer.tsx`
  - Responsibility: Viewer shell using Astryx `Section`, `Toolbar`, `Stack`, and mode content.
- Modify: `src/features/viewer/ViewSwitcher.tsx`
  - Responsibility: Use Astryx `TabList` and `Tab`.
- Modify: `src/features/viewer/Breadcrumb.tsx`
  - Responsibility: Use Astryx `Breadcrumbs` and `BreadcrumbItem`.
- Modify: `src/features/viewer/ColumnsView.tsx`
- Modify: `src/features/viewer/TreeView.tsx`
- Modify: `src/features/viewer/TableView.tsx`
- Modify: `src/features/viewer/SourceView.tsx`
  - Responsibility: Mode sections with Astryx headers, reset buttons, and `Item` rows while keeping `VirtualRows`.
- Modify: `src/features/viewer/VirtualRows.tsx`
  - Responsibility: Keep TanStack Virtual DOM bridge and use token-oriented classes only.
- Modify: `src/features/viewer/JsonViewer.test.tsx`
  - Responsibility: Preserve mode switching, virtualization, row selection, and labels.
- Modify: `src/features/details/DetailsPreview.tsx`
  - Responsibility: Details inspector using Astryx `Section`, `Heading`, `Text`, `MetadataList`, `MetadataListItem`, and `Token`.
- Modify: `src/features/details/DetailsPreview.test.tsx`
  - Responsibility: Preserve details facts and accessible inspector content.
- Modify: `src/styles/app.css`
  - Responsibility: Token-based bridge styles only.
- Create: `src/styles/app-css.test.ts`
  - Responsibility: Static guard against raw broad custom theme CSS.
- Modify: `tests/e2e/workbench.spec.ts`
  - Responsibility: Update selectors only where old class names were used.

---

## Task 1: Astryx Workbench Frame

**Files:**
- Create: `src/app/AppShell.test.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write the failing frame test**

Create `src/app/AppShell.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/render'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('exposes the workbench frame regions with accessible labels', () => {
    renderWithProviders(
      <AppShell
        pipeline={<span>Pipeline content</span>}
        viewer={<span>Viewer content</span>}
        details={<span>Details content</span>}
      />,
    )

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('banner', { name: /pipeline/i })).toHaveTextContent('Pipeline content')
    expect(screen.getByRole('region', { name: /json viewer/i })).toHaveTextContent('Viewer content')
    expect(screen.getByRole('complementary', { name: /details/i })).toHaveTextContent('Details content')
  })
})
```

- [ ] **Step 2: Run the frame test to verify it fails**

Run:

```bash
npm test -- src/app/AppShell.test.tsx
```

Expected: FAIL because the current custom frame has no labelled `banner`, `region`, or `complementary` regions.

- [ ] **Step 3: Replace the custom frame with Astryx layout components**

Replace `src/app/AppShell.tsx` with:

```tsx
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
```

- [ ] **Step 4: Remove App-level custom pane wrappers**

In `src/app/App.tsx`, remove the two `editorPane` wrapper `<div>` elements so the viewer pane is pure content. Replace the `viewerPane` creation with this shape:

```tsx
  const viewerPane = hasProject ? (
    <>
      <ErrorBanner message={error} />
      {draft ? (
        <>
          <NodeEditor
            language={language}
            value={editorValue}
            onChange={(nextValue) => {
              setEditorValue(nextValue)
              setLatestDraftOutput(undefined)
            }}
            onRun={() => void handleRun()}
            onSave={() => void handleSave()}
            onCancel={handleCancel}
          />
          {displayedValue !== undefined && displayedSourceNodeId === draft.node.id && (
            <JsonViewer
              mode={viewerMode}
              selectedPath={selectedPath}
              breadcrumb={formatPath(['root', ...selectedPath])}
              rows={viewerRows}
              onModeChange={setViewerMode}
              onSelectPath={setSelectedPath}
              onWindowChange={handleViewerWindowChange}
            />
          )}
        </>
      ) : hasLoadedRaw ? (
        <JsonViewer
          mode={viewerMode}
          selectedPath={selectedPath}
          breadcrumb={formatPath(['root', ...selectedPath])}
          rows={viewerRows}
          onModeChange={setViewerMode}
          onSelectPath={setSelectedPath}
          onWindowChange={handleViewerWindowChange}
        />
      ) : (
        restorePane
      )}
    </>
  ) : (
    <ErrorBanner message={error} />
  )
```

- [ ] **Step 5: Run the frame test to verify it passes**

Run:

```bash
npm test -- src/app/AppShell.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run the app tests touched by the frame**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: Existing behavior tests pass, except tests that assert old CSS classes are updated in later tasks.

- [ ] **Step 7: Commit the frame slice**

```bash
git add src/app/AppShell.tsx src/app/AppShell.test.tsx src/app/App.tsx
git commit -m "refactor: migrate workbench frame to Astryx"
```

---

## Task 2: Astryx Project Launcher And Restore Forms

**Files:**
- Modify: `src/features/projects/ProjectLauncher.test.tsx`
- Modify: `src/features/projects/ProjectLauncher.tsx`
- Modify: `src/features/projects/ProjectRestorePanel.tsx`

- [ ] **Step 1: Add failing launcher coverage for URL and file controls**

Extend `src/features/projects/ProjectLauncher.test.tsx` with:

```tsx
  it('submits a JSON URL', async () => {
    const user = userEvent.setup()
    let submitted = ''
    renderWithProviders(
      <ProjectLauncher
        onPasteJson={() => {}}
        onLoadUrl={(url) => {
          submitted = url
        }}
        onOpenFile={() => {}}
      />,
    )

    await user.type(screen.getByLabelText(/json url/i), 'https://example.com/data.json')
    await user.click(screen.getByRole('button', { name: /load url/i }))

    expect(submitted).toBe('https://example.com/data.json')
  })

  it('submits a selected JSON file', async () => {
    const user = userEvent.setup()
    const file = new File(['{"ok":true}'], 'data.json', { type: 'application/json' })
    let submitted: File | undefined
    renderWithProviders(
      <ProjectLauncher
        onPasteJson={() => {}}
        onLoadUrl={() => {}}
        onOpenFile={(nextFile) => {
          submitted = nextFile
        }}
      />,
    )

    await user.upload(screen.getByLabelText(/open file/i), file)

    expect(submitted).toBe(file)
  })
```

- [ ] **Step 2: Run launcher tests to verify the new tests fail if FileInput is not wired**

Run:

```bash
npm test -- src/features/projects/ProjectLauncher.test.tsx
```

Expected: The paste and URL tests pass in the current app. The file test may pass with the native input; keep it as a guard while replacing the control with Astryx `FileInput`.

- [ ] **Step 3: Replace launcher markup with Astryx form components**

Replace `src/features/projects/ProjectLauncher.tsx` with:

```tsx
import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Section } from '@astryxdesign/core/Section'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading } from '@astryxdesign/core/Heading'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'

type ProjectLauncherProps = {
  onPasteJson(text: string): void
  onLoadUrl(url: string): void
  onOpenFile(file: File): void
}

export function ProjectLauncher({ onPasteJson, onLoadUrl, onOpenFile }: ProjectLauncherProps) {
  const [pasteText, setPasteText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)

  return (
    <Section variant="transparent" padding={6}>
      <VStack gap={4}>
        <Heading level={1}>JSON Hunter</Heading>
        <TextArea
          label="Paste JSON"
          value={pasteText}
          onChange={setPasteText}
          rows={8}
          hasSpellCheck={false}
        />
        <Button label="Create from paste" variant="primary" onClick={() => onPasteJson(pasteText)} />
        <TextInput
          label="JSON URL"
          value={url}
          onChange={setUrl}
          placeholder="https://example.com/data.json"
        />
        <Button label="Load URL" onClick={() => onLoadUrl(url)} />
        <FileInput
          label="Open file"
          value={file}
          accept="application/json,.json"
          onChange={(nextFile) => {
            const selectedFile = Array.isArray(nextFile) ? nextFile[0] : nextFile
            setFile(selectedFile ?? null)
            if (selectedFile) onOpenFile(selectedFile)
          }}
        />
      </VStack>
    </Section>
  )
}
```

- [ ] **Step 4: Replace restore panel markup with Astryx components**

Replace `src/features/projects/ProjectRestorePanel.tsx` with:

```tsx
import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Section } from '@astryxdesign/core/Section'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'

type ProjectRestorePanelProps = {
  sourceLabel: string
  onReloadUrl?: () => void
  onReselectFile?: (file: File) => void
  onPasteAgain?: (text: string) => void
}

export function ProjectRestorePanel({
  sourceLabel,
  onReloadUrl,
  onReselectFile,
  onPasteAgain,
}: ProjectRestorePanelProps) {
  const [pasteText, setPasteText] = useState('')
  const [file, setFile] = useState<File | null>(null)

  return (
    <Section variant="transparent" padding={6}>
      <VStack gap={4}>
        <Heading level={2}>Raw JSON required</Heading>
        <Text type="supporting" display="block">
          {sourceLabel}
        </Text>
        {onReloadUrl && <Button label="Reload from URL" variant="primary" onClick={onReloadUrl} />}
        {onReselectFile && (
          <FileInput
            label="Reselect file"
            value={file}
            accept="application/json,.json"
            onChange={(nextFile) => {
              const selectedFile = Array.isArray(nextFile) ? nextFile[0] : nextFile
              setFile(selectedFile ?? null)
              if (selectedFile) onReselectFile(selectedFile)
            }}
          />
        )}
        {onPasteAgain && (
          <>
            <TextArea
              label="Paste JSON again"
              value={pasteText}
              onChange={setPasteText}
              rows={8}
              hasSpellCheck={false}
            />
            <Button label="Paste again" variant="primary" onClick={() => onPasteAgain(pasteText)} />
          </>
        )}
      </VStack>
    </Section>
  )
}
```

- [ ] **Step 5: Run form tests**

Run:

```bash
npm test -- src/features/projects/ProjectLauncher.test.tsx src/app/App.test.tsx
```

Expected: PASS. The app tests should still find labels `Paste JSON`, `JSON URL`, `Open file`, `Paste JSON again`, and restore buttons.

- [ ] **Step 6: Commit the form slice**

```bash
git add src/features/projects/ProjectLauncher.tsx src/features/projects/ProjectRestorePanel.tsx src/features/projects/ProjectLauncher.test.tsx
git commit -m "refactor: migrate project forms to Astryx"
```

---

## Task 3: Astryx Pipeline, Node Editor, And Error Feedback

**Files:**
- Modify: `src/features/pipeline/PipelineFlow.test.tsx`
- Modify: `src/features/pipeline/ErrorBanner.test.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/pipeline/PipelineFlow.tsx`
- Modify: `src/features/pipeline/NodeEditor.tsx`
- Modify: `src/features/pipeline/ErrorBanner.tsx`

- [ ] **Step 1: Add pipeline status assertions that do not depend on old classes**

In `src/features/pipeline/PipelineFlow.test.tsx`, add:

```tsx
  it('renders visible node status text', () => {
    renderWithProviders(
      <PipelineFlow
        nodes={[
          { id: 'raw', type: 'raw', label: 'Raw' },
          { id: 'js-1', type: 'js', label: 'Normalize', code: 'export default input => input' },
        ]}
        activeNodeId="raw"
        nodeStatuses={{ raw: 'active', 'js-1': 'stale' }}
        onSelectNode={() => {}}
        onAddNode={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /raw/i })).toHaveTextContent(/active/i)
    expect(screen.getByRole('button', { name: /normalize/i })).toHaveTextContent(/stale/i)
  })
```

- [ ] **Step 2: Add ErrorBanner alert coverage**

In `src/features/pipeline/ErrorBanner.test.tsx`, add:

```tsx
import { screen } from '@testing-library/react'

  it('renders execution errors as alerts', () => {
    render(<ErrorBanner message="Transform failed" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Execution error')
    expect(screen.getByRole('alert')).toHaveTextContent('Transform failed')
  })
```

- [ ] **Step 3: Update stale-node app assertion before implementation**

In `src/app/App.test.tsx`, replace:

```tsx
    expect(screen.getByRole('button', { name: /duckdb 1/i })).toHaveClass('pipelineNode-stale')
```

with:

```tsx
    expect(screen.getByRole('button', { name: /duckdb 1/i })).toHaveTextContent(/stale/i)
```

- [ ] **Step 4: Run pipeline tests to verify red/guard state**

Run:

```bash
npm test -- src/features/pipeline/PipelineFlow.test.tsx src/features/pipeline/ErrorBanner.test.tsx src/app/App.test.tsx
```

Expected: Pipeline status test fails because status is currently only encoded in class names. Error alert may already pass because the old component used `role="alert"`.

- [ ] **Step 5: Replace PipelineFlow with Astryx components**

Replace `src/features/pipeline/PipelineFlow.tsx` with:

```tsx
import { Button } from '@astryxdesign/core/Button'
import { Item } from '@astryxdesign/core/Item'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import type { PipelineNode, PipelineNodeStatus, PipelineNodeType } from '../../domain/pipelineTypes'

type PipelineFlowProps = {
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
  onSelectNode(id: string): void
  onEditNode?(id: string): void
  onAddNode(type: Exclude<PipelineNodeType, 'raw'>): void
}

function statusVariant(status: PipelineNodeStatus | undefined) {
  if (status === 'active') return 'success'
  if (status === 'error' || status === 'blocked') return 'error'
  if (status === 'stale') return 'warning'
  return 'neutral'
}

function statusLabel(status: PipelineNodeStatus | undefined) {
  return status ?? 'inactive'
}

export function PipelineFlow({ nodes, activeNodeId, nodeStatuses, onSelectNode, onEditNode, onAddNode }: PipelineFlowProps) {
  return (
    <Toolbar
      label="Pipeline"
      size="sm"
      variant="transparent"
      startContent={
        <HStack gap={2} wrap="wrap" align="center" as="section" aria-label="Pipeline nodes">
          <Text type="label">Pipeline</Text>
          {nodes.map((node) => {
            const status = statusLabel(nodeStatuses[node.id])
            return (
              <Item
                key={node.id}
                label={node.label}
                description={node.type}
                density="compact"
                isSelected={node.id === activeNodeId}
                onClick={() => onSelectNode(node.id)}
                startContent={<StatusDot variant={statusVariant(nodeStatuses[node.id])} label={`${node.label} ${status}`} />}
                endContent={
                  <HStack gap={1} align="center">
                    <Token label={status} size="sm" color={status === 'stale' ? 'yellow' : status === 'error' ? 'red' : 'gray'} />
                    {node.type !== 'raw' && onEditNode ? (
                      <Button label={`Edit ${node.label}`} size="sm" variant="ghost" onClick={() => onEditNode(node.id)}>
                        Edit
                      </Button>
                    ) : null}
                  </HStack>
                }
              />
            )
          })}
        </HStack>
      }
      endContent={
        <VStack gap={1}>
          <Button label="Add JS" size="sm" onClick={() => onAddNode('js')} />
          <Button label="Add DuckDB" size="sm" onClick={() => onAddNode('duckdb')} />
        </VStack>
      }
    />
  )
}
```

- [ ] **Step 6: Replace NodeEditor with Astryx section and toolbar**

Replace `src/features/pipeline/NodeEditor.tsx` with:

```tsx
import { lazy, Suspense } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Section } from '@astryxdesign/core/Section'
import { Text } from '@astryxdesign/core/Text'
import { Toolbar } from '@astryxdesign/core/Toolbar'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

type NodeEditorProps = {
  language: 'javascript' | 'sql'
  value: string
  onChange(value: string): void
  onRun(): void
  onSave(): void
  onCancel(): void
}

export function NodeEditor({ language, value, onChange, onRun, onSave, onCancel }: NodeEditorProps) {
  return (
    <Section variant="transparent" padding={3}>
      <Suspense fallback={<Text type="supporting">Loading editor...</Text>}>
        <MonacoEditor
          height="180px"
          language={language}
          value={value}
          theme="vs-dark"
          onChange={(next) => onChange(next ?? '')}
          options={{ minimap: { enabled: false }, scrollBeyondLastLine: false }}
        />
      </Suspense>
      <Toolbar
        label="Node editor actions"
        size="sm"
        endContent={
          <>
            <Button label="Run" variant="primary" onClick={onRun} />
            <Button label="Save" onClick={onSave} />
            <Button label="Cancel" variant="ghost" onClick={onCancel} />
          </>
        }
      />
    </Section>
  )
}
```

- [ ] **Step 7: Replace ErrorBanner with Astryx Banner**

Replace `src/features/pipeline/ErrorBanner.tsx` with:

```tsx
import { Banner } from '@astryxdesign/core/Banner'

type ErrorBannerProps = {
  message?: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null

  return <Banner status="error" title="Execution error" description={message} container="section" />
}
```

- [ ] **Step 8: Run pipeline and app tests**

Run:

```bash
npm test -- src/features/pipeline/PipelineFlow.test.tsx src/features/pipeline/NodeEditor.test.tsx src/features/pipeline/ErrorBanner.test.tsx src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit the pipeline slice**

```bash
git add src/features/pipeline/PipelineFlow.tsx src/features/pipeline/NodeEditor.tsx src/features/pipeline/ErrorBanner.tsx src/features/pipeline/PipelineFlow.test.tsx src/features/pipeline/ErrorBanner.test.tsx src/app/App.test.tsx
git commit -m "refactor: migrate pipeline controls to Astryx"
```

---

## Task 4: Astryx JSON Viewer Toolbar, Tabs, Breadcrumbs, And Rows

**Files:**
- Modify: `src/features/viewer/JsonViewer.test.tsx`
- Modify: `src/features/viewer/JsonViewer.tsx`
- Modify: `src/features/viewer/ViewSwitcher.tsx`
- Modify: `src/features/viewer/Breadcrumb.tsx`
- Modify: `src/features/viewer/ColumnsView.tsx`
- Modify: `src/features/viewer/TreeView.tsx`
- Modify: `src/features/viewer/TableView.tsx`
- Modify: `src/features/viewer/SourceView.tsx`

- [ ] **Step 1: Update viewer tests to expect tabs**

In `src/features/viewer/JsonViewer.test.tsx`, replace clicks like:

```tsx
await user.click(screen.getByRole('button', { name: /table/i }))
```

with:

```tsx
await user.click(screen.getByRole('tab', { name: /table/i }))
```

Also add:

```tsx
expect(screen.getByRole('tablist')).toBeInTheDocument()
```

- [ ] **Step 2: Run viewer tests to verify tab expectations fail**

Run:

```bash
npm test -- src/features/viewer/JsonViewer.test.tsx
```

Expected: FAIL because the current mode switcher uses a generic button group, not Astryx tabs.

- [ ] **Step 3: Replace ViewSwitcher with Astryx TabList**

Replace `src/features/viewer/ViewSwitcher.tsx` with:

```tsx
import { Tab, TabList } from '@astryxdesign/core/TabList'
import type { ViewerMode } from '../../domain/viewTypes'

const modes: ViewerMode[] = ['columns', 'tree', 'table', 'source']

type ViewSwitcherProps = {
  mode: ViewerMode
  onModeChange(mode: ViewerMode): void
}

function labelForMode(mode: ViewerMode) {
  return mode[0].toUpperCase() + mode.slice(1)
}

export function ViewSwitcher({ mode, onModeChange }: ViewSwitcherProps) {
  return (
    <TabList value={mode} onChange={(nextMode) => onModeChange(nextMode as ViewerMode)} size="sm">
      {modes.map((candidate) => (
        <Tab key={candidate} value={candidate}>
          {labelForMode(candidate)}
        </Tab>
      ))}
    </TabList>
  )
}
```

- [ ] **Step 4: Replace Breadcrumb with Astryx Breadcrumbs**

Replace `src/features/viewer/Breadcrumb.tsx` with:

```tsx
import { BreadcrumbItem, Breadcrumbs } from '@astryxdesign/core/Breadcrumbs'

type BreadcrumbProps = {
  value: string
}

export function Breadcrumb({ value }: BreadcrumbProps) {
  return (
    <Breadcrumbs label="JSON path" variant="supporting">
      <BreadcrumbItem isCurrent>{value}</BreadcrumbItem>
    </Breadcrumbs>
  )
}
```

- [ ] **Step 5: Replace JsonViewer shell with Astryx Section and Toolbar**

Replace the return block in `src/features/viewer/JsonViewer.tsx` with:

```tsx
  return (
    <Section variant="transparent" padding={3} height="100%">
      <Toolbar
        label="JSON viewer toolbar"
        size="sm"
        startContent={<ViewSwitcher mode={mode} onModeChange={onModeChange} />}
        endContent={<Breadcrumb value={breadcrumb} />}
      />
      {mode === 'columns' && (
        <ColumnsView
          rows={viewerRows.columns}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onWindowChange={(window) => onWindowChange?.('columns', window)}
        />
      )}
      {mode === 'tree' && (
        <TreeView
          rows={viewerRows.tree}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onWindowChange={(window) => onWindowChange?.('tree', window)}
        />
      )}
      {mode === 'table' && (
        <TableView
          rows={viewerRows.table}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onWindowChange={(window) => onWindowChange?.('table', window)}
        />
      )}
      {mode === 'source' && (
        <SourceView
          rows={viewerRows.source}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onWindowChange={(window) => onWindowChange?.('source', window)}
        />
      )}
    </Section>
  )
```

Add imports:

```tsx
import { Section } from '@astryxdesign/core/Section'
import { Toolbar } from '@astryxdesign/core/Toolbar'
```

- [ ] **Step 6: Replace each mode row renderer with Astryx Item**

For `ColumnsView.tsx`, `TreeView.tsx`, `TableView.tsx`, and `SourceView.tsx`, use this pattern:

```tsx
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Item } from '@astryxdesign/core/Item'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
```

For the header:

```tsx
    <Section variant="transparent" padding={0}>
      <VStack gap={2} as="section" aria-label="Columns view">
        <HStack gap={2} align="center" justify="between">
          <Heading level={2}>Columns</Heading>
          <Button label="Reset path" size="sm" variant="ghost" onClick={() => onSelectPath([])} />
        </HStack>
        <Text type="supporting" display="block">Selected: {pathLabel(selectedPath)}</Text>
        {rows.totalCount === 0 ? (
          <EmptyState title="No rows" description="This view has no rows for the selected JSON path." isCompact />
        ) : (
          <VirtualRows ... />
        )}
      </VStack>
    </Section>
```

For loaded rows:

```tsx
            <Item
              label={row.label}
              description={row.value ?? index + 1}
              density="compact"
              onClick={() => onSelectPath(row.path)}
            />
```

For source rows:

```tsx
            <Item
              label={<Text type="code">{row.label}</Text>}
              density="compact"
              onClick={() => onSelectPath(row.path)}
            />
```

For loading rows:

```tsx
            <Item
              label={`Loading row ${index + 1}`}
              density="compact"
              isDisabled
            />
```

Keep `VirtualRows` unchanged in this task except for class names that are removed in Task 6.

- [ ] **Step 7: Run viewer tests**

Run:

```bash
npm test -- src/features/viewer/JsonViewer.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit the viewer slice**

```bash
git add src/features/viewer/JsonViewer.tsx src/features/viewer/ViewSwitcher.tsx src/features/viewer/Breadcrumb.tsx src/features/viewer/ColumnsView.tsx src/features/viewer/TreeView.tsx src/features/viewer/TableView.tsx src/features/viewer/SourceView.tsx src/features/viewer/JsonViewer.test.tsx
git commit -m "refactor: migrate json viewer to Astryx"
```

---

## Task 5: Astryx Details Preview

**Files:**
- Modify: `src/features/details/DetailsPreview.test.tsx`
- Modify: `src/features/details/DetailsPreview.tsx`

- [ ] **Step 1: Ensure details test asserts metadata by role/text**

Replace `src/features/details/DetailsPreview.test.tsx` with:

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { DetailsPreview } from './DetailsPreview'

describe('DetailsPreview', () => {
  it('renders selected path, type, value, and source metadata', () => {
    renderWithProviders(
      <DetailsPreview
        path="root.items.0.name"
        type="string"
        valuePreview='"Ada"'
        sourceNodeLabel="JS 1"
      />,
    )

    expect(screen.getByRole('region', { name: /details preview/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /details/i })).toBeInTheDocument()
    expect(screen.getByText('root.items.0.name')).toBeInTheDocument()
    expect(screen.getByText('string')).toBeInTheDocument()
    expect(screen.getByText('"Ada"')).toBeInTheDocument()
    expect(screen.getByText('JS 1')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run details test before implementation**

Run:

```bash
npm test -- src/features/details/DetailsPreview.test.tsx
```

Expected: PASS or close to PASS on behavior. Keep it as a guard while replacing internals.

- [ ] **Step 3: Replace DetailsPreview with Astryx metadata components**

Replace `src/features/details/DetailsPreview.tsx` with:

```tsx
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { Section } from '@astryxdesign/core/Section'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'

type DetailsPreviewProps = {
  path: string
  type: string
  valuePreview: string
  sourceNodeLabel: string
}

export function DetailsPreview({ path, type, valuePreview, sourceNodeLabel }: DetailsPreviewProps) {
  return (
    <Section variant="transparent" padding={4}>
      <VStack gap={4} as="section" aria-label="Details preview">
        <VStack gap={1}>
          <Heading level={2}>Details</Heading>
          <Text type="supporting" display="block" wordBreak="break-word">
            {path}
          </Text>
        </VStack>

        <MetadataList title="Selection" label={{ position: 'start', width: 88 }}>
          <MetadataListItem label="Type">
            <Token label={type} size="sm" color="blue" />
          </MetadataListItem>
          <MetadataListItem label="Value">
            <Text type="code" wordBreak="break-word">
              {valuePreview}
            </Text>
          </MetadataListItem>
          <MetadataListItem label="Source">{sourceNodeLabel}</MetadataListItem>
        </MetadataList>

        <Section variant="transparent" padding={0}>
          <Heading level={3}>Provenance</Heading>
          <Text type="supporting" display="block">
            Derived from the currently selected pipeline node.
          </Text>
        </Section>

        <Section variant="transparent" padding={0}>
          <Heading level={3}>Comparison</Heading>
          <Text type="supporting" display="block">
            Diff appears when comparison data is available.
          </Text>
        </Section>

        <Section variant="transparent" padding={0}>
          <Heading level={3}>Related values</Heading>
          <Text type="supporting" display="block">
            Related paths appear when indexes are available.
          </Text>
        </Section>
      </VStack>
    </Section>
  )
}
```

- [ ] **Step 4: Run details and app tests**

Run:

```bash
npm test -- src/features/details/DetailsPreview.test.tsx src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the details slice**

```bash
git add src/features/details/DetailsPreview.tsx src/features/details/DetailsPreview.test.tsx
git commit -m "refactor: migrate details preview to Astryx"
```

---

## Task 6: Token-Based Bridge CSS Cleanup

**Files:**
- Create: `src/styles/app-css.test.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/e2e/workbench.spec.ts`

- [ ] **Step 1: Add static CSS guard**

Create `src/styles/app-css.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')

describe('app.css', () => {
  it('does not define a custom root color theme', () => {
    expect(css).not.toMatch(/:root\s*\{[^}]*--color-/s)
    expect(css).not.toMatch(/:root\s*\{[^}]*--spacing-/s)
    expect(css).not.toMatch(/:root\s*\{[^}]*--radius-/s)
  })

  it('keeps bridge styles token-based', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(css).not.toMatch(/rgba?\(/)
  })
})
```

- [ ] **Step 2: Run CSS guard to verify it fails**

Run:

```bash
npm test -- src/styles/app-css.test.ts
```

Expected: FAIL because current `app.css` contains raw hex and rgba values.

- [ ] **Step 3: Replace app.css with bridge-only token CSS**

Replace `src/styles/app.css` with:

```css
html,
body,
#root {
  min-width: 320px;
  min-height: 100%;
}

body {
  margin: 0;
  background: var(--color-background-body);
  color: var(--color-text-primary);
}

.virtualScroll {
  min-height: 14rem;
  height: min(52vh, 32rem);
  max-height: min(52vh, 32rem);
  overflow: auto;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-element);
  background: var(--color-background-surface);
}

.virtualRow + .virtualRow {
  border-top: var(--border-width) solid var(--color-border);
}
```

This keeps only root sizing and virtual scroll bridge styling. Do not re-add button/input/pane/theme styles.

- [ ] **Step 4: Update the e2e virtual scroll locator**

In `tests/e2e/workbench.spec.ts`, keep the locator:

```ts
await page.locator('.virtualScroll').evaluate((element) => {
  element.scrollTop = element.scrollHeight
  element.dispatchEvent(new Event('scroll', { bubbles: true }))
})
```

Do not replace it with Astryx selectors; `.virtualScroll` is an intentional TanStack Virtual bridge class.

- [ ] **Step 5: Run CSS guard and focused UI tests**

Run:

```bash
npm test -- src/styles/app-css.test.ts src/features/viewer/JsonViewer.test.tsx src/app/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the CSS cleanup**

```bash
git add src/styles/app.css src/styles/app-css.test.ts tests/e2e/workbench.spec.ts
git commit -m "refactor: reduce app css to Astryx bridge styles"
```

---

## Task 7: Final Verification

**Files:**
- No new files unless verification exposes failures.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run e2e tests**

Run:

```bash
npm run e2e
```

Expected: PASS.

- [ ] **Step 5: Check for forbidden UI patterns**

Run:

```bash
rg -n -- '<div\\b|<section\\b|<button\\b|<input\\b|<textarea\\b|#[0-9a-fA-F]{3,8}|rgba?\\(|--color-' src/app src/features src/styles
```

Expected:

- No raw hex or rgba results.
- No `--color-*` definitions.
- Remaining native elements are limited to Monaco test mocks, `VirtualRows` bridge elements, and Astryx-compatible semantic wrappers that were intentionally kept.

- [ ] **Step 6: Commit any verification fixes**

When verification required edits, stage only the known migration paths and commit them:

```bash
git add src/app src/features src/styles tests/e2e/workbench.spec.ts
git commit -m "fix: complete Astryx UI migration verification"
```

When no edits were required, skip this step instead of creating an empty commit.
