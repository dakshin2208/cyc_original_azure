/** Reject if `pending` does not settle within `ms` milliseconds. */
export function withTimeout<T>(
  pending: Promise<T> | PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> {
  const promise = Promise.resolve(pending)
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    )
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }) as Promise<T>
}
