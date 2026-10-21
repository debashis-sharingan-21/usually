"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useStatement } from '@/context/StatementContext';
import { selectBriefingAndNotifications } from '@/lib/briefing';
import { SlothMascot } from '@/components/SlothMascot';
import { PayeeQuestionsBanner } from '@/components/PayeeQuestionsBanner';
import { sendHabitFeedback } from '@/api/client';
import gsap from 'gsap';
import { useGsapContext } from '@/lib/motion';
import {
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Check,
  VolumeX,
  Calendar,
  Layers,
  TrendingUp,
  Sun,
  ShieldCheck,
  UploadCloud,
  ArrowUpRight,
  ArrowDownLeft,
  Coins
} from 'lucide-react';

export default function HomePage() {
  const {
    health,
    summary,
    notifications,
    questions,
    loading,
    loadErrors,
    loadAll,
    setIsImportOpen,
    handleLoadDemo,
    isDemoLoading
  } = useStatement();

  const [expandedEvidence, setExpandedEvidence] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const homeRef = useRef<HTMLDivElement>(null);

  const hasData = (health?.transaction_count || 0) > 0;
  const briefing = selectBriefingAndNotifications(notifications, summary);
  const featured = briefing.featuredObservation;

  // Restrained GSAP entrance sequence for the homepage
  useGsapContext(
    homeRef,
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      if (hasData) {
        // 1. Briefing header
        tl.from('.home-briefing-header', {
          opacity: 0,
          y: 6,
          duration: 0.28,
        });

        // 2. Primary featured observation
        tl.from(
          '.home-featured-card',
          {
            opacity: 0,
            y: 8,
            duration: 0.32,
          },
          '-=0.14'
        );

        // 3. Secondary observations (if any)
        tl.from(
          '.home-secondary-card',
          {
            opacity: 0,
            y: 6,
            duration: 0.24,
            stagger: 0.05,
          },
          '-=0.12'
        );

        // 4. Financial snapshot cards
        tl.from(
          '.home-metric-card',
          {
            opacity: 0,
            y: 6,
            duration: 0.26,
            stagger: 0.05,
          },
          '-=0.1'
        );

        // 5. Explore Detailed Analysis Link
        tl.from(
          '.home-analysis-link',
          {
            opacity: 0,
            y: 6,
            duration: 0.24,
          },
          '-=0.1'
        );
      } else {
        // Calm onboarding entrance
        tl.from('.home-onboarding-mascot', {
          opacity: 0,
          scale: 0.94,
          duration: 0.35,
        });
        tl.from(
          '.home-onboarding-text',
          {
            opacity: 0,
            y: 8,
            duration: 0.3,
          },
          '-=0.15'
        );
        tl.from(
          '.home-onboarding-actions',
          {
            opacity: 0,
            y: 6,
            duration: 0.25,
            stagger: 0.06,
          },
          '-=0.12'
        );
      }
    },
    [hasData, featured?.habit_key, briefing.secondaryObservations.length]
  );

  const handleFeedback = async (habitKey: string, status: 'confirmed' | 'muted') => {
    setFeedbackLoading(true);
    try {
      await sendHabitFeedback(habitKey, status);
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const getHabitIcon = (type?: string) => {
    switch (type) {
      case 'weekday_cadence':
        return <Calendar className="w-4 h-4 text-[#365844]" />;
      case 'multi_month_recurrent':
        return <Layers className="w-4 h-4 text-[#365844]" />;
      case 'pace_shift':
        return <TrendingUp className="w-4 h-4 text-[#985324]" />;
      case 'weekend_surge':
        return <Sun className="w-4 h-4 text-[#985324]" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#365844]" />;
    }
  };

  return (
    <div ref={homeRef} className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-7 animate-fade-in">
      
      {/* Pending Payee Clarification Banner */}
      {questions.length > 0 && (
        <PayeeQuestionsBanner questions={questions} onAnswered={loadAll} />
      )}

      {/* Honest Diagnosable Error Banner if Auxiliary Request Fails */}
      {loadErrors.notifications && (
        <div className="p-3 bg-[#FCFBF7] border border-[#C85A32]/40 rounded-xl text-xs text-[#C85A32] flex items-center justify-between font-mono animate-fade-in">
          <span>Notice: Could not load notifications ({loadErrors.notifications}). Core accounting data remains active.</span>
          <button onClick={loadAll} className="underline hover:text-[#292D29] font-medium ml-3 cursor-pointer">Retry</button>
        </div>
      )}

      {!hasData && !loading ? (
        /* Empty / Onboarding State */
        <div className="py-12 sm:py-16 text-center space-y-8">
          <div className="home-onboarding-mascot flex justify-center">
            <div className="p-4 rounded-3xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
              <SlothMascot mood="peaceful" size={96} />
            </div>
          </div>

          <div className="home-onboarding-text space-y-3.5 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEEBDD] border border-[#DFD9CA] text-[11px] font-mono text-[#365844]">
              <span>Hacktoberfest 2026</span>
              <span>•</span>
              <span>Themed &ldquo;Slow and Steady&rdquo;</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl font-normal text-[#292D29] tracking-tight leading-tight">
              Your money has <span className="highlight-pen">habits</span>.
            </h1>

            <p className="text-sm sm:text-base text-[#606860] leading-relaxed font-sans">
              Usually is not a generic expense tracker or an annoying budget bot.
              It learns recurring cadences locally on your machine and delivers short,
              grounded observations at your own pace.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="home-onboarding-actions flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleLoadDemo}
              disabled={isDemoLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs tracking-wide shadow-sm transition-all btn-tactile cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#E8C95D]" />
              <span>Explore with 6-Month Demo Data</span>
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#FCFBF7] hover:bg-[#EEEBDD] border border-[#DFD9CA] text-[#292D29] font-medium text-xs tracking-wide transition-all btn-tactile cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-[#365844]" />
              <span>Import Bank / UPI Statement</span>
            </button>
          </div>

          {/* Core Architectural Guarantees */}
          <div className="home-onboarding-guarantees pt-6 max-w-lg mx-auto text-left">
            <div className="p-5 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-3 text-xs text-[#606860]">
              <div className="font-mono text-[11px] font-semibold uppercase text-[#365844]">
                Local-First Privacy Guarantees
              </div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#365844] shrink-0 mt-0.5" />
                  <span><strong>Zero cloud transmit:</strong> Raw CSVs, account numbers, and transactions stay on this machine.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#365844] shrink-0 mt-0.5" />
                  <span><strong>Deterministic math:</strong> No AI guesses amounts. Double-entry accounting verifies every sum.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Home Personal Briefing */
        <div className="space-y-6">
          
          {/* Section Greeting & Statement Period */}
          <div className="home-briefing-header flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#DFD9CA] pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-widest text-[#365844] font-medium">
                  Money Briefing
                </span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
                  {briefing.statementPeriodNote}
                </span>
                {briefing.isHistorical && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FCFBF7] text-[#8A928A] border border-[#DFD9CA]">
                    Historical Statement
                  </span>
                )}
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#292D29] tracking-tight mt-1.5">
                {briefing.greeting}
              </h1>
            </div>

            <p className="text-xs text-[#8A928A] font-sans">
              {summary ? `${summary.transaction_count} verified entries` : `${health?.transaction_count || 0} ledger records`}
            </p>
          </div>

          {/* Featured Observation Sheet */}
          {featured ? (
            <article className="home-featured-card paper-sheet p-6 sm:p-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#EEEBDD] border border-[#DFD9CA]">
                    {getHabitIcon(featured.habit_type)}
                  </div>
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#606860]">
                    {featured.title}
                  </span>
                  {featured.status === 'confirmed' && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#365844]/10 text-[#365844] border border-[#365844]/20">
                      Confirmed
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
                    {Math.round(featured.confidence * 100)}% verified
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F7F5EE] text-[#606860] border border-[#DFD9CA]">
                    {featured.observation_window}
                  </span>
                </div>
              </div>

              {/* Headline with Pen Highlight */}
              <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#292D29] tracking-tight leading-snug">
                &ldquo;<span className="highlight-pen">{featured.headline}</span>&rdquo;
              </h2>

              {/* Message */}
              <p className="text-sm sm:text-base text-[#404540] leading-relaxed font-sans max-w-2xl">
                {featured.message}
              </p>

              {/* Interaction Strip */}
              <div className="pt-3 border-t border-[#EEEBDD] flex flex-wrap items-center justify-between gap-3 text-xs">
                <button
                  onClick={() => setExpandedEvidence(!expandedEvidence)}
                  className="flex items-center gap-1.5 text-[#606860] hover:text-[#292D29] font-medium transition-colors cursor-pointer"
                >
                  <span className="font-mono text-xs">
                    {expandedEvidence ? 'Hide supporting evidence' : 'Inspect supporting evidence'}
                  </span>
                  {expandedEvidence ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFeedback(featured.habit_key, 'confirmed')}
                    disabled={feedbackLoading || featured.status === 'confirmed'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all btn-tactile cursor-pointer ${
                      featured.status === 'confirmed'
                        ? 'bg-[#365844] text-white border border-[#365844]'
                        : 'text-[#292D29] bg-[#FCFBF7] hover:bg-[#EEEBDD] border border-[#DFD9CA]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{featured.status === 'confirmed' ? 'Verified' : 'Confirm'}</span>
                  </button>

                  <button
                    onClick={() => handleFeedback(featured.habit_key, 'muted')}
                    disabled={feedbackLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8A928A] hover:text-[#C85A32] bg-[#FCFBF7] hover:bg-[#C85A32]/10 border border-[#DFD9CA] transition-all btn-tactile cursor-pointer"
                    title="Mute this topic"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Mute</span>
                  </button>
                </div>
              </div>

              {/* Expandable Supporting Evidence Drawer */}
              {expandedEvidence && (
                <div className="mt-4 p-5 bg-[#F7F5EE] border border-[#DFD9CA] rounded-xl space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between text-[#606860] border-b border-[#DFD9CA] pb-2 font-mono text-[11px]">
                    <span className="font-medium text-[#292D29]">Supporting Evidence Facts</span>
                    <span className="text-[#365844]">Local SQLite Verified</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[12px]">
                    {Object.entries(featured.evidence).map(([key, val]) => (
                      <div key={key} className="flex justify-between border-b border-[#EEEBDD] pb-1">
                        <span className="text-[#606860]">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-medium text-[#292D29]">
                          {typeof val === 'boolean'
                            ? val ? 'true' : 'false'
                            : Array.isArray(val)
                            ? `${val.length} dates recorded`
                            : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ) : (
            /* Differentiated Quiet States */
            <div className="home-featured-card paper-sheet p-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3.5 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
                  <SlothMascot mood="peaceful" size="lg" />
                </div>
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h2 className="font-serif text-2xl font-normal text-[#292D29]">
                  {briefing.quietState?.title || "Nothing unusual caught my eye."}
                </h2>
                <p className="text-sm text-[#606860] leading-relaxed">
                  {briefing.quietState?.message || "Your spending pace and recurring cadences are consistent with historical patterns. Usually is monitoring quietly in the background."}
                </p>
              </div>
            </div>
          )}

          {/* Secondary Observations (At most 1 or 2, compact) */}
          {briefing.secondaryObservations.length > 0 && (
            <div className="space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#8A928A]">
                Also Observed
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {briefing.secondaryObservations.map((obs) => (
                  <div
                    key={obs.habit_key}
                    className="home-secondary-card paper-sheet-interactive p-4 flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#8A928A] mb-1">
                        <span className="uppercase text-[#365844]">{obs.title}</span>
                        <span>{Math.round(obs.confidence * 100)}% verified</span>
                      </div>
                      <h3 className="font-serif text-base font-normal text-[#292D29]">
                        &ldquo;{obs.headline}&rdquo;
                      </h3>
                      <p className="text-xs text-[#606860] mt-1 line-clamp-2">
                        {obs.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compact Financial Summary (3 Reconciled Numbers) */}
          {summary && summary.transaction_count > 0 && (
            <div className="home-overview-container space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-[#606860]">
                  Statement Cash Flow Overview
                </span>
                <span className="font-mono text-[11px] text-[#8A928A]">
                  {summary.transaction_count} verified transactions
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Consumer Living Expenses */}
                <div className="home-metric-card paper-sheet-interactive p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#606860] font-mono">
                    <span>Living Expenses</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#C85A32]" />
                  </div>
                  <div className="text-2xl font-serif text-[#292D29]">
                    ₹{summary.total_expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[11px] text-[#8A928A] font-sans">
                    Purchases, dining & utilities (excludes CC payoffs)
                  </div>
                </div>

                {/* Incoming Credits */}
                <div className="home-metric-card paper-sheet-interactive p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#606860] font-mono">
                    <span>Incoming Credits</span>
                    <ArrowDownLeft className="w-3.5 h-3.5 text-[#365844]" />
                  </div>
                  <div className="text-2xl font-serif text-[#292D29]">
                    ₹{(summary.gross_credit_inflow ?? summary.total_income).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[11px] text-[#8A928A] font-sans">
                    {summary.total_income > 0 && (summary.total_p2p_incoming || 0) === 0
                      ? `Income (₹${summary.total_income.toLocaleString('en-IN', { maximumFractionDigits: 0 })}) + refunds`
                      : (summary.total_income || 0) > 0
                      ? `Income + peer inflows (₹${(summary.total_p2p_incoming || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })})`
                      : `Peer receipts (₹${(summary.total_p2p_incoming || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}) + transfers in`}
                  </div>
                </div>

                {/* Net Balance Delta */}
                <div className="home-metric-card paper-sheet-interactive p-5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#606860] font-mono">
                    <span>Net Balance Delta</span>
                    <Coins className="w-3.5 h-3.5 text-[#365844]" />
                  </div>
                  <div className={`text-2xl font-serif ${(summary.net_balance_change ?? (summary.gross_credit_inflow ?? 0) - (summary.gross_debit_outflow ?? 0)) >= 0 ? 'text-[#365844]' : 'text-[#C85A32]'}`}>
                    {(summary.net_balance_change ?? 0) >= 0 ? '+' : ''}₹{(summary.net_balance_change ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[11px] text-[#8A928A] font-sans">
                    Gross inflow minus all debit outflows
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clear Link to Full Analysis Destination */}
          <div className="home-analysis-link pt-2">
            <Link
              href="/analysis"
              className="paper-sheet-interactive p-5 flex items-center justify-between group cursor-pointer block"
            >
              <div className="space-y-0.5">
                <div className="font-serif text-lg font-normal text-[#292D29] group-hover:text-[#365844] transition-colors flex items-center gap-2">
                  <span>Explore Detailed Analysis & Pacing</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
                </div>
                <p className="text-xs text-[#606860] font-sans">
                  Inspect category allocations, historical spending benchmarks, and longitudinal memory.
                </p>
              </div>

              <span className="hidden sm:inline-block px-3 py-1.5 rounded-lg bg-[#EEEBDD] text-[#365844] text-xs font-mono font-medium">
                View Analysis →
              </span>
            </Link>
          </div>

        </div>
      )}
    </div>
  );
}
