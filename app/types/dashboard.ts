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
  campaign_name?: string;
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
  campaign_name?: string;
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
  campaign_name?: string;
}

export interface SnapchatAdRaw {
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversion_purchases: number;
  conversion_purchases_value: number;
}

export interface MetaAdRaw {
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  action_values_purchase: number;
  actions_purchase: number;
}

export interface TikTokAdRaw {
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  complete_payment_roas: number;
}

export interface GoogleAdRaw {
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversion_value: number;
}

export interface AdRow {
  ad: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  revenue: number;
  roas: number;
}

export interface DashboardData {
  snapchat: SnapchatData[];
  meta: MetaData[];
  tiktok: TikTokData[];
  google: GoogleAdsData[];
  snapchatCampaigns: SnapchatData[];
  metaCampaigns: MetaData[];
  tiktokCampaigns: TikTokData[];
  googleCampaigns: GoogleAdsData[];
  snapchatAds: SnapchatAdRaw[];
  metaAds: MetaAdRaw[];
  tiktokAds: TikTokAdRaw[];
  googleAds: GoogleAdRaw[];
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

export type DateRange = 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d' | 'custom';

export interface CustomDateRange {
  from: string;
  to: string;
}
