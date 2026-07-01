// Публичный лендинг LeafPulse — показывается незалогиненным на «/»
// (ветвление в app/page.tsx). Дизайн: Figma sM9Jr39VS3nDKWdPVgNTL1,
// node 299:5569 (Landing_Mobile); десктоп — адаптация той же структуры.
// Атрибут data-landing на корне используется CSS в globals.css, чтобы
// скрыть нижнюю навигацию приложения и её отступ.
import Link from 'next/link';
import { Source_Serif_4, Fraunces } from 'next/font/google';
import {
  HandPointingIcon,
  ChartPieIcon,
  TrophyIcon,
  TimerIcon,
  CheckIcon,
} from '@phosphor-icons/react/dist/ssr';
import LandingLogo from './LandingLogo';

// Шрифты только для лендинга: акцидентный Source Serif 4 (в Google Fonts —
// преемник Source Serif Pro из макета) и Fraunces для больших цифр 01/02/03.
// Файлы шрифтов грузятся только там, где реально используются глифы.
const serif = Source_Serif_4({ subsets: ['latin', 'cyrillic'], variable: '--font-serif-landing' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });

const SERIF = 'font-[family-name:var(--font-serif-landing)]';
const PRIMARY_BTN =
  'flex items-center justify-center rounded-full bg-[#b45309] font-medium text-[#fafaf9] transition-colors hover:bg-[#92400e]';

export default function LandingPage() {
  return (
    <div data-landing className={`${serif.variable} ${fraunces.variable} overflow-hidden bg-[#e7e5e4]`}>
      <Hero />
      <Features />
      <MoreFeatures />
      <Cta />
      <LandingFooter />
    </div>
  );
}

/* ------------------------------- Хиро ---------------------------------- */

