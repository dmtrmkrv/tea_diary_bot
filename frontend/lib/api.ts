const API_URL = process.env.API_URL || 'https://dmtrmkrv-tea-diary-bot-03bd.twc1.net';

async function getServerToken(): Promise<string> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    return cookieStore.get('token')?.value || '';
  } catch {
    return '';
  }
}

async function apiFetch(path: string) {
  const token = await getServerToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
