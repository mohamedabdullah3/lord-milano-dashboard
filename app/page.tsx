'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/app/components/Header';
import KPICards from '@/app/components/KPICards';
import PlatformCards from '@/app/components/PlatformCards';
import Charts from '@/app/components/Charts';
import CampaignsTable from '@/app/components/CampaignsTable';
import InsightsSection from '@/app/components/InsightsSection';
import ErrorState from '@/app/components/ErrorState';
import {
  KPISkeleton,
  PlatformCardsSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from '@/app/components/LoadingSkeleton';
import { computeKPIs, computePlatformSummaries } from '@/app/lib/utils';
import { DashboardData, DateRange, CustomDateRange } from '@/app/types/dashboard';

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>('last_30d');
  const [customDates, setCustomDates] = useState<CustomDateRange | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (range: DateRange, custom?: CustomDateRange) => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `/api/dashboard?range=${range}`;
      if (range === 'custom' && custom) {
        url += `&date_from=${custom.from}&date_to=${custom.to}`;
      }
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json as DashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange, customDates ?? undefined);
  }, [dateRange, customDates, fetchData]);

  const handleRefresh = () => fetchData(dateRange, customDates ?? undefined);
  const handleDateRangeChange = (range: DateRange, custom?: CustomDateRange) => {
    setDateRange(range);
    setCustomDates(custom ?? null);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        lastUpdated={data?.lastUpdated ?? null}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-8">
        {error ? (
          <ErrorState message={error} onRetry={handleRefresh} />
        ) : (
          <>
            {/* Section: KPI Cards */}
            <section>
              <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">
                الأداء الإجمالي
              </h2>
              {isLoading || !data ? (
                <KPISkeleton />
              ) : (
                <KPICards kpis={computeKPIs(data)} />
              )}
            </section>

            {/* Section: Platform Cards */}
            <section>
              <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">
                أداء المنصات
              </h2>
              {isLoading || !data ? (
                <PlatformCardsSkeleton />
              ) : (
                <PlatformCards platforms={computePlatformSummaries(data)} />
              )}
            </section>

            {/* Section: Charts */}
            <section>
              <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">
                التحليلات البيانية
              </h2>
              {isLoading || !data ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartSkeleton height={280} />
                  <ChartSkeleton height={280} />
                  <ChartSkeleton height={280} />
                  <ChartSkeleton height={280} />
                  <div className="lg:col-span-2">
                    <ChartSkeleton height={250} />
                  </div>
                </div>
              ) : (
                <Charts data={data} />
              )}
            </section>

            {/* Section: Insights */}
            <section>
              {isLoading || !data ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-gray-800 rounded-xl p-5 animate-pulse h-32" />
                  ))}
                </div>
              ) : (
                <InsightsSection data={data} />
              )}
            </section>

            {/* Section: Campaigns Table */}
            <section>
              <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">
                جدول الحملات
              </h2>
              {isLoading || !data ? (
                <TableSkeleton />
              ) : (
                <CampaignsTable data={data.snapchat} />
              )}
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-gray-800 mt-12 py-6 text-center text-gray-600 text-xs">
        Lord Milano — Performance Hub &copy; {new Date().getFullYear()} &bull; يتجدد تلقائياً كل 6 ساعات
      </footer>
    </div>
  );
}
