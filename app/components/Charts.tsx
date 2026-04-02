'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { DashboardData } from '@/app/types/dashboard';
import {
  aggregateDailySpend,
  aggregateAllPlatformsRevenueVsSpend,
  aggregateAllPlatformsROAS,
  aggregateCTRTrend,
  computePlatformSummaries,
} from '@/app/lib/utils';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-4 text-base">{title}</h3>
      {children}
    </div>
  );
}

const CONTENT_STYLE = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' };
const LABEL_STYLE = { color: '#9ca3af' };

function shortDate(date: unknown): string {
  const d = String(date ?? '');
  const parts = d.split('-');
  if (parts.length >= 3) return `${parts[2]}/${parts[1]}`;
  return d;
}

function fmtCurrency(v: unknown): string {
  const n = typeof v === 'number' ? v : 0;
  return `${n.toFixed(2)} ر.س`;
}

function fmtROAS(v: unknown): string {
  const n = typeof v === 'number' ? v : 0;
  return `${n.toFixed(2)}x`;
}

function fmtCTR(v: unknown): string {
  const n = typeof v === 'number' ? v : 0;
  return `${n.toFixed(3)}%`;
}

type CustomTooltipProps = TooltipContentProps<ValueType, NameType>;

function CurrencyTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CONTENT_STYLE} className="px-3 py-2 text-sm">
      <p style={LABEL_STYLE} className="mb-1">{shortDate(label)}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} style={{ color: entry.color }}>
          {entry.name}: {fmtCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

function ROASTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CONTENT_STYLE} className="px-3 py-2 text-sm">
      <p style={LABEL_STYLE} className="mb-1">{shortDate(label)}</p>
      {payload.map((entry) =>
        entry.value != null ? (
          <p key={String(entry.dataKey)} style={{ color: entry.color }}>
            {entry.name}: {fmtROAS(entry.value)}
          </p>
        ) : null
      )}
    </div>
  );
}

function CTRTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CONTENT_STYLE} className="px-3 py-2 text-sm">
      <p style={LABEL_STYLE} className="mb-1">{shortDate(label)}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} style={{ color: entry.color }}>
          {entry.name}: {fmtCTR(entry.value)}
        </p>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CONTENT_STYLE} className="px-3 py-2 text-sm">
      <p style={{ color: '#fff' }}>{payload[0]?.name}: {fmtCurrency(payload[0]?.value)}</p>
    </div>
  );
}

interface ChartsProps {
  data: DashboardData;
}

export default function Charts({ data }: ChartsProps) {
  const dailySpend = aggregateDailySpend(data);
  const allRevenueVsSpend = aggregateAllPlatformsRevenueVsSpend(data);
  const allROAS = aggregateAllPlatformsROAS(data);
  const ctrTrend = aggregateCTRTrend(data);
  const platforms = computePlatformSummaries(data);
  const donutData = platforms
    .filter((p) => p.spend > 0)
    .map((p) => ({ name: p.name, value: p.spend, color: p.color }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1: Daily Spend — كل المنصات */}
      <ChartCard title="الإنفاق اليومي — كل المنصات">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dailySpend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={50} />
            <Tooltip content={(p) => <CurrencyTooltip {...(p as CustomTooltipProps)} />} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line type="monotone" dataKey="snapchat" stroke="#FFFC00" strokeWidth={2} dot={false} name="Snapchat" />
            <Line type="monotone" dataKey="meta" stroke="#1877F2" strokeWidth={2} dot={false} name="Meta" />
            <Line type="monotone" dataKey="tiktok" stroke="#ff6b6b" strokeWidth={2} dot={false} name="TikTok" />
            <Line type="monotone" dataKey="google" stroke="#4285F4" strokeWidth={2} dot={false} name="Google" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 2: All Platforms Revenue vs Spend */}
      <ChartCard title="الإيرادات مقابل الإنفاق — كل المنصات">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={allRevenueVsSpend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={50} />
            <Tooltip content={(p) => <CurrencyTooltip {...(p as CustomTooltipProps)} />} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Bar dataKey="spend" fill="#60a5fa" name="الإنفاق" radius={[2, 2, 0, 0]} />
            <Bar dataKey="revenue" fill="#22c55e" name="الإيرادات" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 3: All Platforms ROAS Daily */}
      <ChartCard title="ROAS اليومي — كل المنصات">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={allROAS} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={40} />
            <Tooltip content={(p) => <ROASTooltip {...(p as CustomTooltipProps)} />} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
            <Line type="monotone" dataKey="snapchat" stroke="#FFFC00" strokeWidth={2} dot={false} name="Snapchat" connectNulls />
            <Line type="monotone" dataKey="meta" stroke="#1877F2" strokeWidth={2} dot={false} name="Meta" connectNulls />
            <Line type="monotone" dataKey="tiktok" stroke="#ff6b6b" strokeWidth={2} dot={false} name="TikTok" connectNulls />
            <Line type="monotone" dataKey="google" stroke="#4285F4" strokeWidth={2} dot={false} name="Google" connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-center">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded bg-green-500 inline-block" /> ROAS &gt; 3x
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> 2x – 3x
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded bg-red-500 inline-block" /> &lt; 2x
          </span>
        </div>
      </ChartCard>

      {/* Chart 4: Channel Spend Donut */}
      <ChartCard title="توزيع الميزانية بين المنصات">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) =>
                `${name} ${percent != null ? (percent * 100).toFixed(0) : 0}%`
              }
              labelLine={{ stroke: '#6b7280' }}
            >
              {donutData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color === '#010101' ? '#6b7280' : entry.color} />
              ))}
            </Pie>
            <Tooltip content={(p) => <DonutTooltip {...(p as CustomTooltipProps)} />} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Chart 5: CTR Trend — كل المنصات */}
      <div className="lg:col-span-2">
        <ChartCard title="مقارنة CTR اليومي — كل المنصات">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ctrTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} width={45} tickFormatter={(v) => `${Number(v).toFixed(2)}%`} />
              <Tooltip content={(p) => <CTRTooltip {...(p as CustomTooltipProps)} />} />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line type="monotone" dataKey="snapchat" stroke="#FFFC00" strokeWidth={2} dot={false} name="Snapchat CTR" />
              <Line type="monotone" dataKey="meta" stroke="#1877F2" strokeWidth={2} dot={false} name="Meta CTR" />
              <Line type="monotone" dataKey="tiktok" stroke="#ff6b6b" strokeWidth={2} dot={false} name="TikTok CTR" />
              <Line type="monotone" dataKey="google" stroke="#4285F4" strokeWidth={2} dot={false} name="Google CTR" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
