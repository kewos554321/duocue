type Entry = {
  first?: unknown
  all?: unknown[]
  lastRowId?: number
  changes?: number
}

type Stmt = {
  _e: Entry
  first<T>(): Promise<T | null>
  run(): Promise<{ meta: { last_row_id: number; changes: number } }>
  all<T>(): Promise<{ results: T[] }>
  bind(...args: unknown[]): Stmt
}

export function makeMockDB(entries: Entry[]): D1Database {
  let i = 0
  const next = (): Entry => entries[i++] ?? {}

  // Each prepare() call consumes one entry; bind() reuses the same entry.
  const makeStmt = (e: Entry): Stmt => ({
    _e: e,
    first<T>() { return Promise.resolve((e.first ?? null) as T) },
    run() {
      return Promise.resolve({
        meta: { last_row_id: e.lastRowId ?? 1, changes: e.changes ?? 1 },
      })
    },
    all<T>() { return Promise.resolve({ results: (e.all ?? []) as T[] }) },
    bind: () => makeStmt(e),
  })

  return {
    prepare: () => makeStmt(next()),
    batch: (stmts: unknown[]) =>
      Promise.resolve(
        (stmts as Stmt[]).map(s => ({
          results: s._e?.all ?? [],
          success: true,
          meta: {} as D1Meta,
        }))
      ),
    dump: () => Promise.resolve(new ArrayBuffer(0)),
    exec: () => Promise.resolve({ count: 0, duration: 0 } as D1ExecResult),
  } as unknown as D1Database
}

export const VALID_TOKEN = 'aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233'
export const VALID_USER_ID = 1
export const FAR_EXPIRY = new Date(Date.now() + 30 * 86400 * 1000).toISOString()

export const SESSION_ENTRY: Entry = {
  first: { user_id: VALID_USER_ID, expires_at: FAR_EXPIRY },
}

export const AUTH_HEADERS = {
  Authorization: `Bearer ${VALID_TOKEN}`,
  'Content-Type': 'application/json',
}

export function post(body?: object, extraHeaders?: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { ...AUTH_HEADERS, ...extraHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }
}

export function get(extraHeaders?: Record<string, string>): RequestInit {
  return { method: 'GET', headers: { ...AUTH_HEADERS, ...extraHeaders } }
}

export function del(): RequestInit {
  return { method: 'DELETE', headers: AUTH_HEADERS }
}

export function patch(body: object): RequestInit {
  return { method: 'PATCH', headers: AUTH_HEADERS, body: JSON.stringify(body) }
}
