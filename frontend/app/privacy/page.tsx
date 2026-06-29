import PrivacyBackButton from '@/components/PrivacyBackButton';
import PrivacyContent from '@/components/PrivacyContent';

export const metadata = {
  title: 'Политика конфиденциальности',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <PrivacyBackButton />
          <h1 className="text-[20px] font-semibold text-foreground">
            Политика конфиденциальности
          </h1>
        </div>

        <PrivacyContent />
      </div>
    </main>
  );
}
