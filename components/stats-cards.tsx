import React from 'react';
import { DashboardStats, TranscriptionStatus } from '../lib/types';
import { Disc3 } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats;
  currentFilter: 'all' | TranscriptionStatus;
  onSelectFilter: (filter: 'all' | TranscriptionStatus) => void;
  isLoading?: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  currentFilter,
  onSelectFilter,
  isLoading = false,
}) => {
  const cards = [
    {
      id: 'all' as const,
      label: 'Total Recordings',
      value: stats.total,
      description: 'Audio files in library',
    },
    {
      id: 'completed' as const,
      label: 'Transcribed',
      value: stats.completed,
      description: `${stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% transcribed`,
    },
    {
      id: 'pending' as const,
      label: 'Pending',
      value: stats.pending,
      description: 'Awaiting transcription',
    },
    {
      id: 'failed' as const,
      label: 'Failed',
      value: stats.failed,
      description: stats.failed > 0 ? 'Requires attention' : 'No errors',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const isSelected = currentFilter === card.id;

        return (
          <button
            key={card.id}
            onClick={() => onSelectFilter(card.id)}
            className={`text-left rounded-lg p-4 border transition-all cursor-pointer ${
              isSelected
                ? 'bg-zinc-100/80 dark:bg-zinc-850 border-zinc-400 dark:border-zinc-600 shadow-xs ring-1 ring-zinc-400/40 dark:ring-zinc-600/40'
                : 'bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              <span>{card.label}</span>
              {card.id === 'pending' && stats.processing > 0 && (
                <Disc3 className="w-3.5 h-3.5 animate-spin text-zinc-700 dark:text-zinc-300" />
              )}
            </div>

            <div className="mt-2.5 flex items-baseline">
              {isLoading ? (
                <div className="h-8 w-14 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-sans">
                  {card.value.toLocaleString()}
                </span>
              )}
            </div>

            <div className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
              {card.description}
            </div>
          </button>
        );
      })}
    </div>
  );
};
