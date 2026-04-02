'use client';

import { useState } from 'react';
import { DateRange, CustomDateRange } from '@/app/types/dashboard';

interface HeaderProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange, custom?: CustomDateRange) => void;
  lastUpdated: string | null;
  onRefresh: () => void;
  isLoading: boolean;
}

const RANGES: { label: string; value: DateRange }[] = [
  { label: 'آخر 7 أيام', value: 'last_7d' },
  { label: 'آخر 14 يوم', value: 'last_14d' },
  { label: 'آخر 30 يوم', value: 'last_30d' },
  { label: 'مخصص', value: 'custom' },
];

export default function Header({ dateRange, onDateRangeChange, lastUpdated, onRefresh, isLoading }: HeaderProps) {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [showCustom, setShowCustom] = useState(false);
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);

  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  function handleRangeClick(value: DateRange) {
    if (value === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onDateRangeChange(value);
    }
  }

  function handleApplyCustom() {
    if (!fromDate || !toDate) return;
    onDateRangeChange('custom', { from: fromDate, to: toDate });
    setShowCustom(false);
  }

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
            {/* Date Range Buttons */}
            <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => handleRangeClick(r.value)}
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

        {/* Custom Date Range Panel */}
        {showCustom && (
          <div className="mt-3 flex flex-wrap items-end gap-3 p-3 bg-gray-800 rounded-xl border border-gray-700">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">من</label>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">إلى</label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={today}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleApplyCustom}
              disabled={!fromDate || !toDate}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              تطبيق
            </button>
            <button
              onClick={() => setShowCustom(false)}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
            >
              إلغاء
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
