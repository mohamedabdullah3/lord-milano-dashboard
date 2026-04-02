'use client';

import { useState, useMemo } from 'react';
import { DashboardData, CampaignRow } from '@/app/types/dashboard';
import {
  aggregateCampaigns,
  aggregateMetaCampaigns,
  aggregateTikTokCampaigns,
  aggregateGoogleCampaigns,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatROAS,
  getRoasColor,
} from '@/app/lib/utils';

type SortKey = keyof CampaignRow;
type SortDir = 'asc' | 'desc';

type Platform = 'snapchat' | 'meta' | 'tiktok' | 'google';

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; color: string }> = {
  snapchat: { label: 'Snapchat', icon: '👻', color: '#FFFC00' },
  meta: { label: 'Meta', icon: '📘', color: '#1877F2' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#ff6b6b' },
  google: { label: 'Google', icon: '🔍', color: '#4285F4' },
};

interface CampaignsTableProps {
  data: DashboardData;
}

export default function CampaignsTable({ data }: CampaignsTableProps) {
  const [activePlatform, setActivePlatform] = useState<Platform>('snapchat');
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAll, setShowAll] = useState(false);

  const campaigns = useMemo(() => {
    switch (activePlatform) {
      case 'snapchat': return aggregateCampaigns(data.snapchatCampaigns);
      case 'meta': return aggregateMetaCampaigns(data.metaCampaigns);
      case 'tiktok': return aggregateTikTokCampaigns(data.tiktokCampaigns);
      case 'google': return aggregateGoogleCampaigns(data.googleCampaigns);
    }
  }, [activePlatform, data]);

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

  function handlePlatformChange(p: Platform) {
    setActivePlatform(p);
    setSortKey('spend');
    setSortDir('desc');
    setShowAll(false);
  }

  const showFrequency = activePlatform === 'snapchat';

  const allHeaders: { key: SortKey; label: string; hide?: boolean }[] = [
    { key: 'campaign', label: 'اسم الحملة' },
    { key: 'spend', label: 'الإنفاق' },
    { key: 'impressions', label: 'الانطباعات' },
    { key: 'ctr', label: 'CTR' },
    { key: 'cpc', label: 'CPC' },
    { key: 'frequency', label: 'التكرار', hide: !showFrequency },
    { key: 'purchases', label: 'المبيعات' },
    { key: 'revenue', label: 'الإيرادات' },
    { key: 'roas', label: 'ROAS' },
  ];
  const headers = allHeaders.filter((h) => !h.hide);

  function formatCell(key: SortKey, row: CampaignRow): React.ReactNode {
    switch (key) {
      case 'campaign':
        return <span className="max-w-[200px] truncate block" title={row.campaign}>{row.campaign || 'بدون اسم'}</span>;
      case 'spend': return formatCurrency(row.spend);
      case 'impressions': return formatNumber(row.impressions);
      case 'ctr': return formatPercent(row.ctr);
      case 'cpc': return formatCurrency(row.cpc);
      case 'frequency': return row.frequency.toFixed(2);
      case 'purchases': return formatNumber(row.purchases);
      case 'revenue': return formatCurrency(row.revenue);
      case 'roas': return <span className={`font-semibold ${getRoasColor(row.roas)}`}>{formatROAS(row.roas)}</span>;
      default: return '—';
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-gray-600 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const cfg = PLATFORM_CONFIG[activePlatform];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      {/* Platform tabs */}
      <div className="flex items-center gap-1 p-4 border-b border-gray-700 overflow-x-auto">
        {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((p) => {
          const c = PLATFORM_CONFIG[p];
          const isActive = p === activePlatform;
          return (
            <button
              key={p}
              onClick={() => handlePlatformChange(p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'text-gray-900'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              style={isActive ? { backgroundColor: c.color === '#FFFC00' ? c.color : c.color, color: c.color === '#FFFC00' ? '#000' : '#fff' } : {}}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Table header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
        <h3 className="text-white font-semibold text-base">
          حملات {cfg.label}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{sorted.length} حملة</span>
          {sorted.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showAll ? 'عرض أقل' : 'عرض الكل'}
            </button>
          )}
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
