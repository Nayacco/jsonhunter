import { Banner } from '@astryxdesign/core/Banner'

type ErrorBannerProps = {
  message?: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null

  return <Banner status="error" title="Execution error" description={message} container="section" />
}
