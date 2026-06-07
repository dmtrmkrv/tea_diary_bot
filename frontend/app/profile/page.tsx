export const dynamic = 'force-dynamic';

import ThemeToggle from '@/components/ThemeToggle';

export default function ProfilePage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Профиль</h1>
      <p className="text-muted-foreground mb-6">Скоро здесь будет профиль</p>

      <section className="border-t pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Внешний вид
        </h2>
        <ThemeToggle />
      </section>
    </main>
  );
}
