'use client';

import { DateRange } from '@/app/types/dashboard';

interface HeaderProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  lastUpdated: string | null;
  onRefresh: () => void;
  isLoading: boolean;
}

const RANGES: { label: string; value: DateRange }[] = [
  { label: 'آخر 7 أيام', value: 'last_7d' },
  { label: 'آخر 14 يوم', value: 'last_14d' },
  { label: 'آخر 30 يوم', value: 'last_30d' },
];

export default function Header({ dateRange, onDateRangeChange, lastUpdated, onRefresh, isLoading }: HeaderProps) {
  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Title */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Lord Milano — Performance Hub
            </h1>
            {lastUpdated && (
              <p className="text-xs text-gray-400 mt-0.5">آخر تحديث: {formattedDate}</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Range Picker */}
            <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => onDateRangeChange(r.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    dateRange === r.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isLoading ? 'جاري التحديث...' : 'تحديث الآن'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
