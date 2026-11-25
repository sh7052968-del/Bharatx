const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface TokenAccessor {
  getAccessToken: () => string | null;
  refreshSession: () => Promise<string | null>;
}

let tokenAccessor: TokenAccessor | null = null;

export function bindTokenAccessor(accessor: TokenAccessor) {
  tokenAccessor = accessor;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retryOn401 = true,
): Promise<T> {
  const token = tokenAccessor?.getAccessToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retryOn401 && tokenAccessor) {
    const refreshed = await tokenAccessor.refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, init, false);
    }
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const errJson = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(errJson.message)) msg = errJson.message.join('; ');
      else if (typeof errJson.message === 'string') msg = errJson.message;
    } catch {
      // Keep default status message
    }
    throw new ApiError(res.status, msg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    return (await res.text()) as unknown as T;
  }
  return (await res.json()) as T;
}

export function getApiBaseUrl(): string {
  return API_BASE;
}