function Hero() {
  return (
    <section className="relative h-[640px] overflow-hidden bg-[#bfa78b]">
      <img
        src="/landing/hero-bg.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[50%_75%] lg:object-[50%_60%]"
      />
      <div className="absolute inset-0 bg-black/30" />

      {/* Плавающая шапка: fixed — следует за скроллом, стекло поверх контента */}
      <div className="fixed inset-x-4 top-12 z-50">
        <div className="mx-auto flex h-[60px] max-w-[1150px] items-center justify-between rounded-full border border-[#d6d3d1] bg-white/40 pl-5 pr-4 shadow-[0px_4px_15px_-5px_rgba(0,0,0,0.15)] backdrop-blur-md">
          <LandingLogo className="h-8 w-auto text-[#1c1917]" />
          <Link href="/login" className={`${PRIMARY_BTN} min-h-[32px] px-4 text-[14px]`}>
            Войти
          </Link>
        </div>
      </div>

      {/* Оффер */}
      <div className="relative z-[1] mx-auto flex max-w-[1150px] flex-col items-center gap-6 px-4 pt-[140px] text-center lg:items-start lg:pt-[190px] lg:text-left">
        <div className="flex flex-col gap-2">
          <h1 className={`${SERIF} text-[36px] leading-[1.05] tracking-[-0.36px] text-[#fafaf9] lg:max-w-[560px] lg:text-[52px]`}>
            Личный чайный дневник — всё в одном месте
          </h1>
          <p className="text-[16px] leading-6 text-white/80 lg:max-w-[430px]">
            Записывайте дегустации, ведите коллекцию чая и посуды, отслеживайте любимые вкусы
          </p>
        </div>
        <div className="flex w-full justify-center gap-3 lg:w-auto lg:justify-start">
          <Link href="/login?tab=register" className={`${PRIMARY_BTN} min-h-10 w-[196px] px-6 text-[14px] lg:w-auto lg:px-8`}>
            Начать бесплатно
          </Link>
          <a
            href="#features"
            className="flex min-h-10 flex-1 items-center justify-center rounded-full border border-[#f5f5f4] px-6 text-[14px] font-medium text-[#fafaf9] transition-colors hover:bg-white/10 lg:flex-none lg:px-8"
          >
            Узнать больше
          </a>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Блоки фич 01–03 ---------------------------- */

// Плашка-ярлык на карточке («Дегустации» / «Карточка» / «Коллекция»)
function PillTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-start rounded-full bg-[rgba(180,83,9,0.2)] px-4 py-1.5 text-[12px] font-semibold leading-4 text-[#b45309]">
      {children}
    </span>
  );
}

// Плавающий чекбокс-тег на карточке 01 (стилизован под тёмный скрин приложения)
function TagChip({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={`absolute flex w-[159px] origin-top-left items-start gap-3 rounded-lg border border-[#d97706] bg-[#44403c] p-3 shadow-[2px_10px_20px_-5px_rgba(0,0,0,0.25)] ${className ?? ''}`}
    >
      <p className="flex-1 text-[14px] leading-5 text-[#fafaf9]">{label}</p>
      <span className="mt-0.5 flex size-4 items-center justify-center rounded-[4px] bg-[#b45309]">
        <CheckIcon size={12} weight="bold" color="#fafaf9" />
      </span>
    </div>
  );
}

// Номер + заголовок + текст под карточкой
function FeatureText({ num, title, children }: { num: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative mt-4 px-4 lg:mt-0 lg:px-0">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[29px] right-4 select-none font-[family-name:var(--font-fraunces)] text-[110px] font-bold leading-none text-[#fafaf9] opacity-70 lg:right-0"
      >
        {num}
      </span>
      <h3 className="relative text-[24px] font-semibold leading-[30px] tracking-[-1px] text-[#1c1917]">{title}</h3>
      <p className="relative mt-3 max-w-[358px] text-[14px] leading-5 text-[#1c1917]">{children}</p>
    </div>
  );
}

function Features() {
  return (
    // scroll-mt-32 — запас под fixed-шапку (48px отступ + 60px пилюля)
    <section id="features" className="mx-auto max-w-[1150px] scroll-mt-32 lg:px-8">
      <h2 className={`${SERIF} mx-auto mb-14 mt-8 max-w-[358px] px-4 text-center text-[36px] leading-[1.05] tracking-[-0.36px] text-[#1c1917] lg:max-w-none`}>
        Больше, чем заметки о чае
      </h2>

      <div className="flex flex-col gap-16 lg:gap-24">
        {/* 01 — Дегустации */}
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="relative ml-auto h-[349px] w-[374px] overflow-hidden rounded-l-[32px] bg-white lg:mx-auto lg:rounded-[32px]">
            <img
              src="/landing/app-new-tasting.webp"
              alt="Экран новой дегустации в LeafPulse"
              className="absolute left-5 top-[19px] w-[147px] rounded-[16px]"
            />
            <div className="absolute left-[182px] top-10 flex w-[181px] flex-col gap-4">
              <PillTag>Дегустации</PillTag>
              <p className="text-[12px] font-semibold leading-4 text-[#5e5e5e]">
                Быстрые теги по аромату, вкусу и послевкусию — отметьте готовые или запишите свои
              </p>
            </div>
            <TagChip label="Цветочный" className="left-[201px] top-[199px]" />
            <TagChip label="Кондитерский" className="left-[179px] top-[239px] scale-[0.886]" />
            <TagChip label="Ореховый" className="left-[249px] top-[276px] scale-[0.665]" />
          </div>
          <FeatureText
            num="01"
            title={
              <>
                Фиксируйте вкус <br /> по каждому проливу
              </>
            }
          >
            Температура, время и впечатления — по каждому проливу. Отмечайте ароматы, тело настоя и послевкусие
            готовыми тегами или добавляйте свои.
          </FeatureText>
        </div>

        {/* 02 — Карточка */}
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="relative mr-auto h-[349px] w-[374px] overflow-hidden rounded-r-[32px] bg-white lg:order-2 lg:mx-auto lg:rounded-[32px]">
            <img
              src="/landing/app-tasting-card.webp"
              alt="Карточка дегустации в LeafPulse"
              className="absolute bottom-4 right-4 w-[162px] rounded-[16px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.5)]"
            />
            <div className="absolute left-6 top-10 flex w-[159px] flex-col gap-4">
              <PillTag>Карточка</PillTag>
              <p className="text-[12px] font-semibold leading-4 text-[#5e5e5e]">
                Оживите запись: фото момента и эмоции дегустации
              </p>
            </div>
            <img
              src="/landing/arrow-doodle.svg"
              alt=""
              className="absolute left-[133px] top-[149px] w-[54px] rotate-[3.82deg]"
            />
            <img
              src="/landing/photo-moment-1.webp"
              alt=""
              className="absolute left-[65px] top-[210px] w-[144px] rotate-[4.61deg] rounded-[16px] border-[3px] border-[#fafaf9] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.2)]"
            />
            <img
              src="/landing/photo-moment-2.webp"
              alt=""
              className="absolute left-4 top-[159px] w-[109px] rotate-[-5.36deg] rounded-[16px] border-[3px] border-[#fafaf9] shadow-[0px_5px_20px_-3px_rgba(0,0,0,0.4)]"
            />
          </div>
          <FeatureText
            num="02"
            title={
              <>
                Собирайте уникальные <br /> записи под каждый сорт
              </>
            }
          >
            Выбирайте чай и посуду из своей коллекции, добавляйте фото и оценку. Структурированная карточка вместо
            разрозненных заметок в телефоне.
          </FeatureText>
        </div>

        {/* 03 — Коллекция */}
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="relative ml-auto h-[349px] w-[374px] overflow-hidden rounded-l-[32px] bg-white lg:mx-auto lg:rounded-[32px]">
            <img
              src="/landing/app-tea-list.webp"
              alt="Коллекция чая в LeafPulse"
              className="absolute left-4 top-5 w-[148px] rounded-[16px] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)]"
            />
            <div className="absolute left-[182px] top-6 flex w-[181px] flex-col gap-4">
              <PillTag>Коллекция</PillTag>
              <p className="text-[12px] font-semibold leading-4 text-[#5e5e5e]">
                Фото, параметры и остатки — быстрый выбор чая для дегустации
              </p>
            </div>
            <img
              src="/landing/photo-teaware-1.webp"
              alt=""
              className="absolute left-[141px] top-[152px] w-[121px] rotate-[3.79deg] rounded-[8px] border border-[#fafaf9] shadow-[0px_4px_20px_-5px_rgba(0,0,0,0.68)]"
            />
            <img
              src="/landing/photo-teaware-2.webp"
              alt=""
              className="absolute left-[225px] top-[173px] w-[99px] rotate-[15.92deg] rounded-[8px] border border-[#fafaf9] shadow-[4px_10px_15px_-5px_rgba(0,0,0,0.3)]"
            />
          </div>
          <FeatureText num="03" title="Ваша личная чайная полка">
            Добавляйте чаи с типом, регионом и остатком, посуду — с материалом и объёмом. Вся коллекция под рукой при
            создании новой дегустации.
          </FeatureText>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ «Другие возможности» -------------------------- */

type MoreItem = {
  Icon: typeof HandPointingIcon;
  title: string;
  text: string;
  soon?: boolean;
};

const MORE_ITEMS: MoreItem[] = [
  {
    Icon: HandPointingIcon,
    title: 'Быстрый старт',
    text: 'Кнопка добавления всегда под рукой: новый чай, посуда или дегустация — в одно касание.',
  },
  {
    Icon: ChartPieIcon,
    title: 'Сводка по дневнику',
    text: 'Сколько дегустаций, сортов и посуды, любимые категории — наглядная картина вашей чайной жизни.',
  },
  {
    Icon: TrophyIcon,
    title: 'Достижения',
    text: 'Ведите дегустации, пополняйте коллекцию — и получайте награды за чайные вехи.',
    soon: true,
  },
  {
    Icon: TimerIcon,
    title: 'Гунфу-таймер',
    text: 'Таймер проливов с подсказками по времени под выбранный сорт.',
    soon: true,
  },
];

function MoreFeatures() {
  return (
    <section className="mt-20 bg-[#292524] px-4 py-10">
      <div className="mx-auto max-w-[1150px]">
        <h2 className={`${SERIF} text-[36px] leading-[1.05] tracking-[-0.36px] text-[#fafaf9]`}>
          Другие возможности
        </h2>
        <div className="mt-8 flex flex-col lg:grid lg:grid-cols-2 lg:gap-x-16 lg:gap-y-10">
          {MORE_ITEMS.map(({ Icon, title, text, soon }, i) => (
            <div
              key={title}
              className={`flex gap-4 py-6 lg:border-none lg:py-0 ${i > 0 ? 'border-t border-white/10' : ''}`}
            >
              <span className="flex size-[70px] shrink-0 items-center justify-center rounded-[16px] bg-[#fafaf9]">
                <Icon size={32} color="#292524" />
              </span>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[20px] font-semibold leading-6 text-[#fafaf9]">{title}</p>
                  {soon && (
                    <span className="rounded-full bg-[#f59e0b] px-2 pb-px pt-0.5 text-[9px] font-extrabold uppercase leading-4 tracking-[1px] text-[#b45309]">
                      Скоро
                    </span>
                  )}
                </div>
                <p className="text-[14px] leading-5 text-[#a8a29e]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- CTA ------------------------------------ */

function Cta() {
  return (
    <section className="relative h-[634px] overflow-hidden bg-[#c3af9c]">
      <div className="absolute inset-x-0 bottom-0 h-[375px]">
        <img src="/landing/cta-bg.webp" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/20" />
        {/* Плавный переход в тёмный футер */}
        <div className="absolute inset-x-0 bottom-0 h-[98px] bg-gradient-to-b from-transparent to-[#292524]" />
      </div>
      <div className="relative z-[1] mx-auto flex max-w-[420px] flex-col items-center px-4 pt-14 text-center">
        <img src="/landing/logo-mark.svg" alt="" className="size-12" />
        <h2 className={`${SERIF} mt-4 text-[36px] leading-[1.05] tracking-[-0.36px] text-[#1c1917]`}>
          Создайте свой <br /> чайный дневник сегодня
        </h2>
        <Link href="/login?tab=register" className={`${PRIMARY_BTN} mt-[52px] min-h-12 w-[280px] px-8 text-[16px]`}>
          Зарегистрироваться
        </Link>
        <p className="mt-6 text-[14px] leading-5 text-[#fafaf9]">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-[#d97706] underline-offset-2 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ------------------------------ Футер ----------------------------------- */

function LandingFooter() {
  return (
    <footer className="bg-[#292524] px-4 pb-6 pt-4">
      <div className="mx-auto max-w-[1150px]">
        <div className="flex items-center justify-between">
          <LandingLogo className="h-6 w-auto text-[#fafaf9]" />
          <p className="text-[10px] leading-4 text-[#78716c]">© 2026 LeafPulse — все права защищены</p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
          <a
            href={`mailto:info@leafpulse.ru?subject=${encodeURIComponent('LeafPulse: сообщение об ошибке')}`}
            className="text-[10px] leading-4 text-[#78716c] underline"
          >
            Сообщить об ошибке
          </a>
          <Link href="/privacy" className="text-[10px] leading-4 text-[#78716c] underline">
            Политика конфиденциальности
          </Link>
        </div>
      </div>
    </footer>
  );
}
