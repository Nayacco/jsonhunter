type ErrorBannerProps = {
  message?: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null

  return (
    <section className="errorBanner" role="alert">
      <strong>Execution error</strong>
      <pre>{message}</pre>
    </section>
  )
}
