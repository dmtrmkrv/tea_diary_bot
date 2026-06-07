const CATEGORY_COLORS: Record<string, string> = {
  'Белый':    'bg-[var(--badge-category-white-bg)] text-[var(--badge-category-white-text)]',
  'Желтый':   'bg-[var(--badge-category-yellow-bg)] text-[var(--badge-category-yellow-text)]',
  'Жёлтый':   'bg-[var(--badge-category-yellow-bg)] text-[var(--badge-category-yellow-text)]',
  'Зелёный':  'bg-[var(--badge-category-green-bg)] text-[var(--badge-category-green-text)]',
  'Зеленый':  'bg-[var(--badge-category-green-bg)] text-[var(--badge-category-green-text)]',
  'Красный':  'bg-[var(--badge-category-red-bg)] text-[var(--badge-category-red-text)]',
  'Улун':     'bg-[var(--badge-category-oolong-bg)] text-[var(--badge-category-oolong-text)]',
  'Шу Пуэр':  'bg-[var(--badge-category-shu-bg)] text-[var(--badge-category-shu-text)]',
  'Шу пуэр':  'bg-[var(--badge-category-shu-bg)] text-[var(--badge-category-shu-text)]',
  'Шен Пуэр': 'bg-[var(--badge-category-sheng-bg)] text-[var(--badge-category-sheng-text)]',
  'Шен пуэр': 'bg-[var(--badge-category-sheng-bg)] text-[var(--badge-category-sheng-text)]',
  'Хэй Ча':   'bg-[var(--badge-category-heicha-bg)] text-[var(--badge-category-heicha-text)]',
  'Хэй ча':   'bg-[var(--badge-category-heicha-bg)] text-[var(--badge-category-heicha-text)]',
  'Другое':   'bg-[var(--badge-category-default-bg)] text-[var(--badge-category-default-text)]',
};

const DEFAULT_COLORS = 'bg-[var(--badge-category-default-bg)] text-[var(--badge-category-default-text)]';

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
