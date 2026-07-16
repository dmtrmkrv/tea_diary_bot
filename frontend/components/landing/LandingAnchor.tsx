'use client';

// Якорная ссылка лендинга без записи в истории браузера: «сырые» <a href="#…">
// создают history-записи мимо роутера Next — после ухода на /login кнопка
// «назад» попадала на такую запись, роутер её не узнавал и не перерисовывал
// страницу (URL менялся, экран оставался). Здесь скроллим сами (плавно,
// scroll-mt секций учитывается) и обновляем URL через replaceState.
export default function LandingAnchor({
  href,
  className,
  children,
}: {
  href: `#${string}`;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        const el = document.getElementById(href.slice(1));
        if (!el) return; // секции нет — пусть отработает браузер
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth' });
        window.history.replaceState(null, '', href);
      }}
    >
      {children}
    </a>
  );
}
