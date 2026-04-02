'use client';

import { useMemo } from 'react';
import { DashboardData } from '@/app/types/dashboard';
import { generateRecommendations, Recommendation, RecPriority, RecCategory } from '@/app/lib/recommendations';

// ---- Config ----

const PRIORITY_CONFIG: Record<RecPriority, { label: string; dot: string; badge: string; border: string }> = {
  high:   { label: 'عالي',   dot: 'bg-red-500',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',    border: 'border-red-500/25' },
  medium: { label: 'متوسط',  dot: 'bg-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', border: 'border-yellow-500/25' },
  low:    { label: 'منخفض',  dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',   border: 'border-blue-500/25' },
};

const CATEGORY_CONFIG: Record<RecCategory, { icon: string; label: string; bg: string }> = {
  budget:      { icon: '💰', label: 'الميزانية',   bg: 'bg-purple-500/10' },
  creative:    { icon: '🎨', label: 'الكريتيف',    bg: 'bg-pink-500/10' },
  performance: { icon: '📉', label: 'الأداء',      bg: 'bg-orange-500/10' },
  alert:       { icon: '🚨', label: 'تنبيه',       bg: 'bg-red-500/10' },
  scale:       { icon: '🚀', label: 'التوسع',      bg: 'bg-green-500/10' },
  audience:    { icon: '🎯', label: 'الجمهور',     bg: 'bg-cyan-500/10' },
};

const PLATFORM_ICONS: Record<string, string> = {
  Snapchat: '👻',
  Meta: '📘',
  TikTok: '🎵',
  Google: '🔍',
};

// ---- Card ----

function RecCard({ rec }: { rec: Recommendation }) {
  const p = PRIORITY_CONFIG[rec.priority];
  const c = CATEGORY_CONFIG[rec.category];

  return (
    <div className={`rounded-xl border bg-gray-800 flex flex-col gap-4 p-5 ${p.border}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${p.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
            أولوية {p.label}
          </span>
          {/* Category badge */}
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-gray-300 ${c.bg}`}>
            {c.icon} {c.label}
          </span>
          {/* Platform badge */}
          {rec.platform && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-gray-300 bg-gray-700/60">
              {PLATFORM_ICONS[rec.platform] ?? '📡'} {rec.platform}
            </span>
          )}
        </div>
        {/* Metric pill */}
        {rec.metric && (
          <span className="text-xs text-gray-400 bg-gray-700/60 px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0">
            {rec.metric}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-white font-semibold text-sm leading-snug">{rec.title}</h4>

      {/* Description */}
      <p className="text-gray-400 text-sm leading-relaxed">{rec.description}</p>

      {/* Action */}
      <div className="flex items-start gap-2 bg-gray-700/40 rounded-lg p-3">
        <span className="text-blue-400 shrink-0 mt-0.5">→</span>
        <p className="text-blue-300 text-sm font-medium leading-snug">{rec.action}</p>
      </div>
    </div>
  );
}

// ---- Summary bar ----

function SummaryBar({ recs }: { recs: Recommendation[] }) {
  const high = recs.filter((r) => r.priority === 'high').length;
  const medium = recs.filter((r) => r.priority === 'medium').length;
  const low = recs.filter((r) => r.priority === 'low').length;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {high > 0 && (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-sm text-red-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-red-500" /> {high} عالية الأولوية
        </span>
      )}
      {medium > 0 && (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/15 border border-yellow-500/25 text-sm text-yellow-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> {medium} متوسطة
        </span>
      )}
      {low > 0 && (
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-sm text-blue-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> {low} منخفضة
        </span>
      )}
    </div>
  );
}

// ---- Main ----

interface RecommendationsSectionProps {
  data: DashboardData;
  nextRefresh: Date | null;
}

export default function RecommendationsSection({ data, nextRefresh }: RecommendationsSectionProps) {
  const recs = useMemo(() => generateRecommendations(data), [data]);

  const timeUntilRefresh = nextRefresh
    ? Math.max(0, Math.ceil((nextRefresh.getTime() - Date.now()) / 60000))
    : null;

  if (recs.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
        <p className="text-3xl mb-2">✅</p>
        <p className="text-white font-medium">لا توجد توصيات — كل المؤشرات في النطاق الجيد</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header info */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SummaryBar recs={recs} />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {timeUntilRefresh !== null
            ? `التحديث التالي خلال ${timeUntilRefresh} دقيقة`
            : 'يتجدد تلقائياً كل 3 ساعات'}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recs.map((rec) => (
          <RecCard key={rec.id} rec={rec} />
        ))}
      </div>

      <p className="text-xs text-gray-600 text-center">
        التوصيات مبنية على بيانات الفترة المحددة — تُحدَّث تلقائياً مع كل تحديث للبيانات
      </p>
    </div>
  );
}
