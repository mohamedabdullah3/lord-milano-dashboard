'use client';

import { useState, useMemo } from 'react';
import { SnapchatData, CampaignRow } from '@/app/types/dashboard';
import { aggregateCampaigns, formatCurrency, formatNumber, formatPercent, formatROAS, getRoasColor } from '@/app/lib/utils';

type SortKey = keyof CampaignRow;
type SortDir = 'asc' | 'desc';

interface CampaignsTableProps {
  data: SnapchatData[];
}

export default function CampaignsTable({ data }: CampaignsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAll, setShowAll] = useState(false);

  const campaigns = useMemo(() => aggregateCampaigns(data), [data]);

  const sorted = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [campaigns, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const headers: { key: SortKey; label: string }[] = [
    { key: 'campaign', label: 'اسم الحملة' },
    { key: 'spend', label: 'الإنفاق' },
    { key: 'impressions', label: 'الانطباعات' },
    { key: 'ctr', label: 'CTR' },
    { key: 'cpc', label: 'CPC' },
    { key: 'frequency', label: 'التكرار' },
    { key: 'purchases', label: 'المبيعات' },
    { key: 'revenue', label: 'الإيرادات' },
    { key: 'roas', label: 'ROAS' },
  ];

  function formatCell(key: SortKey, row: CampaignRow): React.ReactNode {
    switch (key) {
      case 'campaign':
        return <span className="max-w-[200px] truncate block" title={row.campaign}>{row.campaign || 'بدون اسم'}</span>;
      case 'spend':
        return formatCurrency(row.spend);
      case 'impressions':
        return formatNumber(row.impressions);
      case 'ctr':
        return formatPercent(row.ctr);
      case 'cpc':
        return formatCurrency(row.cpc);
      case 'frequency':
        return row.frequency.toFixed(2);
      case 'purchases':
        return formatNumber(row.purchases);
      case 'revenue':
        return formatCurrency(row.revenue);
      case 'roas':
        return (
          <span className={`font-semibold ${getRoasColor(row.roas)}`}>{formatROAS(row.roas)}</span>
        );
      default:
        return '—';
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-gray-600 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-gray-700">
        <h3 className="text-white font-semibold text-base">حملات Snapchat</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{sorted.length} حملة</span>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showAll ? 'عرض أقل' : 'عرض الكل'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => toggleSort(h.key)}
                  className="px-4 py-3 text-left text-gray-400 font-medium cursor-pointer hover:text-white transition-colors whitespace-nowrap select-none"
                >
                  {h.label}
                  <SortIcon col={h.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(showAll ? sorted : sorted.slice(0, 10)).map((row, i) => (
              <tr
                key={`${row.campaign}-${i}`}
                className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                {headers.map((h) => (
                  <td key={h.key} className="px-4 py-3 text-white whitespace-nowrap">
                    {formatCell(h.key, row)}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-500">
                  لا توجد بيانات متاحة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!showAll && sorted.length > 10 && (
        <div className="p-4 border-t border-gray-700 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            عرض {sorted.length - 10} حملة إضافية
          </button>
        </div>
      )}
    </div>
  );
}
