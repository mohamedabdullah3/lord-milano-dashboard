import {
  SnapchatData,
  MetaData,
  TikTokData,
  GoogleAdsData,
  DashboardData,
  KPIData,
  PlatformSummary,
  CampaignRow,
  AdRow,
  SnapchatAdRaw,
  MetaAdRaw,
  TikTokAdRaw,
  GoogleAdRaw,
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
  const metaConversions = data.meta.reduce((s, d) => s + (d.actions_purchase || 0), 0);
  const tiktokConversions = data.tiktok.reduce((s, d) => s + (d.conversions || 0), 0);
  const googleConversions = data.google.reduce((s, d) => s + (d.conversions || 0), 0);
  const totalPurchases = snapPurchases + metaConversions + tiktokConversions + googleConversions;

  const totalImpressions =
    data.snapchat.reduce((s, d) => s + (d.impressions || 0), 0) +
    data.meta.reduce((s, d) => s + (d.impressions || 0), 0) +
    data.tiktok.reduce((s, d) => s + (d.impressions || 0), 0) +
    data.google.reduce((s, d) => s + (d.impressions || 0), 0);

  const totalReach =
    data.snapchat.reduce((s, d) => s + (d.total_reach || 0), 0) +
    data.meta.reduce((s, d) => s + (d.reach || 0), 0) +
    data.tiktok.reduce((s, d) => s + (d.reach || 0), 0);

  return { totalSpend, totalRevenue, totalROAS, totalPurchases, totalImpressions, totalReach };
}

