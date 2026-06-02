'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function getToken(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function apiCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export type TeaItem = {
  id: number;
  name: string;
  category: string | null;
  year: number | null;
  region: string | null;
  vendor: string | null;
  notes: string | null;
  cover_url: string | null;
  tasting_count: number;
  created_at: string;
};

export type TeaItemList = { items: TeaItem[]; total: number };

export type TastingShort = { id: number; name: string; created_at: string; cover_url?: string | null };
export type TastingsList = { items: TastingShort[]; total: number };

export type Teaware = {
  id: number;
  name: string;
  type: string | null;
  volume_ml: number | null;
  material: string | null;
  notes: string | null;
  cover_url: string | null;
  created_at: string;
};
export type TeawareList = { items: Teaware[]; total: number };

export function getTeaCollection(limit = 10, offset = 0) {
  return apiCall<TeaItemList>(`/collection/tea?limit=${limit}&offset=${offset}`);
}

export function getTeawareCollection(limit = 10, offset = 0) {
  return apiCall<TeawareList>(`/collection/teaware?limit=${limit}&offset=${offset}`);
}

export function getTeaItemTastings(itemId: number, limit = 3, offset = 0) {
  return apiCall<TastingsList>(`/collection/tea/${itemId}/tastings?limit=${limit}&offset=${offset}`);
}

export type TeaCreateInput = {
  name: string;
  category?: string | null;
  year?: number | null;
  region?: string | null;
};

export function createTeaItem(data: TeaCreateInput) {
  return apiCall<TeaItem>('/collection/tea', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function uploadTeaItemPhoto(itemId: number, file: File): Promise<TeaItem> {
  const fd = new FormData();
  fd.append('file', file);
  return apiCall<TeaItem>(`/collection/tea/${itemId}/photo`, {
    method: 'POST',
    body: fd,
  });
}

export type InfusionInput = {
  n: number;
  seconds?: number | null;
  liquor_color?: string | null;
  taste?: string | null;
  special_notes?: string | null;
  body?: string | null;
  aftertaste?: string | null;
};

export type TastingCreateInput = {
  name: string;
  tea_item_id?: number | null;
  teaware_id?: number | null;
  grams?: number | null;
  temp_c?: number | null;
  aroma_dry?: string | null;
  aroma_warmed?: string | null;
  aroma_after?: string | null;
  effects_csv?: string | null;
  scenarios_csv?: string | null;
  rating?: number;
  summary?: string | null;
  entry_mode?: string;
  infusions?: InfusionInput[];
};

export type TastingCreatedOut = { id: number };

export function createTasting(data: TastingCreateInput) {
  return apiCall<TastingCreatedOut & Record<string, unknown>>('/tastings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function uploadTastingPhotos(tastingId: number, files: File[]): Promise<void> {
  if (files.length === 0) return;
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  await apiCall(`/tastings/${tastingId}/photos`, { method: 'POST', body: fd });
}
