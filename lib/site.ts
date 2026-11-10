export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || 'https://citefinder.app'
  return configured.replace(/\/+$/, '')
}
