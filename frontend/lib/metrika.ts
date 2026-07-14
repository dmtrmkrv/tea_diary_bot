// Цели Яндекс.Метрики. Безопасно вызывать всегда: если счётчик не задан или
// не загружен (нет согласия на аналитику в куки-баннере), вызов молча
// ничего не делает. Сами цели заводятся в интерфейсе Метрики по тем же
// идентификаторам (тип «JavaScript-событие»).
const YM_ID = Number(process.env.NEXT_PUBLIC_YM_COUNTER_ID);

export function ymGoal(name: string, params?: Record<string, unknown>) {
  if (!YM_ID) return;
  window.ym?.(YM_ID, 'reachGoal', name, params);
}
