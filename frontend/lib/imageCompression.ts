/**
 * Client-side image compression before upload.
 *
 * Цели:
 * - Сократить размер фото с современных камер (5-15 MB → ~1 MB) перед отправкой
 *   на бекенд. Помогает на медленном/мобильном интернете.
 * - Уменьшить пиковое разрешение до разумного (1920px по большей стороне) —
 *   достаточно для наших превью и детальных фото, экономит трафик и диск.
 *
 * Решения:
 * - Используем Web Worker (useWebWorker: true) — UI не лагает при сжатии.
 * - Маленькие файлы (≤ 500 KB) пропускаем без обработки — нет смысла.
 * - При ошибке возвращаем оригинальный файл, логируем warn в console.
 *   Загрузка не должна падать только потому что сжатие не удалось.
 */

import imageCompression from 'browser-image-compression';

const SKIP_SIZE_BYTES = 500 * 1024; // 500 KB

const OPTIONS = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.8,
};

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= SKIP_SIZE_BYTES) return file;

  try {
    return await imageCompression(file, OPTIONS);
  } catch (error) {
    console.warn('[compressImage] failed, using original:', error);
    return file;
  }
}
