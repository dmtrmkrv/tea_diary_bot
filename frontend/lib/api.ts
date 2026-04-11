const API_URL = process.env.API_URL || 'https://dmtrmkrv-tea-diary-bot-03bd.twc1.net';
const DEV_USER_ID = process.env.DEV_USER_ID || '';

async function apiFetch(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'x-telegram-user-id': DEV_USER_ID,
    },
    next: { revalidate: 60 },
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
