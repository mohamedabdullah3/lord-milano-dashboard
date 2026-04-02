'use client';

import { useState, useMemo } from 'react';
import { DashboardData, AdRow } from '@/app/types/dashboard';
import {
  aggregateSnapchatAds,
  aggregateMetaAds,
  aggregateTikTokAds,
  aggregateGoogleAds,
  classifyAds,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatROAS,
  getRoasColor,
} from '@/app/lib/utils';

type Platform = 'snapchat' | 'meta' | 'tiktok' | 'google';
type AdType = 'winner' | 'average' | 'weak';

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; color: string }> = {
  snapchat: { label: 'Snapchat', icon: '👻', color: '#FFFC00' },
  meta: { label: 'Meta', icon: '📘', color: '#1877F2' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#ff6b6b' },
  google: { label: 'Google', icon: '🔍', color: '#4285F4' },
};

const TYPE_CONFIG: Record<AdType, {
  label: string;
  subtitle: string;
  badge: string;
  icon: string;
  border: string;
  bg: string;
  headerBorder: string;
  headerBg: string;
  rankBg: string;
  emptyIcon: string;
  emptyMsg: string;
}> = {
  winner: {
    label: 'Winner Ads',
    subtitle: 'ROAS أعلى من 4x — إعلانات مربحة جداً',
    badge: '🏆',
    icon: '🏆',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    headerBorder: 'border-green-500/40',
    headerBg: 'bg-green-500/10',
    rankBg: 'bg-green-500',
    emptyIcon: '📭',
    emptyMsg: 'لا يوجد إعلان ROAS > 4x في هذه الفترة',
  },
  average: {
    label: 'Average Ads',
    subtitle: 'ROAS بين 3x و 4x — أداء مقبول',
    badge: '📊',
    icon: '📊',
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5',
    headerBorder: 'border-yellow-500/40',
    headerBg: 'bg-yellow-500/10',
    rankBg: 'bg-yellow-500',
    emptyIcon: '—',
    emptyMsg: 'لا يوجد إعلان في النطاق 3x – 4x',
  },
  weak: {
    label: 'Weak Ads',
    subtitle: 'ROAS أقل من 3x — تحتاج مراجعة أو إيقاف',
    badge: '⚠️',
    icon: '⚠️',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    headerBorder: 'border-red-500/40',
    headerBg: 'bg-red-500/10',
    rankBg: 'bg-red-500',
    emptyIcon: '✅',
    emptyMsg: 'لا يوجد إعلانات ضعيفة — ممتاز!',
  },
};

interface AdCardProps {
  ad: AdRow;
  rank: number;
  type: AdType;
}

function AdCard({ ad, rank, type }: AdCardProps) {
  const cfg = TYPE_CONFIG[type];
  return (
    <div className={`rounded-xl p-4 border flex flex-col gap-3 ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white ${cfg.rankBg}`}>
          {rank}
        </div>
        <p className="text-white text-sm font-medium leading-tight line-clamp-2 flex-1" title={ad.ad}>
          {ad.ad}
        </p>
        <span className="text-lg shrink-0">{cfg.badge}</span>
      </div>

      {/* ROAS badge */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs">ROAS</span>
        <span className={`text-base font-bold ${getRoasColor(ad.roas)}`}>
          {formatROAS(ad.roas)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-800/60 rounded-lg p-2">
          <p className="text-gray-500 mb-0.5">الإنفاق</p>
          <p className="text-white font-medium">{formatCurrency(ad.spend)}</p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-2">
          <p className="text-gray-500 mb-0.5">الإيراد</p>
          <p className="text-white font-medium">{formatCurrency(ad.revenue)}</p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-2">
          <p className="text-gray-500 mb-0.5">CTR</p>
          <p className="text-white font-medium">{formatPercent(ad.ctr)}</p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-2">
          <p className="text-gray-500 mb-0.5">المبيعات</p>
          <p className="text-white font-medium">{formatNumber(ad.conversions)}</p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-2">
          <p className="text-gray-500 mb-0.5">CPC</p>
          <p className="text-white font-medium">{formatCurrency(ad.cpc)}</p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-2">
          <p className="text-gray-500 mb-0.5">الانطباعات</p>
          <p className="text-white font-medium">{formatNumber(ad.impressions)}</p>
        </div>
      </div>
    </div>
  );
}

interface AdsColumnProps {
  ads: AdRow[];
  type: AdType;
}

function AdsColumn({ ads, type }: AdsColumnProps) {
  const [showAll, setShowAll] = useState(false);
  const cfg = TYPE_CONFIG[type];
  const visible = showAll ? ads : ads.slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-xl p-4 border ${cfg.headerBorder} ${cfg.headerBg}`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-semibold text-sm flex items-center gap-2">
              <span>{cfg.icon}</span> {cfg.label}
            </h4>
            <p className="text-gray-400 text-xs mt-0.5">{cfg.subtitle}</p>
          </div>
          <span className="text-2xl font-bold text-white">{ads.length}</span>
        </div>
      </div>

      {ads.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-center">
          <p className="text-2xl mb-2">{cfg.emptyIcon}</p>
          <p className="text-gray-500 text-sm">{cfg.emptyMsg}</p>
        </div>
      ) : (
        <>
          {visible.map((ad, i) => (
            <AdCard key={`${ad.ad}-${i}`} ad={ad} rank={i + 1} type={type} />
          ))}
          {ads.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors text-center py-1"
            >
              {showAll ? 'عرض أقل' : `عرض ${ads.length - 5} إعلان إضافي`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface AdsReviewSectionProps {
  data: DashboardData;
}

export default function AdsReviewSection({ data }: AdsReviewSectionProps) {
  const [activePlatform, setActivePlatform] = useState<Platform>('snapchat');

  const { winners, average, weak, total } = useMemo(() => {
    let ads: AdRow[] = [];
    switch (activePlatform) {
      case 'snapchat': ads = aggregateSnapchatAds(data.snapchatAds); break;
      case 'meta': ads = aggregateMetaAds(data.metaAds); break;
      case 'tiktok': ads = aggregateTikTokAds(data.tiktokAds); break;
      case 'google': ads = aggregateGoogleAds(data.googleAds); break;
    }
    const classified = classifyAds(ads);
    return { ...classified, total: ads.length };
  }, [activePlatform, data]);

  return (
    <div className="flex flex-col gap-4">
      {/* Platform tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((p) => {
          const c = PLATFORM_CONFIG[p];
          const isActive = p === activePlatform;
          return (
            <button
              key={p}
              onClick={() => setActivePlatform(p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive ? '' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              style={isActive ? { backgroundColor: c.color, color: c.color === '#FFFC00' ? '#000' : '#fff' } : {}}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
        <span className="text-xs text-gray-500 mr-2">{total} إعلان نشط</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Winner — ROAS &gt; 4x</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Average — ROAS 3x – 4x</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Weak — ROAS &lt; 3x</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-600 inline-block" /> يُظهر الإعلانات بإنفاق ≥ 50 ر.س فقط</span>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AdsColumn ads={winners} type="winner" />
        <AdsColumn ads={average} type="average" />
        <AdsColumn ads={weak} type="weak" />
      </div>
    </div>
  );
}
