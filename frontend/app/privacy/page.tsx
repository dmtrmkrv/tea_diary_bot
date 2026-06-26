import PrivacyBackButton from '@/components/PrivacyBackButton';

export const metadata = {
  title: 'Политика конфиденциальности',
};

// Каркас страницы. ВСТАВИТЬ финальный текст Политики обработки ПДн вместо
// плейсхолдера ниже (структура и стили уже готовы).
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

        <div className="flex flex-col gap-4 text-[14px] leading-[22px] text-foreground">
          {/* TODO: заменить плейсхолдер на финальный текст Политики */}
          <p className="text-muted-foreground">
            Здесь будет размещена Политика обработки персональных данных сервиса
            LeafPulse. Текст готовится.
          </p>
        </div>
      </div>
    </main>
  );
}
