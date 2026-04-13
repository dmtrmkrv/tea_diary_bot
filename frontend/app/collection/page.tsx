'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function getCollection(tab: 'tea' | 'teaware', token: string) {
  const res = await fetch(`${API_URL}/collection/${tab}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

export default function CollectionPage() {
  const [tab, setTab] = useState<'tea' | 'teaware'>('tea');

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Коллекция</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('tea')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            tab === 'tea'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          🍵 Чай
        </button>
        <button
          onClick={() => setTab('teaware')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            tab === 'teaware'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          🫖 Посуда
        </button>
      </div>

      <p className="text-muted-foreground text-sm">
        {tab === 'tea' ? 'Чаи появятся здесь после добавления' : 'Посуда появится здесь после добавления'}
      </p>
    </main>
  );
}
