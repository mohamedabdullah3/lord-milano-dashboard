'use client';

import { PlatformSummary } from '@/app/types/dashboard';
import { formatCurrency, formatNumber, formatPercent, formatROAS, getRoasColor } from '@/app/lib/utils';

const PLATFORM_ICONS: Record<string, string> = {
  Snapchat: '👻',
  Meta: '📘',
  TikTok: '🎵',
  Google: '🔍',
};

interface PlatformCardProps {
  platform: PlatformSummary;
}

function PlatformCard({ platform }: PlatformCardProps) {
  const isSnapchat = platform.name === 'Snapchat';
  const isDark = platform.color === '#010101';

  const rows = [
    { label: 'الإنفاق', value: formatCurrency(platform.spend) },
    { label: 'عدد المبيعات', value: formatNumber(platform.conversions) },
    { label: 'الإيراد', value: formatCurrency(platform.revenue) },
    {
      label: 'ROAS',
      value: formatROAS(platform.roas),
      colorClass: getRoasColor(platform.roas),
    },
    { label: 'معدل التحويل', value: formatPercent(platform.conversion_rate) },
    { label: 'CTR', value: formatPercent(platform.ctr) },
    { label: 'CPM', value: formatCurrency(platform.cpm) },
    { label: 'CPC', value: formatCurrency(platform.cpc) },
  ];

  return (
    <div
      className="rounded-xl p-5 border flex flex-col gap-3"
      style={{
        borderColor: platform.color + '44',
        background: `linear-gradient(135deg, ${platform.color}15 0%, transparent 60%)`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
          style={{
            backgroundColor: platform.color,
            color: isDark ? '#fff' : isSnapchat ? '#000' : '#fff',
          }}
        >
          {PLATFORM_ICONS[platform.name]}
        </div>
        <div>
          <h3 className="text-white font-semibold">{platform.name}</h3>
          <p className="text-xs text-gray-400">آخر الفترة المحددة</p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">{row.label}</span>
            <span className={`text-sm font-medium ${row.colorClass ?? 'text-white'}`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PlatformCardsProps {
  platforms: PlatformSummary[];
}

export default function PlatformCards({ platforms }: PlatformCardsProps) {
  const totalSpend = platforms.reduce((s, p) => s + p.spend, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {platforms.map((platform) => (
        <div key={platform.name} className="relative flex flex-col gap-0">
          <PlatformCard platform={platform} />
          {totalSpend > 0 && (
            <div className="px-5 pb-3 -mt-1 rounded-b-xl"
              style={{ background: `linear-gradient(135deg, ${platform.color}10 0%, transparent 60%)` }}>
              <div className="h-1 rounded-full bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((platform.spend / totalSpend) * 100)}%`,
                    backgroundColor: platform.color,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">
                {Math.round((platform.spend / totalSpend) * 100)}% من الميزانية
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
