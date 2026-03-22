const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// 通用fetch封装
export async function apiFetch<T>(path: string, options?: RequestInit & { apiKey?: string; provider?: string }): Promise<T> {
  const { apiKey, provider, ...fetchOptions } = options || {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (apiKey) headers['X-API-Key'] = apiKey;
  if (provider) headers['X-Provider'] = provider;
  
  const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return res.json();
}

// SSE流式请求
export async function apiStream(
  path: string,
  body: Record<string, unknown>,
  options: { apiKey?: string; provider?: string; onMessage: (content: string) => void; onDone: () => void; onError: (error: string) => void }
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.apiKey) headers['X-API-Key'] = options.apiKey;
  if (options.provider) headers['X-Provider'] = options.provider;
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Stream failed' }));
    options.onError(error.detail || 'Stream failed');
    return;
  }
  
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) { options.onDone(); break; }
    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') { options.onDone(); return; }
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) options.onMessage(parsed.content);
          if (parsed.error) options.onError(parsed.error);
        } catch { /* ignore parse errors for incomplete chunks */ }
      }
    }
  }
}
