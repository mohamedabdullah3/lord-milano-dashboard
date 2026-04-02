import { DashboardData } from '@/app/types/dashboard';
import {
  computeKPIs,
  computePlatformSummaries,
  aggregateCampaigns,
  aggregateSnapchatAds,
  aggregateMetaAds,
  aggregateTikTokAds,
  aggregateGoogleAds,
  classifyAds,
  snapToSAR,
} from '@/app/lib/utils';

export type RecPriority = 'high' | 'medium' | 'low';
export type RecCategory =
  | 'budget'
  | 'creative'
  | 'performance'
  | 'alert'
  | 'scale'
  | 'audience';

export interface Recommendation {
  id: string;
  priority: RecPriority;
  category: RecCategory;
  platform?: string;
  title: string;
  description: string;
  action: string;
  metric?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  Snapchat: '#FFFC00',
  Meta: '#1877F2',
  TikTok: '#ff6b6b',
  Google: '#4285F4',
};

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

export function generateRecommendations(data: DashboardData): Recommendation[] {
  const recs: Recommendation[] = [];
  const kpis = computeKPIs(data);
  const platforms = computePlatformSummaries(data);
  const activePlatforms = platforms.filter((p) => p.spend > 0);

  if (activePlatforms.length === 0) return [];

  // ---- 1. OVERALL ROAS ALERT ----
  if (kpis.totalROAS < 1) {
    recs.push({
      id: 'overall-roas-critical',
      priority: 'high',
      category: 'alert',
      title: 'ROAS إجمالي أقل من 1x — خسارة على كل ريال',
      description: `الحملات تنفق أكثر مما تجني. إجمالي ROAS = ${fmt(kpis.totalROAS)}x. يجب إيقاف الإعلانات الضعيفة فوراً ومراجعة الاستراتيجية.`,
      action: 'أوقف الإعلانات ذات ROAS < 1x وراجع الصفحات المقصودة',
      metric: `ROAS ${fmt(kpis.totalROAS)}x`,
    });
  } else if (kpis.totalROAS < 2) {
    recs.push({
      id: 'overall-roas-low',
      priority: 'high',
      category: 'performance',
      title: 'ROAS الإجمالي منخفض — يحتاج تحسيناً عاجلاً',
      description: `ROAS الإجمالي = ${fmt(kpis.totalROAS)}x. المستهدف المقبول 3x على الأقل. راجع توزيع الميزانية والإعلانات الضعيفة.`,
      action: 'راجع أداء كل منصة وخفّض الإنفاق على المنصات ذات ROAS < 2x',
      metric: `ROAS ${fmt(kpis.totalROAS)}x`,
    });
  } else if (kpis.totalROAS >= 5) {
    recs.push({
      id: 'overall-roas-excellent',
      priority: 'low',
      category: 'scale',
      title: 'أداء ممتاز — ROAS إجمالي أعلى من 5x',
      description: `ROAS الإجمالي = ${fmt(kpis.totalROAS)}x. هذا وقت مثالي لزيادة الميزانية والاستفادة من الزخم الحالي.`,
      action: 'زِد الميزانية بنسبة 20–30% على المنصات الأعلى ROAS',
      metric: `ROAS ${fmt(kpis.totalROAS)}x`,
    });
  }

  // ---- 2. BUDGET REALLOCATION ----
  if (activePlatforms.length >= 2) {
    const sorted = [...activePlatforms].sort((a, b) => b.roas - a.roas);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best.roas > 4 && worst.roas < 2 && worst.spend > 500) {
      recs.push({
        id: 'budget-reallocation',
        priority: 'high',
        category: 'budget',
        platform: best.name,
        title: `حوّل جزءاً من ميزانية ${worst.name} إلى ${best.name}`,
        description: `${best.name} يحقق ROAS ${fmt(best.roas)}x بينما ${worst.name} عند ${fmt(worst.roas)}x مع إنفاق ${fmt(worst.spend, 0)} ر.س. إعادة التوزيع ستحسن العائد الإجمالي.`,
        action: `خفّض ميزانية ${worst.name} بنسبة 20–40% وحوّلها إلى ${best.name}`,
        metric: `فرق ROAS ${fmt(best.roas - worst.roas)}x`,
      });
    } else if (best.roas > worst.roas * 1.5 && worst.spend > 200) {
      recs.push({
        id: 'budget-shift-mild',
        priority: 'medium',
        category: 'budget',
        platform: best.name,
        title: `${best.name} يتفوق على ${worst.name} — راجع توزيع الميزانية`,
        description: `${best.name}: ROAS ${fmt(best.roas)}x مقابل ${worst.name}: ROAS ${fmt(worst.roas)}x. فرق الأداء يستحق إعادة التوزيع.`,
        action: `اختبر زيادة ميزانية ${best.name} بنسبة 15% وقِس الأثر على الإيراد`,
        metric: `${best.name} ROAS ${fmt(best.roas)}x`,
      });
    }
  }

  // ---- 3. PER-PLATFORM ROAS ----
  for (const p of activePlatforms) {
    if (p.roas > 4) {
      recs.push({
        id: `scale-${p.name}`,
        priority: 'medium',
        category: 'scale',
        platform: p.name,
        title: `${p.name} — ROAS Winner (${fmt(p.roas)}x) — وقت التوسع`,
        description: `${p.name} يحقق عائداً ممتازاً. زيادة الميزانية الآن ستضاعف الإيراد بنسب متوقعة مع الحفاظ على كفاءة الإنفاق.`,
        action: `ابدأ بزيادة ميزانية ${p.name} تدريجياً بمقدار 15–25% كل أسبوع`,
        metric: `ROAS ${fmt(p.roas)}x`,
      });
    } else if (p.roas < 2 && p.spend > 300) {
      recs.push({
        id: `low-roas-${p.name}`,
        priority: 'high',
        category: 'performance',
        platform: p.name,
        title: `${p.name} — ROAS ضعيف (${fmt(p.roas)}x) مع إنفاق مرتفع`,
        description: `${p.name} ينفق ${fmt(p.spend, 0)} ر.س ويحقق ROAS ${fmt(p.roas)}x فقط. هذا يعني خسارة في كفاءة الإنفاق. راجع الإعلانات والاستهداف.`,
        action: `أوقف الإعلانات ذات ROAS < 2x على ${p.name} وراجع الاستهداف والكريتيف`,
        metric: `ROAS ${fmt(p.roas)}x — إنفاق ${fmt(p.spend, 0)} ر.س`,
      });
    }
  }

  // ---- 4. CTR ISSUES ----
  for (const p of activePlatforms) {
    if (p.ctr < 0.5 && p.impressions > 10000) {
      recs.push({
        id: `low-ctr-${p.name}`,
        priority: 'medium',
        category: 'creative',
        platform: p.name,
        title: `${p.name} — CTR منخفض جداً (${fmt(p.ctr)}%)`,
        description: `CTR أقل من 0.5% مع ${p.impressions.toLocaleString()} انطباع يعني أن الكريتيف لا يجذب الجمهور المستهدف. جرّب كريتيف جديد أو غيّر الاستهداف.`,
        action: `اختبر 2–3 كريتيف جديدة مختلفة على ${p.name} وقِس أثرها على CTR`,
        metric: `CTR ${fmt(p.ctr)}%`,
      });
    }
  }

  // ---- 5. CONVERSION RATE ----
  for (const p of activePlatforms) {
    if (p.conversion_rate < 0.5 && p.impressions > 100 && p.ctr > 1) {
      recs.push({
        id: `low-cvr-${p.name}`,
        priority: 'medium',
        category: 'audience',
        platform: p.name,
        title: `${p.name} — معدل تحويل ضعيف رغم CTR جيد`,
        description: `CTR = ${fmt(p.ctr)}% لكن معدل التحويل = ${fmt(p.conversion_rate)}% فقط. الزوار يصلون للموقع لكن لا يشترون — المشكلة في الـ Landing Page أو تجربة الشراء.`,
        action: `راجع صفحة المنتج وسرعة الموقع وسهولة الشراء. اختبر عروض مختلفة`,
        metric: `CVR ${fmt(p.conversion_rate)}% | CTR ${fmt(p.ctr)}%`,
      });
    }
  }

  // ---- 6. CPC EFFICIENCY ----
  const activePlatformsByCPC = activePlatforms
    .filter((p) => p.cpc > 0)
    .sort((a, b) => a.cpc - b.cpc);

  if (activePlatformsByCPC.length >= 2) {
    const cheapest = activePlatformsByCPC[0];
    const expensive = activePlatformsByCPC[activePlatformsByCPC.length - 1];
    if (expensive.cpc > cheapest.cpc * 3 && cheapest.roas >= 2) {
      recs.push({
        id: 'cpc-efficiency',
        priority: 'low',
        category: 'budget',
        platform: cheapest.name,
        title: `${cheapest.name} الأرخص في تكلفة النقرة`,
        description: `CPC على ${cheapest.name} = ${fmt(cheapest.cpc)} ر.س مقارنة بـ ${expensive.name} = ${fmt(expensive.cpc)} ر.س. لاستهداف الوعي والترافيك ${cheapest.name} خيار أكثر كفاءة.`,
        action: `وجّه حملات الـ Awareness والترافيك إلى ${cheapest.name} للاستفادة من انخفاض CPC`,
        metric: `CPC ${fmt(cheapest.cpc)} ر.س`,
      });
    }
  }

  // ---- 7. SNAPCHAT AD FATIGUE ----
  const snapCampaigns = aggregateCampaigns(data.snapchatCampaigns);
  const highFreqCampaigns = snapCampaigns.filter((c) => c.frequency > 5 && c.spend > 100);
  if (highFreqCampaigns.length > 0) {
    const worst = highFreqCampaigns.sort((a, b) => b.frequency - a.frequency)[0];
    recs.push({
      id: 'snap-ad-fatigue',
      priority: 'high',
      category: 'creative',
      platform: 'Snapchat',
      title: `Snapchat — تشبع إعلاني (Ad Fatigue) في ${worst.campaign.slice(0, 30)}`,
      description: `حملة "${worst.campaign.slice(0, 40)}" وصلت لتكرار ${fmt(worst.frequency)} مرة لنفس الشخص. هذا يرفع CPM، يخفض CTR، ويسبب burnout للجمهور.`,
      action: `جدّد الكريتيف فوراً، وسّع الجمهور، أو أوقف الحملة مؤقتاً`,
      metric: `Frequency ${fmt(worst.frequency)}x`,
    });
  }

  // ---- 8. WEAK ADS PER PLATFORM ----
  const adsByPlatform = {
    Snapchat: aggregateSnapchatAds(data.snapchatAds),
    Meta: aggregateMetaAds(data.metaAds),
    TikTok: aggregateTikTokAds(data.tiktokAds),
    Google: aggregateGoogleAds(data.googleAds),
  };

  for (const [pName, ads] of Object.entries(adsByPlatform)) {
    if (ads.length === 0) continue;
    const { weak, winners } = classifyAds(ads);
    const weakSpend = weak.reduce((s, a) => s + a.spend, 0);

    if (weak.length >= 3 && weakSpend > 200) {
      recs.push({
        id: `many-weak-ads-${pName}`,
        priority: 'high',
        category: 'creative',
        platform: pName,
        title: `${pName} — ${weak.length} إعلانات ضعيفة تستهلك ${fmt(weakSpend, 0)} ر.س`,
        description: `${weak.length} من إعلانات ${pName} تحقق ROAS < 3x وتستهلك ميزانية. إيقافها سيحسن كفاءة الإنفاق الإجمالية.`,
        action: `أوقف الإعلانات ذات ROAS < 2x على ${pName} ووجّه ميزانيتها للإعلانات الأفضل`,
        metric: `${weak.length} إعلانات ضعيفة — ${fmt(weakSpend, 0)} ر.س إنفاق مهدر`,
      });
    }

    if (winners.length > 0 && ads.length >= 3) {
      const topWinner = winners.sort((a, b) => b.roas - a.roas)[0];
      if (topWinner.roas > 5) {
        recs.push({
          id: `winner-ad-scale-${pName}`,
          priority: 'medium',
          category: 'scale',
          platform: pName,
          title: `${pName} — إعلان winner يستحق التوسع`,
          description: `إعلان "${topWinner.ad.slice(0, 40)}" يحقق ROAS ${fmt(topWinner.roas)}x. هذا النوع من الإعلانات نادر — ضاعف ميزانيته الآن قبل تشبع الجمهور.`,
          action: `ضاعف ميزانية هذا الإعلان تدريجياً وكرّره على شرائح جمهور مشابهة`,
          metric: `ROAS ${fmt(topWinner.roas)}x`,
        });
      }
    }
  }

  // ---- 9. SPEND CONCENTRATION ----
  const totalSpend = activePlatforms.reduce((s, p) => s + p.spend, 0);
  const dominant = activePlatforms.find((p) => p.spend / totalSpend > 0.7);
  if (dominant && dominant.roas < 3 && activePlatforms.length > 1) {
    recs.push({
      id: 'spend-concentration',
      priority: 'medium',
      category: 'budget',
      platform: dominant.name,
      title: `تركّز الميزانية على ${dominant.name} مع ROAS متوسط`,
      description: `${fmt((dominant.spend / totalSpend) * 100, 0)}% من إجمالي الإنفاق يذهب لـ ${dominant.name} الذي يحقق ROAS ${fmt(dominant.roas)}x فقط. التنويع يقلل المخاطرة ويحسن العوائد.`,
      action: `وزّع 20–30% من ميزانية ${dominant.name} على منصة ذات ROAS أعلى`,
      metric: `${fmt((dominant.spend / totalSpend) * 100, 0)}% من الإنفاق الإجمالي`,
    });
  }

  // ---- 10. SNAPCHAT PIXEL / META ZERO CONVERSIONS ----
  const meta = activePlatforms.find((p) => p.name === 'Meta');
  if (meta && meta.spend > 200 && meta.conversions === 0) {
    recs.push({
      id: 'meta-zero-conversions',
      priority: 'high',
      category: 'alert',
      platform: 'Meta',
      title: 'Meta — صفر تحويلات مع إنفاق مرتفع',
      description: `Meta تنفق ${fmt(meta.spend, 0)} ر.س بدون أي تحويل مسجّل. غالباً المشكلة في إعداد Meta Pixel أو أن الكمبيين غير محسوب للـ Conversion.`,
      action: `تحقق من Meta Pixel، تأكد من إعداد حدث الشراء (Purchase Event) بشكل صحيح`,
      metric: `صفر مبيعات — إنفاق ${fmt(meta.spend, 0)} ر.س`,
    });
  }

  // ---- SORT: high first, then medium, then low ----
  const order: Record<RecPriority, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}
