"use client";

import React, { useRef } from 'react';
import Link from 'next/link';
import { useStatement } from '@/context/StatementContext';
import { HabitMemoryView } from '@/components/HabitMemoryView';
import gsap from 'gsap';
import { useGsapContext } from '@/lib/motion';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Gauge,
  Store,
  PieChart,
  ArrowRight,
  Coins,
  Repeat,
  Info,
  Sparkles
} from 'lucide-react';

export default function AnalysisPage() {
  const { summary, habits, loadAll } = useStatement();
  const analysisRef = useRef<HTMLDivElement>(null);

  const hasData = Boolean(summary && summary.transaction_count > 0);

  useGsapContext(
    analysisRef,
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      // 1. Editorial header
      tl.from('.analysis-header', {
        opacity: 0,
        y: 6,
        duration: 0.28,
      });

      // 2. Section 01: Cash flow cards
      tl.from(
        '.analysis-cashflow-card',
        {
          opacity: 0,
          y: 8,
          duration: 0.28,
          stagger: 0.05,
        },
        '-=0.15'
      );

      // 3. Section 02: Pace benchmark (if present)
      if (summary?.current_month_pace) {
        tl.from(
          '.analysis-pace-card',
          {
            opacity: 0,
            y: 8,
            duration: 0.28,
          },
          '-=0.12'
        );
      }

      // 4. Section 03: Category and Counterparties
      tl.from(
        '.analysis-category-card',
        {
          opacity: 0,
          y: 8,
          duration: 0.28,
          stagger: 0.08,
        },
        '-=0.12'
      );
    },
    [hasData]
  );

  if (!summary || summary.transaction_count === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <h2 className="font-serif text-2xl font-normal text-[#292D29]">
          No analysis data available yet
        </h2>
        <p className="text-sm text-[#606860] max-w-md mx-auto">
          Import a bank or UPI statement from the top bar to unlock cash flow metrics, category breakdowns, and spending pace benchmarks.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#365844] text-white text-xs font-medium btn-tactile"
          >
            ← Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const pace = summary.current_month_pace;
  const grossInflow = summary.gross_credit_inflow ?? summary.total_income;
  const grossOutflow = summary.gross_debit_outflow ?? summary.total_expenses;
  const netBalanceDelta = summary.net_balance_change ?? (grossInflow - grossOutflow);
  const p2pIn = summary.total_p2p_incoming ?? 0;
  const transfersIn = summary.total_transfers_in ?? 0;
  const externalInflows = summary.external_inflows ?? (p2pIn + (summary.total_income || 0) + (summary.total_refunds || 0));
  const consumerSurplus = summary.consumer_margin ?? (externalInflows - summary.total_expenses);

  return (
    <div ref={analysisRef} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10 animate-fade-in">
      
      {/* Editorial Header */}
      <div className="analysis-header flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#DFD9CA] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-[#365844] font-medium">
              Financial Analysis & Pacing
            </span>
            {summary.date_range && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
                {summary.date_range.min} to {summary.date_range.max}
              </span>
            )}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#292D29] tracking-tight mt-1">
            Cash flow, pacing & longitudinal memory.
          </h1>
        </div>
        
        <p className="text-xs text-[#8A928A] font-sans sm:text-right max-w-xs">
          Rigorous double-entry accounting. Non-consumer credit card payoffs are segregated from living expenses.
        </p>
      </div>

      {/* SECTION 01: Complete Cash Flow Breakdown */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wider text-[#606860] font-semibold flex items-center gap-2">
            <span>01 / Cash Flow Reconciliation</span>
            <span className="notebook-annotation text-sm normal-case tracking-normal hidden sm:inline select-none">
              ~ where the money flowed
            </span>
          </h2>
          <span className="text-[11px] font-mono text-[#8A928A]">
            {summary.transaction_count} verified entries
          </span>
        </div>

        {/* Primary 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Consumer Expenses */}
          <div className="analysis-cashflow-card paper-sheet-interactive p-5 space-y-1">
            <div className="flex items-center justify-between text-xs text-[#606860] font-mono">
              <span>Living Expenses</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#C85A32]" />
            </div>
            <div className="text-2xl font-serif text-[#292D29]">
              ₹{summary.total_expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-[#8A928A] font-sans">
              Purchases, dining & utilities
            </div>
          </div>

          {/* Transfers & CC Settlements Out */}
          <div className="analysis-cashflow-card paper-sheet-interactive p-5 space-y-1">
            <div className="flex items-center justify-between text-xs text-[#606860] font-mono">
              <span>Transfers Out</span>
              <Repeat className="w-3.5 h-3.5 text-[#606860]" />
            </div>
            <div className="text-2xl font-serif text-[#606860]">
              ₹{summary.total_transfers.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-[#8A928A] font-sans">
              CC bill payoffs & self-transfers
            </div>
          </div>

          {/* Total Inflows */}
          <div className="analysis-cashflow-card paper-sheet-interactive p-5 space-y-1">
            <div className="flex items-center justify-between text-xs text-[#606860] font-mono">
              <span>Gross Inflow</span>
              <ArrowDownLeft className="w-3.5 h-3.5 text-[#365844]" />
            </div>
            <div className="text-2xl font-serif text-[#292D29]">
              ₹{grossInflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-[#8A928A] font-sans">
              {summary.total_income > 0 && p2pIn === 0
                ? `Income (₹${summary.total_income.toLocaleString('en-IN', { maximumFractionDigits: 0 })}) + refunds`
                : summary.total_income > 0
                ? `Income + peer inflows (₹${p2pIn.toLocaleString('en-IN', { maximumFractionDigits: 0 })})`
                : `Peer receipts (₹${p2pIn.toLocaleString('en-IN', { maximumFractionDigits: 0 })}) + transfers in`}
            </div>
          </div>

          {/* Gross Balance Change */}
          <div className="analysis-cashflow-card paper-sheet-interactive p-5 space-y-1">
            <div className="flex items-center justify-between text-xs text-[#606860] font-mono">
              <span>Account Delta</span>
              <Coins className="w-3.5 h-3.5 text-[#365844]" />
            </div>
            <div className={`text-2xl font-serif ${netBalanceDelta >= 0 ? 'text-[#365844]' : 'text-[#C85A32]'}`}>
              {netBalanceDelta >= 0 ? '+' : ''}₹{netBalanceDelta.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-[#8A928A] font-sans">
              Gross inflow minus gross outflow
            </div>
          </div>
        </div>

        {/* Detailed Accounting Reconciliation Note */}
        <div className="p-4 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] text-xs text-[#606860] space-y-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#292D29] font-medium">
            <Info className="w-3.5 h-3.5 text-[#365844]" />
            <span>Mathematical Reconciliation & Integrity</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px] font-sans">
            <div className="space-y-1">
              <div>
                <strong className="text-[#292D29]">Gross Account Balance Change:</strong>
              </div>
              <div className="font-mono text-[11px] text-[#292D29]">
                ₹{grossInflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (Gross Inflow) − ₹{grossOutflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (Gross Outflow) = <span className="font-semibold text-[#365844]">{netBalanceDelta >= 0 ? '+' : ''}₹{netBalanceDelta.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <p className="text-[11px] text-[#8A928A]">
                Outflows: Living expenses (₹{summary.total_expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}) + CC/Transfers (₹{summary.total_transfers.toLocaleString('en-IN', { maximumFractionDigits: 0 })}) + Peer outflows (₹{(summary.total_p2p_outgoing || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}).
              </p>
            </div>
            <div className="space-y-1">
              <div>
                <strong className="text-[#292D29]">Consumer Living Surplus:</strong>
              </div>
              <div className="font-mono text-[11px] text-[#292D29]">
                ₹{externalInflows.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (External Inflows) − ₹{summary.total_expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (Living Expenses) = <span className="font-semibold text-[#365844]">{consumerSurplus >= 0 ? '+' : ''}₹{consumerSurplus.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <p className="text-[11px] text-[#8A928A]">
                Excludes non-consumer internal account movements (₹{transfersIn.toLocaleString('en-IN', { maximumFractionDigits: 0 })} in, ₹{summary.total_transfers.toLocaleString('en-IN', { maximumFractionDigits: 0 })} out).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 02: Spending Pace Comparison */}
      {pace && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-wider text-[#606860] font-semibold flex items-center gap-2">
              <span>02 / Spending Pace Benchmark</span>
              <span className="notebook-annotation text-sm normal-case tracking-normal hidden sm:inline select-none">
                ~ tracking against your baseline
              </span>
            </h2>
          </div>

          <div className="analysis-pace-card paper-sheet-interactive p-5 sm:p-6 space-y-5">
            {/* Top row: Left description & Right 3-metric group */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left-hand descriptive region */}
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className="p-2.5 rounded-xl bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA] shrink-0 mt-0.5">
                  <Gauge className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-xl sm:text-2xl font-normal text-[#292D29] tracking-tight">
                      Latest Statement Pace ({pace.month})
                    </h3>
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 ${
                      pace.status === 'higher'
                        ? 'bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/30 font-medium'
                        : pace.status === 'lower'
                        ? 'bg-[#365844]/10 text-[#365844] border border-[#365844]/30 font-medium'
                        : 'bg-[#EEEBDD] text-[#606860] border border-[#DFD9CA]'
                    }`}>
                      {pace.status === 'higher' ? 'Pacing Ahead' : pace.status === 'lower' ? 'Disciplined' : 'On Track'}
                    </span>
                  </div>
                  <p className="text-xs text-[#606860] leading-relaxed font-sans max-w-xl">
                    Evaluates cumulative spend through Day {pace.as_of_day} compared to the average of prior statement months up to Day {pace.as_of_day}.
                  </p>
                </div>
              </div>

              {/* Right-hand dedicated metric region */}
              <div className="grid grid-cols-3 gap-3 sm:gap-5 border-t lg:border-t-0 lg:border-l border-[#EEEBDD] pt-4 lg:pt-0 lg:pl-6 shrink-0 lg:min-w-[340px]">
                {/* Month Spend */}
                <div className="text-right">
                  <div className="text-[11px] font-mono uppercase text-[#8A928A] tracking-wider whitespace-nowrap">
                    Month spend
                  </div>
                  <div className="text-lg sm:text-xl font-mono font-semibold text-[#292D29] tabular-nums whitespace-nowrap mt-0.5">
                    ₹{Number(pace.current_month_spend || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Baseline Avg */}
                <div className="text-right">
                  <div className="text-[11px] font-mono uppercase text-[#8A928A] tracking-wider whitespace-nowrap">
                    Baseline avg
                  </div>
                  <div className="text-lg sm:text-xl font-mono font-semibold text-[#606860] tabular-nums whitespace-nowrap mt-0.5">
                    ₹{Number(pace.historical_baseline_pace || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Variance */}
                <div className="text-right">
                  <div className="text-[11px] font-mono uppercase text-[#8A928A] tracking-wider whitespace-nowrap">
                    Variance
                  </div>
                  <div className={`text-lg sm:text-xl font-mono font-semibold tabular-nums whitespace-nowrap flex items-center justify-end gap-1 mt-0.5 ${
                    pace.diff_percentage > 0 ? 'text-[#C85A32]' : pace.diff_percentage < 0 ? 'text-[#365844]' : 'text-[#606860]'
                  }`}>
                    {pace.diff_percentage > 0 ? (
                      <TrendingUp className="w-4 h-4 shrink-0" />
                    ) : pace.diff_percentage < 0 ? (
                      <TrendingDown className="w-4 h-4 shrink-0" />
                    ) : null}
                    <span>{pace.diff_percentage > 0 ? `+${pace.diff_percentage}%` : `${pace.diff_percentage}%`}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Pace Comparison Sub-panel */}
            {(() => {
              const currentSpend = Number(pace.current_month_spend || 0);
              const baselinePace = Number(pace.historical_baseline_pace || 0);
              const maxVal = Math.max(currentSpend, baselinePace, 1);
              const currentPct = Math.min(100, Math.max(0, (currentSpend / maxVal) * 100));
              const baselinePct = Math.min(100, Math.max(0, (baselinePace / maxVal) * 100));
              const diffAmount = Math.abs(currentSpend - baselinePace);
              const isHigher = currentSpend > baselinePace;

              return (
                <div className="pt-4 border-t border-[#EEEBDD] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#606860] gap-1">
                    <span className="font-mono uppercase tracking-wider text-[10px] text-[#8A928A] font-medium">
                      Pace Trajectory (Through Day {pace.as_of_day})
                    </span>
                    <span className="font-sans font-medium text-[#292D29]">
                      {diffAmount === 0 || baselinePace === 0
                        ? 'Baseline matching'
                        : isHigher
                        ? `₹${diffAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} above historical baseline`
                        : `₹${diffAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} below historical baseline`}
                    </span>
                  </div>

                  <div className="space-y-2 bg-[#F7F5EE] p-3 rounded-xl border border-[#DFD9CA]/70">
                    {/* Current Month Pace Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-mono text-[#292D29] font-medium">Current pace</span>
                        <span className="font-mono font-semibold text-[#292D29] tabular-nums">
                          ₹{currentSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#EEEBDD] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isHigher ? 'bg-[#C85A32]' : 'bg-[#365844]'
                          }`}
                          style={{ width: `${currentPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Historical Baseline Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-mono text-[#606860]">Historical baseline</span>
                        <span className="font-mono text-[#606860] tabular-nums">
                          ₹{baselinePace.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#EEEBDD] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#8A928A] rounded-full transition-all duration-300"
                          style={{ width: `${baselinePct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {pace.explanation && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F4F1E6] border border-[#DFD9CA] text-xs animate-fade-in">
                      <Sparkles className="w-3.5 h-3.5 text-[#365844] shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#365844] font-medium">
                            {pace.generated_by === 'ollama_gemma' ? 'Gemma Pace Interpretation' : 'Pace Trajectory Note'}
                          </span>
                          {pace.generated_by === 'ollama_gemma' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[#365844]/10 text-[#365844] border border-[#365844]/20 font-medium">
                              Local Ollama
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#292D29] leading-relaxed">
                          {pace.explanation}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] font-sans text-[#8A928A] italic">
                    * Compares cumulative outflow through Day {pace.as_of_day} against equivalent historical checkpoints. Does not project final end-of-month spend.
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* SECTION 03: Category Breakdown & Merchant Rankings */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wider text-[#606860] font-semibold flex items-center gap-2">
            <span>03 / Category Allocation & Counterparties</span>
            <span className="notebook-annotation text-sm normal-case tracking-normal hidden sm:inline select-none">
              ~ where the rhythm settled
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Top Categories */}
          <div className="analysis-category-card paper-sheet-interactive p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEEBDD] pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#365844]" />
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-[#292D29]">
                  Category Allocation
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#8A928A]">Living spend share</span>
            </div>

            <div className="space-y-3.5">
              {summary.category_breakdown.slice(0, 6).map((c) => (
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

          {/* Top Counterparties */}
          <div className="analysis-category-card paper-sheet-interactive p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEEBDD] pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#365844]" />
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-[#292D29]">
                  Top Counterparties
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#8A928A]">By volume</span>
            </div>

            <div className="space-y-3.5">
              {summary.top_merchants.slice(0, 6).map((m, idx) => (
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
        </div>
      </section>

      {/* SECTION 04: Longitudinal Habit Memory */}
      <section className="space-y-4 pt-2">
        <HabitMemoryView habits={habits} onRefresh={loadAll} />
      </section>

      {/* SECTION 05: Direct Link to the Ledger */}
      <section className="pt-2">
        <Link
          href="/transactions"
          className="paper-sheet-interactive p-6 flex items-center justify-between group cursor-pointer block"
        >
          <div className="space-y-1">
            <div className="font-serif text-xl font-normal text-[#292D29] group-hover:text-[#365844] transition-colors flex items-center gap-2">
              <span>Inspect & Edit Verified Ledger Records</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
            </div>
            <p className="text-xs text-[#606860] font-sans">
              Search payees, filter flows, and manually adjust merchant labels and categories in the dedicated ledger.
            </p>
          </div>

          <span className="hidden sm:inline-block px-4 py-2 rounded-xl bg-[#365844] text-white text-xs font-medium shadow-2xs">
            Open Ledger →
          </span>
        </Link>
      </section>

    </div>
  );
}
