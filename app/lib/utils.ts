import {
  SnapchatData,
  MetaData,
  TikTokData,
  GoogleAdsData,
  DashboardData,
  KPIData,
  PlatformSummary,
  CampaignRow,
} from '@/app/types/dashboard';

export function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('ar-SA');
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatROAS(value: number): string {
  return `${value.toFixed(2)}x`;
}

export function getRoasColor(roas: number): string {
  if (roas >= 3) return 'text-green-500';
  if (roas >= 2) return 'text-yellow-500';
  return 'text-red-500';
}

export function getRoasBg(roas: number): string {
  if (roas >= 3) return 'bg-green-500';
  if (roas >= 2) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function computeKPIs(data: DashboardData): KPIData {
  const snapSpend = data.snapchat.reduce((s, d) => s + (d.spend || 0), 0);
  const metaSpend = data.meta.reduce((s, d) => s + (d.spend || 0), 0);
  const tiktokSpend = data.tiktok.reduce((s, d) => s + (d.spend || 0), 0);
  const googleSpend = data.google.reduce((s, d) => s + (d.spend || 0), 0);
  const totalSpend = snapSpend + metaSpend + tiktokSpend + googleSpend;

  const snapchatRevenue = data.snapchat.reduce((s, d) => s + (d.conversion_purchases_value || 0), 0);
  const snapchatROAS = snapSpend > 0 ? snapchatRevenue / snapSpend : 0;

  const snapPurchases = data.snapchat.reduce((s, d) => s + (d.conversion_purchases || 0), 0);
  const tiktokConversions = data.tiktok.reduce((s, d) => s + (d.conversions || 0), 0);
  const googleConversions = data.google.reduce((s, d) => s + (d.conversions || 0), 0);
  const totalPurchases = snapPurchases + tiktokConversions + googleConversions;

  const totalImpressions =
    data.snapchat.reduce((s, d) => s + (d.impressions || 0), 0) +
    data.meta.reduce((s, d) => s + (d.impressions || 0), 0) +
    data.tiktok.reduce((s, d) => s + (d.impressions || 0), 0) +
    data.google.reduce((s, d) => s + (d.impressions || 0), 0);

  const totalReach = data.snapchat.reduce((s, d) => s + (d.total_reach || 0), 0);

  return { totalSpend, snapchatRevenue, snapchatROAS, totalPurchases, totalImpressions, totalReach };
}

export function computePlatformSummaries(data: DashboardData): PlatformSummary[] {
  function avg(arr: number[]): number {
    const valid = arr.filter((v) => v > 0);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  }

  return [
    {
      name: 'Snapchat',
      spend: data.snapchat.reduce((s, d) => s + (d.spend || 0), 0),
      impressions: data.snapchat.reduce((s, d) => s + (d.impressions || 0), 0),
      ctr: avg(data.snapchat.map((d) => d.ctr || 0)),
      cpc: avg(data.snapchat.map((d) => d.cpc || 0)),
      conversions: data.snapchat.reduce((s, d) => s + (d.conversion_purchases || 0), 0),
      color: '#FFFC00',
    },
    {
      name: 'Meta',
      spend: data.meta.reduce((s, d) => s + (d.spend || 0), 0),
      impressions: data.meta.reduce((s, d) => s + (d.impressions || 0), 0),
      ctr: avg(data.meta.map((d) => d.ctr || 0)),
      cpc: avg(data.meta.map((d) => d.cpc || 0)),
      conversions: 0,
      color: '#1877F2',
    },
    {
      name: 'TikTok',
      spend: data.tiktok.reduce((s, d) => s + (d.spend || 0), 0),
      impressions: data.tiktok.reduce((s, d) => s + (d.impressions || 0), 0),
      ctr: avg(data.tiktok.map((d) => d.ctr || 0)),
      cpc: avg(data.tiktok.map((d) => d.cpc || 0)),
      conversions: data.tiktok.reduce((s, d) => s + (d.conversions || 0), 0),
      color: '#010101',
    },
    {
      name: 'Google',
      spend: data.google.reduce((s, d) => s + (d.spend || 0), 0),
      impressions: data.google.reduce((s, d) => s + (d.impressions || 0), 0),
      ctr: avg(data.google.map((d) => d.ctr || 0)),
      cpc: avg(data.google.map((d) => d.cpc || 0)),
      conversions: data.google.reduce((s, d) => s + (d.conversions || 0), 0),
      color: '#4285F4',
    },
  ];
}

export function aggregateDailySpend(data: DashboardData) {
  const map = new Map<string, { date: string; snapchat: number; meta: number; tiktok: number; google: number }>();

  const addToMap = (date: string, platform: string, spend: number) => {
    if (!map.has(date)) {
      map.set(date, { date, snapchat: 0, meta: 0, tiktok: 0, google: 0 });
    }
    const entry = map.get(date)!;
    (entry as Record<string, number | string>)[platform] =
      ((entry as Record<string, number | string>)[platform] as number) + spend;
  };

  data.snapchat.forEach((d) => addToMap(d.date, 'snapchat', d.spend || 0));
  data.meta.forEach((d) => addToMap(d.date, 'meta', d.spend || 0));
  data.tiktok.forEach((d) => addToMap(d.date, 'tiktok', d.spend || 0));
  data.google.forEach((d) => addToMap(d.date, 'google', d.spend || 0));

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateSnapchatRevenueVsSpend(data: SnapchatData[]) {
  const map = new Map<string, { date: string; spend: number; revenue: number }>();

  data.forEach((d) => {
    if (!map.has(d.date)) {
      map.set(d.date, { date: d.date, spend: 0, revenue: 0 });
    }
    const entry = map.get(d.date)!;
    entry.spend += d.spend || 0;
    entry.revenue += d.conversion_purchases_value || 0;
  });

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateSnapchatROAS(data: SnapchatData[]) {
  const daily = aggregateSnapchatRevenueVsSpend(data);
  return daily.map((d) => ({
    date: d.date,
    roas: d.spend > 0 ? d.revenue / d.spend : 0,
  }));
}

export function aggregateCTRTrend(data: DashboardData) {
  const snapMap = new Map<string, number[]>();
  const tiktokMap = new Map<string, number[]>();

  data.snapchat.forEach((d) => {
    if (!snapMap.has(d.date)) snapMap.set(d.date, []);
    if (d.ctr) snapMap.get(d.date)!.push(d.ctr);
  });
  data.tiktok.forEach((d) => {
    if (!tiktokMap.has(d.date)) tiktokMap.set(d.date, []);
    if (d.ctr) tiktokMap.get(d.date)!.push(d.ctr);
  });

  const dates = new Set([...snapMap.keys(), ...tiktokMap.keys()]);
  return Array.from(dates)
    .sort()
    .map((date) => {
      const sArr = snapMap.get(date) || [];
      const tArr = tiktokMap.get(date) || [];
      return {
        date,
        snapchat: sArr.length > 0 ? sArr.reduce((a, b) => a + b, 0) / sArr.length : 0,
        tiktok: tArr.length > 0 ? tArr.reduce((a, b) => a + b, 0) / tArr.length : 0,
      };
    });
}

export function aggregateCampaigns(data: SnapchatData[]): CampaignRow[] {
  const map = new Map<
    string,
    { spend: number; impressions: number; clicks: number; ctr: number[]; cpc: number[]; frequency: number[]; purchases: number; revenue: number }
  >();

  data.forEach((d) => {
    const key = d.campaign || 'Unknown';
    if (!map.has(key)) {
      map.set(key, { spend: 0, impressions: 0, clicks: 0, ctr: [], cpc: [], frequency: [], purchases: 0, revenue: 0 });
    }
    const entry = map.get(key)!;
    entry.spend += d.spend || 0;
    entry.impressions += d.impressions || 0;
    entry.clicks += d.clicks || 0;
    if (d.ctr) entry.ctr.push(d.ctr);
    if (d.cpc) entry.cpc.push(d.cpc);
    if (d.frequency) entry.frequency.push(d.frequency);
    entry.purchases += d.conversion_purchases || 0;
    entry.revenue += d.conversion_purchases_value || 0;
  });

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  return Array.from(map.entries()).map(([campaign, d]) => ({
    campaign,
    spend: d.spend,
    impressions: d.impressions,
    ctr: avg(d.ctr),
    cpc: avg(d.cpc),
    frequency: avg(d.frequency),
    purchases: d.purchases,
    revenue: d.revenue,
    roas: d.spend > 0 ? d.revenue / d.spend : 0,
  }));
}

export function computeInsights(data: DashboardData) {
  const roasDaily = aggregateSnapchatROAS(data.snapchat);
  const bestROASDay = roasDaily.reduce((best, d) => (d.roas > (best?.roas || 0) ? d : best), roasDaily[0] || null);

  const campaigns = aggregateCampaigns(data.snapchat);
  const topRevenueCampaign = campaigns.reduce(
    (best, c) => (c.revenue > (best?.revenue || 0) ? c : best),
    campaigns[0] || null
  );

  const highFreqCampaigns = campaigns.filter((c) => c.frequency > 5);

  const snapCPC = data.snapchat.reduce((s, d) => s + (d.cpc || 0), 0) / (data.snapchat.filter((d) => d.cpc).length || 1);
  const metaCPC = data.meta.reduce((s, d) => s + (d.cpc || 0), 0) / (data.meta.filter((d) => d.cpc).length || 1);
  const tiktokCPC = data.tiktok.reduce((s, d) => s + (d.cpc || 0), 0) / (data.tiktok.filter((d) => d.cpc).length || 1);
  const googleCPC = data.google.reduce((s, d) => s + (d.cpc || 0), 0) / (data.google.filter((d) => d.cpc).length || 1);

  const cpcPlatforms = [
    { name: 'Snapchat', cpc: snapCPC },
    { name: 'Meta', cpc: metaCPC },
    { name: 'TikTok', cpc: tiktokCPC },
    { name: 'Google', cpc: googleCPC },
  ].sort((a, b) => a.cpc - b.cpc);

  return { bestROASDay, topRevenueCampaign, highFreqCampaigns, cpcPlatforms };
}
