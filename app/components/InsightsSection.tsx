'use client';

import { DashboardData } from '@/app/types/dashboard';
import { computeInsights, formatCurrency, formatROAS } from '@/app/lib/utils';

interface InsightCardProps {
  icon: string;
  title: string;
  value: string;
  description: string;
  type?: 'info' | 'warning' | 'success' | 'danger';
}

function InsightCard({ icon, title, value, description, type = 'info' }: InsightCardProps) {
  const borderColors = {
    info: 'border-blue-500/30',
    warning: 'border-yellow-500/30',
    success: 'border-green-500/30',
    danger: 'border-red-500/30',
  };
  const bgColors = {
    info: 'bg-blue-500/5',
    warning: 'bg-yellow-500/5',
    success: 'bg-green-500/5',
    danger: 'bg-red-500/5',
  };
  const valueColors = {
    info: 'text-blue-400',
    warning: 'text-yellow-400',
    success: 'text-green-400',
    danger: 'text-red-400',
  };

  return (
    <div className={`rounded-xl p-5 border ${borderColors[type]} ${bgColors[type]} flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 text-xs font-medium mb-1">{title}</p>
          <p className={`text-base font-bold ${valueColors[type]} leading-tight`}>{value}</p>
        </div>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

interface InsightsSectionProps {
  data: DashboardData;
}

export default function InsightsSection({ data }: InsightsSectionProps) {
  const { bestROASDay, topRevenueCampaign, highFreqCampaigns, cpcPlatforms } = computeInsights(data);

  const cheapest = cpcPlatforms[0];
  const mostExpensive = cpcPlatforms[cpcPlatforms.length - 1];

  return (
    <div>
      <h2 className="text-white font-semibold text-lg mb-4">التحليلات الذكية</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Best ROAS Day */}
        <InsightCard
          icon="🏆"
          title="أفضل يوم في ROAS"
          value={bestROASDay ? `${formatROAS(bestROASDay.roas)} — ${bestROASDay.date}` : '—'}
          description={
            bestROASDay
              ? `تحقق أعلى معدل عائد على الإعلانات بتاريخ ${bestROASDay.date} بمعدل ${formatROAS(bestROASDay.roas)}.`
              : 'لا توجد بيانات كافية لحساب أفضل يوم.'
          }
          type="success"
        />

        {/* Top Revenue Campaign */}
        <InsightCard
          icon="💎"
          title="أعلى حملة إيراداً"
          value={topRevenueCampaign ? formatCurrency(topRevenueCampaign.revenue) : '—'}
          description={
            topRevenueCampaign
              ? `الحملة "${topRevenueCampaign.campaign}" حققت أعلى إيرادات بقيمة ${formatCurrency(topRevenueCampaign.revenue)} ومعدل ROAS ${formatROAS(topRevenueCampaign.roas)}.`
              : 'لا توجد بيانات عن إيرادات الحملات.'
          }
          type="info"
        />

        {/* High Frequency Warning */}
        <InsightCard
          icon={highFreqCampaigns.length > 0 ? '⚠️' : '✅'}
          title="تحذير التكرار العالي"
          value={
            highFreqCampaigns.length > 0
              ? `${highFreqCampaigns.length} حملة بتكرار > 5`
              : 'جميع الحملات طبيعية'
          }
          description={
            highFreqCampaigns.length > 0
              ? `الحملات: ${highFreqCampaigns.map((c) => `"${c.campaign}" (${c.frequency.toFixed(1)}x)`).join('، ')} — قد يؤدي التكرار العالي إلى تعب الجمهور.`
              : 'لا توجد حملات بتكرار عالٍ. أداء جيد!'
          }
          type={highFreqCampaigns.length > 0 ? 'warning' : 'success'}
        />

        {/* CPC Comparison */}
        <InsightCard
          icon="📊"
          title="مقارنة تكلفة النقرة"
          value={cheapest ? `${cheapest.name}: ${formatCurrency(cheapest.cpc)}` : '—'}
          description={
            cheapest && mostExpensive && cheapest.name !== mostExpensive.name
              ? `${cheapest.name} هو الأرخص بتكلفة نقرة ${formatCurrency(cheapest.cpc)}، بينما ${mostExpensive.name} الأعلى بـ ${formatCurrency(mostExpensive.cpc)}.`
              : 'لا توجد بيانات كافية للمقارنة.'
          }
          type="info"
        />
      </div>
    </div>
  );
}