export function computePlatformSummaries(data: DashboardData): PlatformSummary[] {
  function avg(arr: number[]): number {
    const valid = arr.filter((v) => v > 0);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  }

  // Snapchat
  const snapSpend = data.snapchat.reduce((s, d) => s + snapToSAR(d.spend || 0), 0);
  const snapRevenue = data.snapchat.reduce((s, d) => s + snapToSAR(d.conversion_purchases_value || 0), 0);
  const snapConversions = data.snapchat.reduce((s, d) => s + (d.conversion_purchases || 0), 0);
  const snapClicks = data.snapchat.reduce((s, d) => s + (d.clicks || 0), 0);

  // Meta
  const metaSpend = data.meta.reduce((s, d) => s + (d.spend || 0), 0);
  const metaRevenue = data.meta.reduce((s, d) => s + (d.action_values_purchase || 0), 0);
  const metaConversions = data.meta.reduce((s, d) => s + (d.actions_purchase || 0), 0);
  const metaClicks = data.meta.reduce((s, d) => s + (d.clicks || 0), 0);

  // TikTok
  const tiktokSpend = data.tiktok.reduce((s, d) => s + (d.spend || 0), 0);
  const tiktokRevenue = data.tiktok.reduce((s, d) => s + ((d.complete_payment_roas || 0) * (d.spend || 0)), 0);
  const tiktokConversions = data.tiktok.reduce((s, d) => s + (d.conversions || 0), 0);
  const tiktokClicks = data.tiktok.reduce((s, d) => s + (d.clicks || 0), 0);

  // Google
  const googleSpend = data.google.reduce((s, d) => s + (d.spend || 0), 0);
  const googleRevenue = data.google.reduce((s, d) => s + (d.conversion_value || 0), 0);
  const googleConversions = data.google.reduce((s, d) => s + (d.conversions || 0), 0);
  const googleClicks = data.google.reduce((s, d) => s + (d.clicks || 0), 0);

  return [
    {
      name: 'Snapchat',
      spend: snapSpend,
      impressions: data.snapchat.reduce((s, d) => s + (d.impressions || 0), 0),
      ctr: avg(data.snapchat.map((d) => d.ctr || 0)),
      cpc: avg(data.snapchat.map((d) => snapToSAR(d.cpc || 0))),
      cpm: avg(data.snapchat.map((d) => snapToSAR(d.cpm || 0))),
      conversions: snapConversions,
      revenue: snapRevenue,
      roas: snapSpend > 0 ? snapRevenue / snapSpend : 0,
      conversion_rate: snapClicks > 0 ? (snapConversions / snapClicks) * 100 : 0,
      color: '#FFFC00',
    },
    {
      name: 'Meta',
      spend: metaSpend,
      impressions: data.meta.reduce((s, d) => s + (d.impressions || 0), 0),
      ctr: avg(data.meta.map((d) => d.ctr || 0)),
      cpc: avg(data.meta.map((d) => d.cpc || 0)),
      cpm: avg(data.meta.map((d) => d.cpm || 0)),
      conversions: metaConversions,
      revenue: metaRevenue,
      roas: metaSpend > 0 ? metaRevenue / metaSpend : 0,
      conversion_rate: metaClicks > 0 ? (metaConversions / metaClicks) * 100 : 0,
      color: '#1877F2',
    },
    {
      name: 'TikTok',
      spend: tiktokSpend,
      impressions: data.tiktok.reduce((s, d) => s + (d.impressions || 0), 0),
      ctr: avg(data.tiktok.map((d) => d.ctr || 0)),
      cpc: avg(data.tiktok.map((d) => d.cpc || 0)),
      cpm: avg(data.tiktok.map((d) => d.cpm || 0)),
      conversions: tiktokConversions,
      revenue: tiktokRevenue,
      roas: tiktokSpend > 0 ? tiktokRevenue / tiktokSpend : 0,
      conversion_rate: tiktokClicks > 0 ? (tiktokConversions / tiktokClicks) * 100 : 0,
      color: '#010101',
    },
    {
      name: 'Google',
      spend: googleSpend,
      impressions: data.google.reduce((s, d) => s + (d.impressions || 0), 0),
      ctr: avg(data.google.map((d) => d.ctr || 0)),
      cpc: avg(data.google.map((d) => d.cpc || 0)),
      cpm: avg(data.google.map((d) => d.cpm || 0)),
      conversions: googleConversions,
      revenue: googleRevenue,
      roas: googleSpend > 0 ? googleRevenue / googleSpend : 0,
      conversion_rate: googleClicks > 0 ? (googleConversions / googleClicks) * 100 : 0,
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
  const metaMap = new Map<string, number[]>();
  const googleMap = new Map<string, number[]>();

  const push = (map: Map<string, number[]>, date: string, val: number) => {
    if (!map.has(date)) map.set(date, []);
    if (val) map.get(date)!.push(val);
  };

  data.snapchat.forEach((d) => push(snapMap, d.date, d.ctr));
  data.tiktok.forEach((d) => push(tiktokMap, d.date, d.ctr));
  data.meta.forEach((d) => push(metaMap, d.date, d.ctr));
  data.google.forEach((d) => push(googleMap, d.date, d.ctr));

  const avgArr = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const dates = new Set([...snapMap.keys(), ...tiktokMap.keys(), ...metaMap.keys(), ...googleMap.keys()]);
  return Array.from(dates)
    .sort()
    .map((date) => ({
      date,
      snapchat: avgArr(snapMap.get(date) || []),
      tiktok: avgArr(tiktokMap.get(date) || []),
      meta: avgArr(metaMap.get(date) || []),
      google: avgArr(googleMap.get(date) || []),
    }));
}

export function aggregateAllPlatformsRevenueVsSpend(data: DashboardData) {
  const map = new Map<string, { date: string; spend: number; revenue: number }>();

  const add = (date: string, spend: number, revenue: number) => {
    if (!map.has(date)) map.set(date, { date, spend: 0, revenue: 0 });
    const e = map.get(date)!;
    e.spend += spend;
    e.revenue += revenue;
  };

  data.snapchat.forEach((d) => add(d.date, snapToSAR(d.spend || 0), snapToSAR(d.conversion_purchases_value || 0)));
  data.meta.forEach((d) => add(d.date, d.spend || 0, d.action_values_purchase || 0));
  data.tiktok.forEach((d) => add(d.date, d.spend || 0, (d.complete_payment_roas || 0) * (d.spend || 0)));
  data.google.forEach((d) => add(d.date, d.spend || 0, d.conversion_value || 0));

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateAllPlatformsROAS(data: DashboardData) {
  type PlatformDaily = { spend: number; revenue: number };
  const snap = new Map<string, PlatformDaily>();
  const meta = new Map<string, PlatformDaily>();
  const tiktok = new Map<string, PlatformDaily>();
  const google = new Map<string, PlatformDaily>();

  const add = (map: Map<string, PlatformDaily>, date: string, spend: number, revenue: number) => {
    if (!map.has(date)) map.set(date, { spend: 0, revenue: 0 });
    const e = map.get(date)!;
    e.spend += spend;
    e.revenue += revenue;
  };

  data.snapchat.forEach((d) => add(snap, d.date, snapToSAR(d.spend || 0), snapToSAR(d.conversion_purchases_value || 0)));
  data.meta.forEach((d) => add(meta, d.date, d.spend || 0, d.action_values_purchase || 0));
  data.tiktok.forEach((d) => add(tiktok, d.date, d.spend || 0, (d.complete_payment_roas || 0) * (d.spend || 0)));
  data.google.forEach((d) => add(google, d.date, d.spend || 0, d.conversion_value || 0));

  const roas = (m: Map<string, PlatformDaily>, date: string) => {
    const e = m.get(date);
    return e && e.spend > 0 ? e.revenue / e.spend : null;
  };

  const dates = new Set([...snap.keys(), ...meta.keys(), ...tiktok.keys(), ...google.keys()]);
  return Array.from(dates).sort().map((date) => ({
    date,
    snapchat: roas(snap, date),
    meta: roas(meta, date),
    tiktok: roas(tiktok, date),
    google: roas(google, date),
  }));
}

export function aggregateMetaCampaigns(data: MetaData[]): CampaignRow[] {
  return data.map((d) => {
    const spend = d.spend || 0;
    const revenue = d.action_values_purchase || 0;
    const purchases = d.actions_purchase || 0;
    return {
      campaign: d.campaign_name || 'Unknown',
      spend,
      impressions: d.impressions || 0,
      ctr: d.ctr || 0,
      cpc: d.cpc || 0,
      frequency: 0,
      purchases,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
    };
  });
}

export function aggregateTikTokCampaigns(data: TikTokData[]): CampaignRow[] {
  return data.map((d) => {
    const spend = d.spend || 0;
    const revenue = (d.complete_payment_roas || 0) * spend;
    const purchases = d.conversions || 0;
    return {
      campaign: d.campaign_name || 'Unknown',
      spend,
      impressions: d.impressions || 0,
      ctr: d.ctr || 0,
      cpc: d.cpc || 0,
      frequency: 0,
      purchases,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
    };
  });
}

export function aggregateGoogleCampaigns(data: GoogleAdsData[]): CampaignRow[] {
  return data.map((d) => {
    const spend = d.spend || 0;
    const revenue = d.conversion_value || 0;
    const purchases = d.conversions || 0;
    return {
      campaign: d.campaign_name || 'Unknown',
      spend,
      impressions: d.impressions || 0,
      ctr: d.ctr || 0,
      cpc: d.cpc || 0,
      frequency: 0,
      purchases,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
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

// =================== Ads Aggregation ===================

const MIN_SPEND_SAR = 50; // حد أدنى للإنفاق عشان نتجاهل الإعلانات غير النشطة

export function aggregateSnapchatAds(data: SnapchatAdRaw[]): AdRow[] {
  return data
    .filter((d) => (d.spend || 0) > 0)
    .map((d) => {
      const spend = snapToSAR(d.spend || 0);
      const revenue = snapToSAR(d.conversion_purchases_value || 0);
      return {
        ad: d.ad_name || 'Unknown',
        spend,
        impressions: d.impressions || 0,
        clicks: d.clicks || 0,
        ctr: d.ctr || 0,
        cpc: snapToSAR(d.cpc || 0),
        conversions: d.conversion_purchases || 0,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
      };
    });
}

export function aggregateMetaAds(data: MetaAdRaw[]): AdRow[] {
  return data
    .filter((d) => (d.spend || 0) > 0)
    .map((d) => {
      const spend = d.spend || 0;
      const revenue = d.action_values_purchase || 0;
      return {
        ad: d.ad_name || 'Unknown',
        spend,
        impressions: d.impressions || 0,
        clicks: d.clicks || 0,
        ctr: d.ctr || 0,
        cpc: d.cpc || 0,
        conversions: d.actions_purchase || 0,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
      };
    });
}

export function aggregateTikTokAds(data: TikTokAdRaw[]): AdRow[] {
  return data
    .filter((d) => (d.spend || 0) > 0)
    .map((d) => {
      const spend = d.spend || 0;
      const revenue = (d.complete_payment_roas || 0) * spend;
      return {
        ad: d.ad_name || 'Unknown',
        spend,
        impressions: d.impressions || 0,
        clicks: d.clicks || 0,
        ctr: d.ctr || 0,
        cpc: d.cpc || 0,
        conversions: d.conversions || 0,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
      };
    });
}

export function aggregateGoogleAds(data: GoogleAdRaw[]): AdRow[] {
  return data
    .filter((d) => (d.spend || 0) > 0)
    .map((d) => {
      const spend = d.spend || 0;
      const revenue = d.conversion_value || 0;
      return {
        ad: d.ad_name || 'Unknown',
        spend,
        impressions: d.impressions || 0,
        clicks: d.clicks || 0,
        ctr: d.ctr || 0,
        cpc: d.cpc || 0,
        conversions: d.conversions || 0,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
      };
    });
}

export function classifyAds(ads: AdRow[], topN = 5): { winners: AdRow[]; weak: AdRow[] } {
  const active = ads.filter((a) => a.spend >= MIN_SPEND_SAR);
  const sorted = [...active].sort((a, b) => b.roas - a.roas);
  const winners = sorted.slice(0, topN);
  const weak = sorted.slice(-topN).reverse().filter((a) => !winners.includes(a));
  return { winners, weak };
}
