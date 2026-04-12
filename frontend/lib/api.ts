const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://dmtrmkrv-tea-diary-bot-03bd.twc1.net';

function getToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/token=([^;]+)/);
  return match ? match[1] : '';
}

async function apiFetch(path: string, token?: string) {
  const headers: Record<string, string> = {};

  const t = token || getToken();
  if (t) {
    headers['Authorization'] = `Bearer ${t}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getTastings(limit = 20, offset = 0) {
  return apiFetch(`/tastings?limit=${limit}&offset=${offset}`);
}

export async function getTasting(id: number) {
  return apiFetch(`/tastings/${id}`);
}

export async function getMe() {
  return apiFetch('/users/me');
}
