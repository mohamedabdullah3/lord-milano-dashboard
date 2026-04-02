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

// Snapchat بيرجع بالدولار — باقي المنصات بالريال
const SNAP_USD_TO_SAR = 3.75;

export function snapToSAR(v: number): number {
  return v * SNAP_USD_TO_SAR;
}

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
  // Snapchat: USD → SAR | باقي المنصات: ريال مباشرة
  const snapSpendSAR = data.snapchat.reduce((s, d) => s + snapToSAR(d.spend || 0), 0);
  const metaSpend = data.meta.reduce((s, d) => s + (d.spend || 0), 0);
  const tiktokSpend = data.tiktok.reduce((s, d) => s + (d.spend || 0), 0);
  const googleSpend = data.google.reduce((s, d) => s + (d.spend || 0), 0);
  const totalSpend = snapSpendSAR + metaSpend + tiktokSpend + googleSpend;

  // إيرادات كل المنصات
  const snapRevenue = data.snapchat.reduce((s, d) => s + snapToSAR(d.conversion_purchases_value || 0), 0);
  const metaRevenue = data.meta.reduce((s, d) => s + (d.action_values_purchase || 0), 0);
  // TikTok: revenue = complete_payment_roas × spend (مفيش field مباشر للقيمة)
  const tiktokRevenue = data.tiktok.reduce((s, d) => s + ((d.complete_payment_roas || 0) * (d.spend || 0)), 0);
  const googleRevenue = data.google.reduce((s, d) => s + (d.conversion_value || 0), 0);
  const totalRevenue = snapRevenue + metaRevenue + tiktokRevenue + googleRevenue;
  const totalROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

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

  return { totalSpend, totalRevenue, totalROAS, totalPurchases, totalImpressions, totalReach };
}

export function computePlatformSummaries(data: DashboardData): PlatformSummary[] {
  function avg(arr: number[]): number {
    const valid = arr.filter((v) => v > 0);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  }

  return [
    {
      name: 'Snapchat',
      spend: data.snapchat.reduce((s, d) => s + snapToSAR(d.spend || 0), 0),
      impressions: data.snapchat.reduce((s, d) => s + (d.impressions || 0), 0),
      ctr: avg(data.snapchat.map((d) => d.ctr || 0)),
      cpc: avg(data.snapchat.map((d) => snapToSAR(d.cpc || 0))),
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

  // Snapchat: تحويل لريال، باقي المنصات: ريال مباشرة
  data.snapchat.forEach((d) => addToMap(d.date, 'snapchat', snapToSAR(d.spend || 0)));
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
    entry.spend += snapToSAR(d.spend || 0);
    entry.revenue += snapToSAR(d.conversion_purchases_value || 0);
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

// snapchatCampaigns: بيانات مجمّعة على مستوى الحملة بدون date dimension
export function aggregateCampaigns(data: SnapchatData[]): CampaignRow[] {
  return data.map((d) => {
    const spend = snapToSAR(d.spend || 0);
    const revenue = snapToSAR(d.conversion_purchases_value || 0);
    return {
      campaign: d.campaign || 'Unknown',
      spend,
      impressions: d.impressions || 0,
      ctr: d.ctr || 0,
      cpc: snapToSAR(d.cpc || 0),
      frequency: d.frequency || 0,
      purchases: d.conversion_purchases || 0,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
    };
  });
}

export function computeInsights(data: DashboardData) {
  const roasDaily = aggregateSnapchatROAS(data.snapchat);
  const bestROASDay = roasDaily.reduce((best, d) => (d.roas > (best?.roas || 0) ? d : best), roasDaily[0] || null);

  const campaigns = aggregateCampaigns(data.snapchatCampaigns);
  const topRevenueCampaign = campaigns.reduce(
    (best, c) => (c.revenue > (best?.revenue || 0) ? c : best),
    campaigns[0] || null
  );

  const highFreqCampaigns = campaigns.filter((c) => c.frequency > 5);

  // متوسط CPC لكل منصة
  const snapCPC = data.snapchat.filter((d) => d.cpc).reduce((s, d) => s + snapToSAR(d.cpc), 0) / (data.snapchat.filter((d) => d.cpc).length || 1);
  const metaCPC = data.meta.filter((d) => d.cpc).reduce((s, d) => s + d.cpc, 0) / (data.meta.filter((d) => d.cpc).length || 1);
  const tiktokCPC = data.tiktok.filter((d) => d.cpc).reduce((s, d) => s + d.cpc, 0) / (data.tiktok.filter((d) => d.cpc).length || 1);
  const googleCPC = data.google.filter((d) => d.cpc).reduce((s, d) => s + d.cpc, 0) / (data.google.filter((d) => d.cpc).length || 1);

  const cpcPlatforms = [
    { name: 'Snapchat', cpc: snapCPC },
    { name: 'Meta', cpc: metaCPC },
    { name: 'TikTok', cpc: tiktokCPC },
    { name: 'Google', cpc: googleCPC },
  ].sort((a, b) => a.cpc - b.cpc);

  return { bestROASDay, topRevenueCampaign, highFreqCampaigns, cpcPlatforms };
}
