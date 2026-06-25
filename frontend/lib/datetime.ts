// Единый формат даты/времени дегустации.
// Время хранится в UTC. Полночь UTC — бэкдейт-маркер «только дата» (показываем
// без времени и без сдвига). Обычная запись — в часовом поясе пользователя
// (offsetMin, автоопределяется при логине). Раньше эта логика была скопирована
// в нескольких местах и «разъехалась» (списки по коллекции показывали сырой
// UTC) — теперь единый источник.
export function formatTastingDatetime(
  isoString: string | null,
  offsetMin: number,
): string | null {
  if (!isoString) return null;
  const iso = isoString.endsWith('Z') ? isoString : isoString + 'Z';
  const date = new Date(iso);
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(date);
  }
  const local = new Date(date.getTime() + offsetMin * 60000);
  const datePart = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(local);
  const h = local.getUTCHours(), m = local.getUTCMinutes();
  return `${datePart}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
