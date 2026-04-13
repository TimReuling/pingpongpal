import { type TimeFilter } from '@/hooks/useStatsData';
import { t, type Lang } from '@/lib/i18n';

const filters: { key: TimeFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: '7 Days' },
  { key: '30days', label: '30 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

interface Props {
  value: TimeFilter;
  onChange: (f: TimeFilter) => void;
}

export default function TimeFilterBar({ value, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {filters.map(f => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === f.key
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
