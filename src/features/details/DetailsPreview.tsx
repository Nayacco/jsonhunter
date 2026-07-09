type DetailsPreviewProps = {
  path: string
  type: string
  valuePreview: string
  sourceNodeLabel: string
}

export function DetailsPreview({ path, type, valuePreview, sourceNodeLabel }: DetailsPreviewProps) {
  return (
    <section className="detailsPreview" aria-label="Details preview">
      <header className="detailsPreviewHeader">
        <h2>Details</h2>
        <p>{path}</p>
      </header>

      <dl className="detailsPreviewFacts">
        <dt>Type</dt>
        <dd>{type}</dd>
        <dt>Value</dt>
        <dd>
          <code>{valuePreview}</code>
        </dd>
      </dl>

      <section className="detailsPreviewSection" aria-label="Provenance">
        <h3>Provenance</h3>
        <p>Derived from the currently selected pipeline node.</p>
        <div className="detailsPreviewBadge">{sourceNodeLabel}</div>
      </section>

      <section className="detailsPreviewSection" aria-label="Comparison">
        <h3>Comparison</h3>
        <p>Diff appears when comparison data is available.</p>
      </section>

      <section className="detailsPreviewSection" aria-label="Related values">
        <h3>Related values</h3>
        <p>Related paths appear when indexes are available.</p>
      </section>
    </section>
  )
}
