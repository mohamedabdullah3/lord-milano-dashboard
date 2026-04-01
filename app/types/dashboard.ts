export interface SnapchatData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  swipes: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversion_purchases: number;
  conversion_purchases_value: number;
  conversion_add_cart: number;
  total_reach: number;
  frequency: number;
  campaign: string;
}

export interface MetaData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface TikTokData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface GoogleAdsData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

export interface DashboardData {
  snapchat: SnapchatData[];
  meta: MetaData[];
  tiktok: TikTokData[];
  google: GoogleAdsData[];
  lastUpdated: string;
}

export interface KPIData {
  totalSpend: number;
  snapchatRevenue: number;
  snapchatROAS: number;
  totalPurchases: number;
  totalImpressions: number;
  totalReach: number;
}

export interface PlatformSummary {
  name: string;
  spend: number;
  impressions: number;
  ctr: number;
  cpc: number;
  conversions: number;
  color: string;
}

export interface CampaignRow {
  campaign: string;
  spend: number;
  impressions: number;
  ctr: number;
  cpc: number;
  frequency: number;
  purchases: number;
  revenue: number;
  roas: number;
}

export type DateRange = 'last_7d' | 'last_14d' | 'last_30d';
