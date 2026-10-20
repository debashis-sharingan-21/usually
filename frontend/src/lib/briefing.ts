import type { HabitObservation, SpendingSummaryResponse } from '../types';

export const RECENT_ACTIVITY_WINDOW_DAYS = 30;

export interface QuietStateInfo {
  reason: 'insufficient_history' | 'no_new' | 'no_patterns' | 'outdated_coverage' | 'calm';
  title: string;
  message: string;
}

export interface SelectedBriefing {
  greeting: string;
  subGreeting: string;
  statementPeriodNote: string;
  isHistorical: boolean;
  mainTakeaway: string;
  featuredObservation: HabitObservation | null;
  secondaryObservations: HabitObservation[];
  hasInsights: boolean;
  quietState?: QuietStateInfo;
}

export function selectBriefingAndNotifications(
  observations: HabitObservation[],
  summary: SpendingSummaryResponse | null
): SelectedBriefing {
  // 1. Accurately identify statement period and historical nature
  let statementPeriodNote = 'No statements imported yet';
  let isHistorical = false;
  let maxDateObj: Date | null = null;
  let maxMonth = '';

  if (summary?.date_range?.min && summary?.date_range?.max) {
    const minD = summary.date_range.min;
    const maxD = summary.date_range.max;
    const minDateObj = new Date(minD);
    maxDateObj = new Date(maxD);
    
    const minMonth = minDateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    maxMonth = maxDateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    // Check if statement ends more than 30 days in the past (Rolling 30-day Recent-Activity Policy)
    const diffDays = (Date.now() - maxDateObj.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > RECENT_ACTIVITY_WINDOW_DAYS) {
      isHistorical = true;
    }

    statementPeriodNote = minMonth === maxMonth 
      ? `Statement period: ${maxMonth}`
      : `Statement period: ${minMonth} – ${maxMonth}`;
  }

  // 2. Filter eligible observations using the 30-day Recent-Activity Policy
  const eligible = observations.filter((obs) => {
    // Suppress muted feedback
    if (obs.status === 'muted') return false;
    // Suppress unverified or sparse evidence
    if (obs.min_evidence_met === false || obs.confidence < 0.5) return false;

    // Enforce 30-day eligibility relative to the statement end date
    if (maxDateObj && obs.last_observed_date) {
      const obsDate = new Date(obs.last_observed_date);
      const daysDiff = (maxDateObj.getTime() - obsDate.getTime()) / (1000 * 60 * 60 * 24);
      // If evidence is older than 30 days before statement end, suppress from fresh discovery feed
      if (daysDiff > RECENT_ACTIVITY_WINDOW_DAYS) {
        return false;
      }
    }

    // Suppress dormant habits from masquerading as fresh discoveries
    if (obs.freshness_status === 'dormant') {
      return false;
    }

    return true;
  });

  // 3. Sort by priority: confirmed first, then freshness ('fresh' > 'quiet_recent'), then confidence
  const sorted = [...eligible].sort((a, b) => {
    if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
    if (b.status === 'confirmed' && a.status !== 'confirmed') return 1;
    if (a.freshness_status === 'fresh' && b.freshness_status !== 'fresh') return -1;
    if (b.freshness_status === 'fresh' && a.freshness_status !== 'fresh') return 1;
    return b.confidence - a.confidence;
  });

  // If the statement itself ended more than 30 days ago, do not present stale history as today's event
  const featuredObservation = (!isHistorical && sorted.length > 0) ? sorted[0] : null;
  const secondaryObservations = (!isHistorical && sorted.length > 1) ? sorted.slice(1, 3) : [];

  // 4. Derive concise main takeaway based on actual data
  let mainTakeaway = 'Nothing unusual caught my eye today.';
  if (summary && summary.transaction_count > 0) {
    const pace = summary.current_month_pace;
    if (pace && pace.status === 'higher') {
      const topCat = summary.category_breakdown[0]?.category;
      mainTakeaway = topCat
        ? `Spending was higher than your historical baseline in ${pace.month}. ${topCat} is the largest category.`
        : `Spending was higher than your historical baseline in ${pace.month}.`;
    } else if (pace && pace.status === 'lower') {
      mainTakeaway = `Spending in ${pace.month} stayed below your typical baseline. A quiet month.`;
    } else if (featuredObservation) {
      mainTakeaway = featuredObservation.message;
    } else if (isHistorical) {
      mainTakeaway = `Archived statement covering up to ${maxMonth}. Review historical habits and benchmarks in Analysis.`;
    } else {
      mainTakeaway = 'Your spending pace has remained steady across your recorded statement period.';
    }
  }

  // 5. Contextual Quiet State categorization
  let quietState: QuietStateInfo | undefined = undefined;
  if (!featuredObservation) {
    if (!summary || summary.transaction_count < 10) {
      quietState = {
        reason: 'insufficient_history',
        title: 'Building your financial memory',
        message: 'Usually requires at least 10 recorded transactions to observe recurring cadences and meaningful patterns. Import another statement to build history.'
      };
    } else if (observations.length > 0 && observations.every(o => o.status === 'muted' || o.status === 'confirmed')) {
      quietState = {
        reason: 'no_new',
        title: "You're completely up to date",
        message: 'All habit observations identified in this statement period have been reviewed and acknowledged. Usually is keeping track in the background.'
      };
    } else if (isHistorical) {
      quietState = {
        reason: 'outdated_coverage',
        title: 'Recent coverage unavailable',
        message: `This statement record concludes on ${maxMonth}. New homepage discoveries require recent activity within the last 30 days. Full historical patterns are accessible on the Analysis page.`
      };
    } else {
      quietState = {
        reason: 'no_patterns',
        title: 'Nothing unusual caught my eye',
        message: 'Your spending pace and recurring transactions are balanced and consistent across your statement history.'
      };
    }
  }

  // 6. Plain-English Greeting & SubGreeting
  const greeting = isHistorical 
    ? "Archived statement briefing."
    : "Here's what stood out in your money.";
    
  const subGreeting = summary && summary.transaction_count > 0
    ? `Analyzed across ${summary.transaction_count} verified entries`
    : "Awaiting statement import";

  return {
    greeting,
    subGreeting,
    statementPeriodNote,
    isHistorical,
    mainTakeaway,
    featuredObservation,
    secondaryObservations,
    hasInsights: featuredObservation !== null || (summary !== null && summary.transaction_count > 0),
    quietState
  };
}
