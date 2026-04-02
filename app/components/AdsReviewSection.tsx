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

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; color: string }> = {
  snapchat: { label: 'Snapchat', icon: '👻', color: '#FFFC00' },
  meta: { label: 'Meta', icon: '📘', color: '#1877F2' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#ff6b6b' },
  google: { label: 'Google', icon: '🔍', color: '#4285F4' },
};

interface AdCardProps {
  ad: AdRow;
  rank: number;
  type: 'winner' | 'weak';
}

function AdCard({ ad, rank, type }: AdCardProps) {
  const isWinner = type === 'winner';
  return (
    <div
      className={`rounded-xl p-4 border flex flex-col gap-3 ${
        isWinner
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-red-500/30 bg-red-500/5'
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            isWinner ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {rank}
        </div>
        <p
          className="text-white text-sm font-medium leading-tight line-clamp-2 flex-1"
          title={ad.ad}
        >
          {ad.ad}
        </p>
        {isWinner ? (
          <span className="text-green-400 text-lg shrink-0">🏆</span>
        ) : (
          <span className="text-red-400 text-lg shrink-0">⚠️</span>
        )}
      </div>

      {/* ROAS badge */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs">ROAS</span>
        <span className={`text-base font-bold ${getRoasColor(ad.roas)}`}>
          {formatROAS(ad.roas)}
        </span>
      </div>

      {/* Metrics grid */}
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
  title: string;
  subtitle: string;
  ads: AdRow[];
  type: 'winner' | 'weak';
  headerClass: string;
  emptyIcon: string;
  emptyMsg: string;
}

function AdsColumn({ title, subtitle, ads, type, headerClass, emptyIcon, emptyMsg }: AdsColumnProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-xl p-4 border ${headerClass}`}>
        <h4 className="text-white font-semibold text-base">{title}</h4>
        <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>
      </div>
      {ads.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center">
          <p className="text-3xl mb-2">{emptyIcon}</p>
          <p className="text-gray-500 text-sm">{emptyMsg}</p>
        </div>
      ) : (
        ads.map((ad, i) => (
          <AdCard key={`${ad.ad}-${i}`} ad={ad} rank={i + 1} type={type} />
        ))
      )}
    </div>
  );
}

interface AdsReviewSectionProps {
  data: DashboardData;
}

export default function AdsReviewSection({ data }: AdsReviewSectionProps) {
  const [activePlatform, setActivePlatform] = useState<Platform>('snapchat');

  const { winners, weak, total } = useMemo(() => {
    let ads: AdRow[] = [];
    switch (activePlatform) {
      case 'snapchat': ads = aggregateSnapchatAds(data.snapchatAds); break;
      case 'meta': ads = aggregateMetaAds(data.metaAds); break;
      case 'tiktok': ads = aggregateTikTokAds(data.tiktokAds); break;
      case 'google': ads = aggregateGoogleAds(data.googleAds); break;
    }
    const classified = classifyAds(ads, 5);
    return { ...classified, total: ads.length };
  }, [activePlatform, data]);

  const cfg = PLATFORM_CONFIG[activePlatform];

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
              style={
                isActive
                  ? {
                      backgroundColor: c.color,
                      color: c.color === '#FFFC00' ? '#000' : '#fff',
                    }
                  : {}
              }
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
        <span className="text-xs text-gray-500 mr-2">{total} إعلان نشط</span>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          Winner Ads — ROAS مرتفع
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          Weak Ads — أداء ضعيف أو ROAS منخفض
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-600 inline-block" />
          يُظهر الأعلى إنفاقاً (≥ 50 ر.س)
        </span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdsColumn
          title={`🏆 Winner Ads — ${cfg.label}`}
          subtitle="الإعلانات الأعلى ROAS في الفترة المحددة"
          ads={winners}
          type="winner"
          headerClass="border-green-500/40 bg-green-500/10"
          emptyIcon="📭"
          emptyMsg="لا توجد إعلانات نشطة بإنفاق كافٍ"
        />
        <AdsColumn
          title={`⚠️ Weak Ads — ${cfg.label}`}
          subtitle="الإعلانات الأضعف أداءً — تحتاج مراجعة أو إيقاف"
          ads={weak}
          type="weak"
          headerClass="border-red-500/40 bg-red-500/10"
          emptyIcon="✅"
          emptyMsg="لا توجد إعلانات ضعيفة — كل الإعلانات أداؤها جيد!"
        />
      </div>
    </div>
  );
}
