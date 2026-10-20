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
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Expenses */}
        <div className="p-4 rounded-2xl bg-[#12141d] border border-[#242938]">
          <div className="flex items-center justify-between text-xs text-[#8e96ac] mb-1">
            <span>Expenses</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono">
            ₹{summary.total_expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-[#8e96ac] mt-1">
            Excludes transfers & CC bills
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="p-4 rounded-2xl bg-[#12141d] border border-[#242938]">
          <div className="flex items-center justify-between text-xs text-[#8e96ac] mb-1">
            <span>Net Cash Flow</span>
            <div className={`w-2 h-2 rounded-full ${summary.net_cash_flow >= 0 ? 'bg-lime-400' : 'bg-rose-400'}`} />
          </div>
          <div className={`text-xl font-extrabold font-mono ${summary.net_cash_flow >= 0 ? 'text-lime-300' : 'text-rose-300'}`}>
            ₹{summary.net_cash_flow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-[#8e96ac] mt-1">
            Income minus net expenses
          </div>
        </div>

        {/* Total Income */}
        <div className="p-4 rounded-2xl bg-[#12141d] border border-[#242938]">
          <div className="flex items-center justify-between text-xs text-[#8e96ac] mb-1">
            <span>Income & Credits</span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-lime-400" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono">
            ₹{summary.total_income.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-[#8e96ac] mt-1">
            Salaries & deposits
          </div>
        </div>

        {/* Total Refunds */}
        <div className="p-4 rounded-2xl bg-[#12141d] border border-[#242938]">
          <div className="flex items-center justify-between text-xs text-[#8e96ac] mb-1">
            <span>Refunds Credited</span>
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-extrabold text-white font-mono">
            ₹{summary.total_refunds.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-[#8e96ac] mt-1">
            Offsetting expenses
          </div>
        </div>
      </div>

      {/* Spending Pace & Monthly Baseline Comparison */}
      {pace && (
        <div className="p-5 rounded-2xl bg-[#141824] border border-[#262c3f]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Current Month Spending Pace ({pace.month})
                  </h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    pace.status === 'higher'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : pace.status === 'lower'
                      ? 'bg-lime-400/20 text-lime-300 border border-lime-400/30'
                      : 'bg-zinc-700/30 text-zinc-300 border border-zinc-700'
                  }`}>
                    {pace.status === 'higher' ? 'Pacing Ahead' : pace.status === 'lower' ? 'Disciplined' : 'On Historical Track'}
                  </span>
                </div>
                <p className="text-xs text-[#8e96ac] mt-0.5">
                  Compared against cumulative spend up to Day {pace.as_of_day} in prior recorded months.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 font-mono text-right">
              <div>
                <div className="text-[11px] text-[#8e96ac]">Current Spend</div>
                <div className="text-base font-bold text-white">
                  ₹{pace.current_month_spend.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#8e96ac]">Baseline Benchmark</div>
                <div className="text-base font-bold text-zinc-400">
                  ₹{pace.historical_baseline_pace.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#8e96ac]">Pace Delta</div>
                <div className={`text-base font-bold flex items-center justify-end gap-0.5 ${
                  pace.diff_percentage > 0 ? 'text-amber-400' : 'text-lime-400'
                }`}>
                  {pace.diff_percentage > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{pace.diff_percentage > 0 ? `+${pace.diff_percentage}%` : `${pace.diff_percentage}%`}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Merchants and Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Merchants */}
        <div className="p-5 rounded-2xl bg-[#12141d] border border-[#242938]">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-4 h-4 text-lime-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Top Merchants by Spend</h3>
          </div>
          <div className="space-y-3">
            {summary.top_merchants.slice(0, 5).map((m, idx) => (
              <div key={m.merchant} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-[#8e96ac] w-4">{idx + 1}.</span>
                  <div>
                    <div className="font-medium text-white">{m.merchant}</div>
                    <div className="text-[10px] text-[#8e96ac]">{m.category} • {m.count} purchases</div>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-semibold text-white">₹{m.total_amount.toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-[#8e96ac]">avg ₹{m.avg_amount.toFixed(0)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="p-5 rounded-2xl bg-[#12141d] border border-[#242938]">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-lime-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Category Allocation</h3>
          </div>
          <div className="space-y-3">
            {summary.category_breakdown.slice(0, 5).map((c) => (
              <div key={c.category} className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-zinc-300">{c.category}</span>
                  <span className="font-mono text-white font-semibold">
                    ₹{c.total_amount.toLocaleString('en-IN')} <span className="text-[#8e96ac] font-normal">({c.percentage}%)</span>
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#1e2333] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-lime-500 to-lime-300 rounded-full"
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
