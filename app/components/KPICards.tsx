'use client';

import { KPIData } from '@/app/types/dashboard';
import { formatCurrency, formatNumber, formatROAS } from '@/app/lib/utils';

interface KPICardProps {
  label: string;
  value: string;
  icon: string;
  accent?: string;
}

function KPICard({ label, value, icon, accent = 'text-blue-400' }: KPICardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs font-medium">{label}</span>
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
    kpis.snapchatROAS >= 3
      ? 'text-green-400'
      : kpis.snapchatROAS >= 2
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        label="إجمالي الإنفاق"
        value={formatCurrency(kpis.totalSpend)}
        icon="💸"
        accent="text-orange-400"
      />
      <KPICard
        label="إيرادات Snapchat"
        value={formatCurrency(kpis.snapchatRevenue)}
        icon="💰"
        accent="text-yellow-400"
      />
      <KPICard
        label="Snapchat ROAS"
        value={formatROAS(kpis.snapchatROAS)}
        icon="📈"
        accent={roasColor}
      />
      <KPICard
        label="إجمالي المبيعات"
        value={formatNumber(kpis.totalPurchases)}
        icon="🛒"
        accent="text-green-400"
      />
      <KPICard
        label="إجمالي الانطباعات"
        value={formatNumber(kpis.totalImpressions)}
        icon="👁️"
        accent="text-blue-400"
      />
      <KPICard
        label="إجمالي الوصول"
        value={formatNumber(kpis.totalReach)}
        icon="🎯"
        accent="text-purple-400"
      />
    </div>
  );
}
