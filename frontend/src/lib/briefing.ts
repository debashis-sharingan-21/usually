import type { HabitObservation, SpendingSummaryResponse } from '../types';

export interface SelectedBriefing {
  greeting: string;
  statementPeriodNote: string;
  mainTakeaway: string;
  featuredObservation: HabitObservation | null;
  secondaryObservations: HabitObservation[];
  hasInsights: boolean;
}

export function selectBriefingAndNotifications(
  observations: HabitObservation[],
  summary: SpendingSummaryResponse | null
): SelectedBriefing {
  // 1. Accurately identify statement period
  let statementPeriodNote = 'No statements imported yet';
  if (summary?.date_range?.min && summary?.date_range?.max) {
    const minD = summary.date_range.min;
    const maxD = summary.date_range.max;
    // Format YYYY-MM
    const minMonth = new Date(minD).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const maxMonth = new Date(maxD).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    statementPeriodNote = minMonth === maxMonth 
      ? `Statement period: ${maxMonth}`
      : `Statement period: ${minMonth} – ${maxMonth}`;
  }

  // 2. Filter out muted or non-evidence observations
  const eligible = observations.filter(
    (obs) => obs.status !== 'muted' && obs.min_evidence_met !== false && obs.confidence >= 0.5
  );

  // 3. Sort by priority: confirmed first, then freshness ('fresh' > 'quiet_recent'), then confidence
  const sorted = [...eligible].sort((a, b) => {
    if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
    if (b.status === 'confirmed' && a.status !== 'confirmed') return 1;
    if (a.freshness_status === 'fresh' && b.freshness_status !== 'fresh') return -1;
    if (b.freshness_status === 'fresh' && a.freshness_status !== 'fresh') return 1;
    return b.confidence - a.confidence;
  });

  const featuredObservation = sorted.length > 0 ? sorted[0] : null;
  const secondaryObservations = sorted.slice(1, 3); // at most 1 or 2

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
    } else {
      mainTakeaway = 'Your spending pace has remained steady across your recorded statement period.';
    }
  }

  // 5. Greeting
  const greeting = 'Here is what Usually noticed.';

  return {
    greeting,
    statementPeriodNote,
    mainTakeaway,
    featuredObservation,
    secondaryObservations,
    hasInsights: featuredObservation !== null || (summary !== null && summary.transaction_count > 0)
  };
}
