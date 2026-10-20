import React from 'react';
import type { SpendingSummaryResponse } from '../types';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Shield, Gauge, Store, PieChart } from 'lucide-react';

interface SpendingSummaryProps {
  summary: SpendingSummaryResponse | null;
}

export const SpendingSummary: React.FC<SpendingSummaryProps> = ({ summary }) => {
  if (!summary || summary.transaction_count === 0) {
    return null;
  }

  const pace = summary.current_month_pace;

  return (
    <div className="space-y-6">
      {/* Editorial Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#DFD9CA] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-[#365844] font-medium">
              03 / Cash Flow & Pacing
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
              {summary.transaction_count} ledger entries
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#292D29] tracking-tight mt-1">
            Financial summary and pacing benchmark.
          </h2>
        </div>
        <p className="text-xs text-[#8A928A] max-w-xs sm:text-right font-sans">
          Accurate double-entry principles. Transfers and credit card settlements are not double-counted as consumer spend.
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <div className="p-5 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#606860] mb-2 font-mono uppercase tracking-wider">
            <span>Expenses</span>
            <div className="p-1 rounded bg-[#C85A32]/10 text-[#C85A32]">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-serif text-[#292D29]">
            ₹{summary.total_expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-[#8A928A] mt-1.5 font-sans">
            Excludes peer transfers & CC bills
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="p-5 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#606860] mb-2 font-mono uppercase tracking-wider">
            <span>Net Cash Flow</span>
            <div className={`w-2 h-2 rounded-full ${summary.net_cash_flow >= 0 ? 'bg-[#365844]' : 'bg-[#C85A32]'}`} />
          </div>
          <div className={`text-2xl font-serif ${summary.net_cash_flow >= 0 ? 'text-[#365844]' : 'text-[#C85A32]'}`}>
            ₹{summary.net_cash_flow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-[#8A928A] mt-1.5 font-sans">
            Verified income minus net spend
          </div>
        </div>

        {/* Total Income */}
        <div className="p-5 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#606860] mb-2 font-mono uppercase tracking-wider">
            <span>Income & Credits</span>
            <div className="p-1 rounded bg-[#365844]/10 text-[#365844]">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-serif text-[#292D29]">
            ₹{summary.total_income.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-[#8A928A] mt-1.5 font-sans">
            Salaries and confirmed deposits
          </div>
        </div>

        {/* Total Refunds */}
        <div className="p-5 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[#606860] mb-2 font-mono uppercase tracking-wider">
            <span>Refunds Credited</span>
            <div className="p-1 rounded bg-[#EEEBDD] text-[#365844]">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-serif text-[#292D29]">
            ₹{summary.total_refunds.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-[#8A928A] mt-1.5 font-sans">
            Offsetting return credits
          </div>
        </div>
      </div>

      {/* Spending Pace & Monthly Baseline Comparison */}
      {pace && (
        <div className="p-6 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA] mt-0.5">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-lg font-normal text-[#292D29]">
                    Current Month Pace ({pace.month})
                  </h3>
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    pace.status === 'higher'
                      ? 'bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/30'
                      : pace.status === 'lower'
                      ? 'bg-[#365844]/10 text-[#365844] border border-[#365844]/30'
                      : 'bg-[#EEEBDD] text-[#606860] border border-[#DFD9CA]'
                  }`}>
                    {pace.status === 'higher' ? 'Pacing Ahead' : pace.status === 'lower' ? 'Disciplined' : 'On Track'}
                  </span>
                </div>
                <p className="text-xs text-[#606860] mt-1 font-sans">
                  Measured against cumulative spend up to Day {pace.as_of_day} in prior recorded months.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 font-mono text-right border-t md:border-t-0 md:border-l border-[#EEEBDD] pt-3 md:pt-0 md:pl-6">
              <div>
                <div className="text-[11px] text-[#8A928A] uppercase tracking-wider">Current Spend</div>
                <div className="text-base font-semibold text-[#292D29]">
                  ₹{pace.current_month_spend.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#8A928A] uppercase tracking-wider">Benchmark</div>
                <div className="text-base font-semibold text-[#606860]">
                  ₹{pace.historical_baseline_pace.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#8A928A] uppercase tracking-wider">Variance</div>
                <div className={`text-base font-semibold flex items-center justify-end gap-0.5 ${
                  pace.diff_percentage > 0 ? 'text-[#C85A32]' : 'text-[#365844]'
                }`}>
                  {pace.diff_percentage > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{pace.diff_percentage > 0 ? `+${pace.diff_percentage}%` : `${pace.diff_percentage}%`}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Merchants and Category Allocation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top Merchants */}
        <div className="p-6 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-[#EEEBDD] pb-3">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#365844]" />
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-[#292D29]">
                Top Counterparties
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#8A928A]">By aggregate volume</span>
          </div>
          <div className="space-y-3.5">
            {summary.top_merchants.slice(0, 5).map((m, idx) => (
              <div key={m.merchant} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-[#8A928A] w-4">
                    {idx + 1}.
                  </span>
                  <div>
                    <div className="font-medium text-[#292D29] text-sm">{m.merchant}</div>
                    <div className="text-[11px] text-[#8A928A]">{m.category} • {m.count} payments</div>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-semibold text-[#292D29]">₹{m.total_amount.toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-[#8A928A]">avg ₹{m.avg_amount.toFixed(0)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="p-6 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-[#EEEBDD] pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#365844]" />
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-[#292D29]">
                Category Allocation
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#8A928A]">Relative share</span>
          </div>
          <div className="space-y-3.5">
            {summary.category_breakdown.slice(0, 5).map((c) => (
              <div key={c.category} className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[#292D29]">{c.category}</span>
                  <span className="font-mono text-[#292D29] font-medium">
                    ₹{c.total_amount.toLocaleString('en-IN')} <span className="text-[#8A928A] font-normal">({c.percentage}%)</span>
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#EEEBDD] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#365844] rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(c.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
