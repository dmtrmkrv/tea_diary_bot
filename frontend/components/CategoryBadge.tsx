const CATEGORY_COLORS: Record<string, string> = {
  'Белый':     'bg-[#fef3c7] text-[#1c1917]',
  'Желтый':    'bg-[#fde68a] text-[#1c1917]',
  'Жёлтый':   'bg-[#fde68a] text-[#1c1917]',
  'Зелёный':   'bg-[#bbf7d0] text-[#1c1917]',
  'Зеленый':   'bg-[#bbf7d0] text-[#1c1917]',
  'Красный':   'bg-[#c2410c] text-white',
  'Улун':      'bg-[#0e7490] text-white',
  'Шу Пуэр':  'bg-[#713f12] text-white',
  'Шу пуэр':  'bg-[#713f12] text-white',
  'Шен Пуэр': 'bg-[#fb923c] text-[#1c1917]',
  'Шен пуэр': 'bg-[#fb923c] text-[#1c1917]',
  'Хэй Ча':   'bg-[#44403c] text-white',
  'Хэй ча':   'bg-[#44403c] text-white',
  'Другое':   'bg-[#e7e5e4] text-[#1c1917]',
};

const DEFAULT_COLORS = 'bg-[#e7e5e4] text-[#1c1917]';

interface Props {
  category: string;
}

export default function CategoryBadge({ category }: Props) {
  const colors = CATEGORY_COLORS[category] ?? DEFAULT_COLORS;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold leading-[16px] whitespace-nowrap ${colors}`}>
      {category}
    </span>
  );
}
