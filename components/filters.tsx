import React from 'react';
import { TranscriptionStatus, SortField, SortOrder } from '../lib/types';
import { Search, X, ArrowUpDown } from 'lucide-react';

interface FiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: 'all' | TranscriptionStatus;
  onStatusFilterChange: (status: 'all' | TranscriptionStatus) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  totalFiltered: number;
  totalRecordings: number;
}

export const Filters: React.FC<FiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortField,
  sortOrder,
  onSortChange,
  totalFiltered,
  totalRecordings,
}) => {
  const statusOptions: { value: 'all' | TranscriptionStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'failed', label: 'Failed' },
  ];

  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'uploaded', label: 'Upload Date' },
    { field: 'name', label: 'Filename' },
    { field: 'status', label: 'Status' },
    { field: 'size', label: 'File Size' },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-lg p-3 space-y-2.5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by filename or transcript text..."
            className="w-full pl-9 pr-8 py-1.5 bg-zinc-50/70 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-zinc-50/70 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400">
            <ArrowUpDown className="w-3 h-3 mr-1 text-zinc-400" />
            <select
              value={sortField}
              onChange={(e) => onSortChange(e.target.value as SortField, sortOrder)}
              className="bg-transparent border-none text-zinc-800 dark:text-zinc-200 font-medium focus:outline-none cursor-pointer pr-1 text-xs"
            >
              {sortOptions.map((opt) => (
                <option key={opt.field} value={opt.field} className="dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => onSortChange(sortField, sortOrder === 'asc' ? 'desc' : 'asc')}
              className="ml-1 px-1 py-0.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold"
              title={`Switch to ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Badges & Count */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
        <div className="flex items-center gap-1 flex-wrap">
          {statusOptions.map((opt) => {
            const isActive = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onStatusFilterChange(opt.value)}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-medium'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
          {totalFiltered} of {totalRecordings} items
        </div>
      </div>
    </div>
  );
};
