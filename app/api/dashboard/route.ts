import { NextRequest, NextResponse } from 'next/server';

const WINDSOR_BASE = 'https://connectors.windsor.ai';
const API_KEY = process.env.WINDSOR_API_KEY;

const ACCOUNTS = {
  snapchat: { id: '99561083-47c8-44e8-b151-d8da6f7889e7', connector: 'snapchat' },
  meta: { id: '2162167917169716', connector: 'facebook' },
  tiktok: { id: '7246362236950724610', connector: 'tiktok' },
  google: { id: '861-389-5615', connector: 'google_ads' },
};

// Daily metrics — بدون campaign عشان الداتا تبقى صغيرة
const DAILY_FIELDS = {
  snapchat: 'date,spend,impressions,clicks,swipes,ctr,cpc,cpm,conversion_purchases,conversion_purchases_value,conversion_add_cart,total_reach,frequency',
  meta: 'date,spend,impressions,clicks,ctr,cpc,cpm,action_values_purchase,actions_purchase,reach',
  tiktok: 'date,spend,impressions,clicks,conversions,ctr,cpc,cpm,complete_payment_roas,reach',
  google: 'date,spend,impressions,clicks,conversions,ctr,cpc,cpm,conversion_value',
};

// Campaigns — Snapchat فقط، بدون date عشان يجمع على مستوى الحملة
const CAMPAIGN_FIELDS = 'campaign,spend,impressions,clicks,ctr,cpc,cpm,conversion_purchases,conversion_purchases_value,conversion_add_cart,total_reach,frequency';

function getDatePreset(range: string): string {
  switch (range) {
    case 'last_7d': return 'last_7dT';
    case 'last_14d': return 'last_14dT';
    case 'last_30d':
    default: return 'last_30dT';
  }
}

async function fetchConnectorData(
  connector: string,
  accountId: string,
  fields: string,
  datePreset: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const url = new URL(`${WINDSOR_BASE}/${connector}`);
  url.searchParams.set('api_key', API_KEY || '');
  if (dateFrom && dateTo) {
    url.searchParams.set('date_from', dateFrom);
    url.searchParams.set('date_to', dateTo);
  } else {
    url.searchParams.set('date_preset', datePreset);
  }
  url.searchParams.set('fields', fields);
  url.searchParams.set('account_id', accountId);

  const res = await fetch(url.toString(), { cache: 'no-store' });

  if (!res.ok) {
    console.error(`Failed to fetch ${connector}: ${res.status} ${res.statusText}`);
    return [];
  }

  const json = await res.json();
  return json.data || [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || 'last_30d';
  const dateFrom = searchParams.get('date_from') || undefined;
  const dateTo = searchParams.get('date_to') || undefined;
  const datePreset = getDatePreset(range);

  try {
    const [snapchat, meta, tiktok, google, snapchatCampaigns] = await Promise.allSettled([
      fetchConnectorData(ACCOUNTS.snapchat.connector, ACCOUNTS.snapchat.id, DAILY_FIELDS.snapchat, datePreset, dateFrom, dateTo),
      fetchConnectorData(ACCOUNTS.meta.connector, ACCOUNTS.meta.id, DAILY_FIELDS.meta, datePreset, dateFrom, dateTo),
      fetchConnectorData(ACCOUNTS.tiktok.connector, ACCOUNTS.tiktok.id, DAILY_FIELDS.tiktok, datePreset, dateFrom, dateTo),
      fetchConnectorData(ACCOUNTS.google.connector, ACCOUNTS.google.id, DAILY_FIELDS.google, datePreset, dateFrom, dateTo),
      fetchConnectorData(ACCOUNTS.snapchat.connector, ACCOUNTS.snapchat.id, CAMPAIGN_FIELDS, datePreset, dateFrom, dateTo),
    ]);

    return NextResponse.json({
      snapchat: snapchat.status === 'fulfilled' ? snapchat.value : [],
      meta: meta.status === 'fulfilled' ? meta.value : [],
      tiktok: tiktok.status === 'fulfilled' ? tiktok.value : [],
      google: google.status === 'fulfilled' ? google.value : [],
      snapchatCampaigns: snapchatCampaigns.status === 'fulfilled' ? snapchatCampaigns.value : [],
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
