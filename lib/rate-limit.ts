interface RateLimitOptions {
  limit?: number
  windowMs?: number
  now?: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

const buckets = new Map<string, number[]>()

const DEFAULT_LIMIT = 10
const DEFAULT_WINDOW_MS = 10 * 60 * 1000

/**
 * Fixed-window limiter for the unauthenticated processing routes.
 * Memory is per server instance, which is enough to absorb accidental retries
 * and casual request floods before they fan out to academic APIs.
 */
export function checkRateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const limit = options.limit ?? DEFAULT_LIMIT
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const now = options.now ?? Date.now()
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs)

  if (recent.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000))
    buckets.set(key, recent)
    return { allowed: false, retryAfterSeconds }
  }

  recent.push(now)
  buckets.set(key, recent)

  if (buckets.size > 5000) {
    for (const [bucketKey, timestamps] of buckets) {
      if (timestamps.every((timestamp) => now - timestamp >= windowMs)) {
        buckets.delete(bucketKey)
      }
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export function resetRateLimits(): void {
  buckets.clear()
}

export function requestClientKey(getHeader: (name: string) => string | null): string {
  const forwarded = getHeader('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || getHeader('x-real-ip')?.trim()
  return ip || 'unknown'
}

export function contentLengthExceeds(header: string | null, maxBytes: number): boolean {
  if (!header) return false
  const length = Number(header)
  return Number.isFinite(length) && length > maxBytes
}
