// Публичный лендинг LeafPulse — показывается незалогиненным на «/»
// (ветвление в app/page.tsx). Дизайн: Figma sM9Jr39VS3nDKWdPVgNTL1,
// брейкпоинты: 299:5569 (390), 333:6656 (768, md), 338:7018 (1280+, xl).
// Атрибут data-landing на корне используется CSS в globals.css, чтобы
// скрыть нижнюю навигацию приложения и её отступ.
import Link from 'next/link';
import { Source_Serif_4 } from 'next/font/google';
import { FEEDBACK_EMAIL } from '@/lib/constants';
import {
  BrowsersIcon,
  ChartPieIcon,
  TrophyIcon,
  TimerIcon,
} from '@phosphor-icons/react/dist/ssr';
import LandingLogo, { LandingLogoMark } from './LandingLogo';

// Акцидентный шрифт лендинга: Source Serif 4 (в Google Fonts — преемник
// Source Serif Pro из макета). Грузится только там, где используются глифы.
// Цифры 01/02/03 — готовые SVG из макета, шрифт для них не нужен.
const serif = Source_Serif_4({ subsets: ['latin', 'cyrillic'], variable: '--font-serif-landing' });

const SERIF = 'font-[family-name:var(--font-serif-landing)]';
const PRIMARY_BTN =
  'flex items-center justify-center rounded-full bg-[#b45309] font-medium text-[#fafaf9] transition-colors hover:bg-[#92400e]';

