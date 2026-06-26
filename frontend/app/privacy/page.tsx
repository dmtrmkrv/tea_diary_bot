import Link from 'next/link';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr';

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
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-button-icon-bg border border-button-icon-border flex items-center justify-center shrink-0"
            aria-label="Назад"
          >
            <ArrowLeftIcon size={16} className="text-foreground" />
          </Link>
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
