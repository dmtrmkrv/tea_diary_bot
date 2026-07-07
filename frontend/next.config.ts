import type { NextConfig } from "next";

// Заголовки безопасности на все ответы фронта.
// Полный CSP (script-src/connect-src и т.д.) НЕ включаем здесь: на сайте есть
// инлайн-скрипт Яндекс.Метрики + загрузки с mc.yandex.ru/S3, строгий CSP их
// сломает. Его добавим отдельно в режиме Report-Only. Здесь — только то, что
// безопасно и сразу полезно, в т.ч. frame-ancestors против кликджекинга.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // анти-кликджекинг (старые браузеры)
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }, // он же для новых; скрипты не трогает
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    unoptimized: true,
    // Фото отдаются только с S3 Timeweb по presigned-ссылкам
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.twcstorage.ru',
      },
    ],
  },
};

export default nextConfig;