export default function LandingPage() {
  return (
    <div data-landing className={`${serif.variable} overflow-hidden bg-[#e7e5e4]`}>
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
      {/* Кадр — «ближайший снизу» к ширине окна: композиция соответствует
          той ширине, под которую кадрирована. ≤640 — вертикальный кадр 390. */}
      <picture>
        <source media="(min-width: 1921px)" srcSet="/landing/hero-1920.webp" />
        <source media="(min-width: 1441px)" srcSet="/landing/hero-1440.webp" />
        <source media="(min-width: 1281px)" srcSet="/landing/hero-1280.webp" />
        <source media="(min-width: 1025px)" srcSet="/landing/hero-1024.webp" />
        <source media="(min-width: 641px)" srcSet="/landing/hero-768.webp" />
        <img src="/landing/hero-390.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      <div className="absolute inset-0 bg-black/20" />

      {/* Плавающая шапка: fixed — следует за скроллом, стекло поверх контента */}
      <div className="fixed inset-x-4 top-6 z-50">
        <div className="mx-auto flex h-[60px] max-w-[736px] items-center justify-between rounded-full border border-[#d6d3d1] bg-white/40 pl-5 pr-4 shadow-[0px_4px_15px_-5px_rgba(0,0,0,0.15)] backdrop-blur-md md:h-14 md:pl-6 xl:max-w-[917px]">
          <LandingLogo className="h-8 w-auto text-[#1c1917]" />
          <nav className="hidden items-center gap-10 text-[12px] font-medium text-[#1c1917] md:flex">
            <a href="#features" className="transition-opacity hover:opacity-70">Функционал</a>
            <a href="#more" className="transition-opacity hover:opacity-70">Возможности</a>
            <a href="#cta" className="transition-opacity hover:opacity-70">Создать</a>
          </nav>
          <Link href="/login" className={`${PRIMARY_BTN} min-h-[32px] px-4 text-[14px]`}>
            Войти
          </Link>
        </div>
      </div>

      {/* Оффер: по центру, чуть выше середины (390: −49px, 1280: −42px) */}
      <div className="relative z-[1] mx-auto flex h-full flex-col items-center justify-center gap-6 px-4 pb-[98px] text-center md:pb-[84px]">
        <div className="flex flex-col gap-2">
          <h1 className={`${SERIF} text-[36px] leading-[1.05] tracking-[-0.36px] text-[#fafaf9] md:text-[44px] md:tracking-[-0.44px]`}>
            {/* nbsp перед тире держит «дневник —» вместе, br жёстко рвёт строку
                после тире: 390 → 3 строки, 667+ → 2 строки (как в макетах) */}
            {'Личный чайный дневник — '}
            <br />
            всё в одном месте
          </h1>
          <p className="text-[16px] leading-6 text-white/80 md:mx-auto md:max-w-[520px]">
            Записывайте дегустации, ведите коллекцию чая и посуды, отслеживайте любимые вкусы
          </p>
        </div>
        {/* Мобилка: обе кнопки равной ширины (flex-1); с планшета — контейнер 402px */}
        <div className="flex w-full justify-center gap-3 md:w-[402px]">
          <Link
            href="/login?tab=register"
            className={`${PRIMARY_BTN} min-h-10 flex-1 whitespace-nowrap px-6 text-[14px] md:w-[196px] md:flex-none`}
          >
            Начать бесплатно
          </Link>
          <a
            href="#features"
            className="flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full border border-[#f5f5f4] px-6 text-[14px] font-medium text-[#fafaf9] transition-colors hover:bg-white/10"
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

// Белая карточка-коллаж. Внутренности сверстаны в базовом размере 374×349
// (как в мобильном макете); на xl вся карточка масштабируется до 460×429
// (масштаб 1.23 — как в макете 1280+), поэтому абсолютные координаты внутри
// не пересчитываются под брейкпоинты.
// Карточка всегда по центру своей колонки и скруглена целиком — это же
// закрывает промежуточные ширины (широкие телефоны, ландшафт 430–767px).
function CardShell({ children }: { children: React.ReactNode }) {
  // Масштаб карточки по макетам: 390 → 374×349 (1:1), 768 → 330×308 (×0.88),
  // 1280+ → 460×429 (×1.23). Внешний div резервирует место, внутренний скейлится.
  return (
    <div className="relative mx-auto h-[349px] w-[374px] md:h-[308px] md:w-[330px] xl:h-[429px] xl:w-[460px]">
      <div className="absolute left-0 top-0 h-[349px] w-[374px] origin-top-left overflow-hidden rounded-[32px] bg-white shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] md:scale-[0.8824] md:shadow-[0px_15px_50px_-4px_rgba(0,0,0,0.2)] xl:scale-[1.2299]">
        {children}
      </div>
    </div>
  );
}

// Номер + заголовок + текст. Мобилка: номер — водяной знак справа от
// заголовка; md+: номер в потоке над заголовком (как в макетах 768/1280+).
function FeatureText({ num, title, children }: { num: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    // До md текстовый блок не шире карточки (374) и центрирован вместе с ней —
    // на широких телефонах/ландшафте текст не липнет к краю экрана.
    // md: блок шириной карточки (330) по центру колонки — текст и карточки
    // соседних блоков стоят на одной вертикальной линии; xl — по сетке макета.
    <div className="relative mx-auto mt-4 w-full max-w-[374px] px-4 md:mt-0 md:w-[330px] md:max-w-none md:px-0 xl:mx-0 xl:w-auto">
      <img
        src={`/landing/num-${num}.svg`}
        alt=""
        className="pointer-events-none absolute right-4 top-0 h-20 select-none md:static md:mb-6"
      />
      <h3 className="relative text-[24px] font-semibold leading-[30px] tracking-[-1px] text-[#1c1917] xl:text-[32px] xl:leading-8">
        {title}
      </h3>
      <p className="relative mt-3 max-w-[358px] text-[14px] leading-5 text-[#1c1917] xl:mt-4 xl:max-w-[378px] xl:text-[16px] xl:leading-6">
        {children}
      </p>
    </div>
  );
}

function Features() {
  return (
    // scroll-mt-32 — запас под fixed-шапку (отступ + пилюля).
    // 769–1279: контент держит планшетную ширину (736), не растягиваясь, —
    // иначе тексты 01/03 уезжают за визуальную линию карточки 02.
    <section id="features" className="mx-auto max-w-[768px] scroll-mt-32 md:px-4 xl:max-w-[917px] xl:px-0">
      <h2 className={`${SERIF} mx-auto mb-[18px] mt-8 max-w-[358px] px-4 text-center text-[36px] leading-[1.05] tracking-[-0.36px] text-[#1c1917] md:mb-10 md:mt-[88px] md:max-w-none md:text-[44px] md:tracking-[-0.44px]`}>
        Больше, чем заметки о чае
      </h2>

      <div className="flex flex-col gap-10 md:gap-14">
        {/* 01 — Дегустации: текст слева, карточка справа */}
        <div className="md:grid md:grid-cols-2 md:items-center md:gap-8 xl:grid-cols-[378px_460px] xl:justify-between xl:gap-0">
          <div className="md:order-2">
            <CardShell>
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
              <img
                src="/landing/tags.webp"
                alt=""
                className="absolute left-[168px] top-[192px] w-[208px]"
              />
            </CardShell>
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

        {/* 02 — Карточка: карточка слева, текст справа */}
        <div className="md:grid md:grid-cols-2 md:items-center md:gap-8 xl:grid-cols-[460px_378px] xl:justify-between xl:gap-0">
          <CardShell>
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
              src="/landing/card-photos.webp"
              alt=""
              className="absolute left-1 top-[140px] w-[230px]"
            />
          </CardShell>
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

        {/* 03 — Коллекция: текст слева, карточка справа */}
        <div className="md:grid md:grid-cols-2 md:items-center md:gap-8 xl:grid-cols-[378px_460px] xl:justify-between xl:gap-0">
          <div className="md:order-2">
            <CardShell>
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
                src="/landing/collection-cards.webp"
                alt=""
                className="absolute left-[130px] top-[142px] w-[246px]"
              />
            </CardShell>
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
  Icon: typeof BrowsersIcon;
  title: string;
  text: string;
  soon?: boolean;
};

const MORE_ITEMS: MoreItem[] = [
  {
    Icon: BrowsersIcon,
    title: 'Работает из браузера',
    text: 'Без скачиваний и установки, приложение доступно на любом устройстве прямо из браузера.',
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
    <section id="more" className="mt-10 scroll-mt-20 bg-[#292524] px-4 py-10 md:mt-20 md:py-12">
      <div className="mx-auto max-w-[736px] xl:max-w-[917px]">
        <h2 className={`${SERIF} text-[36px] leading-[1.05] tracking-[-0.36px] text-[#fafaf9] md:text-center md:text-[44px] md:tracking-[-0.44px]`}>
          Другие возможности
        </h2>
        <div className="mt-8 flex flex-col md:mt-10 md:grid md:grid-cols-2 md:gap-x-6">
          {MORE_ITEMS.map(({ Icon, title, text, soon }, i) => (
            <div
              key={title}
              className={`flex gap-4 py-6 ${i > 0 ? 'border-t border-white/10' : ''} ${i === 1 ? 'md:border-t-0' : ''}`}
            >
              <span className="flex size-[70px] shrink-0 items-center justify-center rounded-[16px] bg-[#fafaf9]">
                <Icon size={32} color="#b45309" />
              </span>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between md:justify-start md:gap-2">
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
    <section id="cta" className="relative h-[520px] overflow-hidden bg-[#292524]">
      <picture>
        <source media="(min-width: 1441px)" srcSet="/landing/cta-1440.webp" />
        <source media="(min-width: 1025px)" srcSet="/landing/cta-1280.webp" />
        <source media="(min-width: 641px)" srcSet="/landing/cta-768.webp" />
        <img src="/landing/cta-390.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      <div className="absolute inset-0 bg-black/30" />
      {/* Плавный переход в тёмный футер */}
      <div className="absolute inset-x-0 bottom-0 h-[176px] bg-gradient-to-b from-transparent to-[#292524]" />

      <div className="relative z-[1] mx-auto flex h-full max-w-[621px] flex-col items-center justify-center gap-8 px-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <LandingLogoMark className="size-12" />
          <h2 className={`${SERIF} text-[36px] leading-[1.05] tracking-[-0.36px] text-[#fafaf9] md:text-[44px] md:tracking-[-0.44px]`}>
            Создайте свой <br /> чайный дневник сегодня
          </h2>
        </div>
        <div className="flex w-[280px] flex-col items-center gap-6">
          <Link href="/login?tab=register" className={`${PRIMARY_BTN} min-h-12 w-full px-8 text-[16px]`}>
            Зарегистрироваться
          </Link>
          <p className="text-[14px] leading-5 text-[#fafaf9]">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-[#d97706] underline-offset-2 hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Футер ----------------------------------- */

function LandingFooter() {
  return (
    <footer className="bg-[#292524] px-4 pb-6 pt-4">
      <div className="mx-auto max-w-[736px] xl:max-w-[917px]">
        <div className="flex items-center justify-between">
          <LandingLogo mono className="h-6 w-auto text-[#78716c]" />
          <p className="text-[10px] leading-4 text-[#78716c]">© 2026 LeafPulse — все права защищены</p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
          <a
            href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('LeafPulse: сообщение об ошибке')}`}
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
