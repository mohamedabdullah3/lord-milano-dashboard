'use client';

import { KPIData } from '@/app/types/dashboard';
import { formatCurrency, formatNumber, formatROAS } from '@/app/lib/utils';

interface KPICardProps {
  label: string;
  sublabel?: string;
  value: string;
  icon: string;
  accent?: string;
}

function KPICard({ label, sublabel, value, icon, accent = 'text-blue-400' }: KPICardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-gray-400 text-xs font-medium">{label}</span>
          {sublabel && (
            <p className="text-gray-600 text-xs mt-0.5">{sublabel}</p>
          )}
        </div>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-lg sm:text-xl font-bold ${accent} leading-tight`}>{value}</p>
    </div>
  );
}

interface KPICardsProps {
  kpis: KPIData;
}

export default function KPICards({ kpis }: KPICardsProps) {
  const roasColor =
    kpis.totalROAS >= 3
      ? 'text-green-400'
      : kpis.totalROAS >= 2
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        label="إجمالي الإنفاق"
        sublabel="كل المنصات"
        value={formatCurrency(kpis.totalSpend)}
        icon="💸"
        accent="text-orange-400"
      />
      <KPICard
        label="إجمالي الإيرادات"
        sublabel="Snap + Meta + Google"
        value={formatCurrency(kpis.totalRevenue)}
        icon="💰"
        accent="text-yellow-400"
      />
      <KPICard
        label="إجمالي ROAS"
        sublabel="كل المنصات"
        value={formatROAS(kpis.totalROAS)}
        icon="📈"
        accent={roasColor}
      />
      <KPICard
        label="إجمالي التحويلات"
        sublabel="Snap + TikTok + Google"
        value={formatNumber(kpis.totalPurchases)}
        icon="🛒"
        accent="text-green-400"
      />
      <KPICard
        label="إجمالي الانطباعات"
        sublabel="كل المنصات"
        value={formatNumber(kpis.totalImpressions)}
        icon="👁️"
        accent="text-blue-400"
      />
      <KPICard
        label="إجمالي الوصول"
        sublabel="Snapchat فقط"
        value={formatNumber(kpis.totalReach)}
        icon="🎯"
        accent="text-purple-400"
      />
    </div>
  );
}
