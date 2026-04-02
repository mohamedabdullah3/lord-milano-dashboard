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
  action_values_purchase: number;
  actions_purchase: number;
  reach: number;
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
  complete_payment_roas: number;
  reach: number;
}

export interface GoogleAdsData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversion_value: number;
}

export interface DashboardData {
  snapchat: SnapchatData[];
  meta: MetaData[];
  tiktok: TikTokData[];
  google: GoogleAdsData[];
  snapchatCampaigns: SnapchatData[];
  lastUpdated: string;
}

export interface KPIData {
  totalSpend: number;
  totalRevenue: number;
  totalROAS: number;
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
  cpm: number;
  conversions: number;
  revenue: number;
  roas: number;
  conversion_rate: number;
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

export type DateRange = 'last_7d' | 'last_14d' | 'last_30d' | 'custom';

export interface CustomDateRange {
  from: string;
  to: string;
}
