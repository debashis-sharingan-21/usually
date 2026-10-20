import React, { useState } from 'react';
import type { HabitObservation } from '../types';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  VolumeX,
  Calendar,
  Layers,
  TrendingUp,
  Sun,
  Cpu,
  BookmarkCheck
} from 'lucide-react';
import { sendHabitFeedback } from '../api/client';
import { SlothMascot } from './SlothMascot';

interface NotificationFeedProps {
  notifications: HabitObservation[];
  onRefresh: () => void;
}

export const NotificationFeed: React.FC<NotificationFeedProps> = ({ notifications, onRefresh }) => {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFeedback = async (habitKey: string, status: 'confirmed' | 'muted') => {
    setFeedbackLoading(habitKey);
    try {
      await sendHabitFeedback(habitKey, status);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setFeedbackLoading(null);
    }
  };

  const getHabitIcon = (type: string) => {
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

  if (notifications.length === 0) {
    return (
      <div className="p-10 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-2xl bg-[#EEEBDD] border border-[#DFD9CA]">
            <SlothMascot mood="sleeping" size={56} />
          </div>
        </div>
        <span className="font-mono text-xs uppercase tracking-widest text-[#365844]">01 / Observations</span>
        <h3 className="font-serif text-2xl font-normal text-[#292D29] mt-2 mb-2 tracking-tight">
          No habits detected yet — slow and steady
        </h3>
        <p className="text-sm text-[#606860] max-w-md mx-auto leading-relaxed">
          Usually adheres to strict minimum evidence rules. Import at least 2–3 months of statements
          or load the multi-month demo data to see verified habit observations wake up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Editorial Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#DFD9CA] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-[#365844] font-medium">
              01 / Observations
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
              {notifications.length} active
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#292D29] tracking-tight mt-1">
            Personal spending habits, verified by evidence.
          </h2>
        </div>
        <p className="text-xs text-[#8A928A] max-w-xs sm:text-right font-sans">
          No hallucinations. Every observation is computed from your local transaction ledger.
        </p>
      </div>

      {/* Observation Cards */}
      <div className="grid grid-cols-1 gap-5">
        {notifications.map((n, idx) => {
          const isExpanded = !!expandedKeys[n.habit_key];
          const isConfirmed = n.status === 'confirmed';

          return (
            <article
              key={n.habit_key}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isConfirmed
                  ? 'bg-[#FCFBF7] border-[#365844]/40 shadow-sm'
                  : 'bg-[#FCFBF7] border-[#DFD9CA] hover:border-[#BFB9AA] shadow-[0_2px_12px_rgba(41,45,41,0.03)]'
              }`}
            >
              {/* Card Header & Content */}
              <div className="p-6 sm:p-7">
                {/* Meta pills & index */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-[#8A928A] font-semibold">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="p-1 rounded-md bg-[#EEEBDD] border border-[#DFD9CA]">
                      {getHabitIcon(n.habit_type)}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#606860]">
                      {n.title}
                    </span>
                    {isConfirmed && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#365844]/10 text-[#365844] border border-[#365844]/20">
                        <BookmarkCheck className="w-3 h-3" /> Confirmed Habit
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    {/* Confidence pill */}
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA] font-mono font-medium">
                      {Math.round(n.confidence * 100)}% verified
                    </span>

                    {/* Window badge */}
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F7F5EE] text-[#606860] border border-[#DFD9CA] font-sans">
                      {n.observation_window}
                    </span>

                    {/* Engine badge */}
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F7F5EE] text-[#8A928A] border border-[#DFD9CA] text-[10px] font-mono">
                      <Cpu className="w-3 h-3 text-[#365844]" />
                      {n.generated_by === 'ollama_gemma' ? 'Gemma Local' : 'Deterministic'}
                    </span>
                  </div>
                </div>

                {/* Editorial Headline with pen highlight accent */}
                <h3 className="font-serif text-xl sm:text-2xl font-normal text-[#292D29] tracking-tight leading-snug">
                  &ldquo;<span className="highlight-pen">{n.headline}</span>&rdquo;
                </h3>

                {/* Conversational Observation Message */}
                <p className="text-sm sm:text-base text-[#404540] mt-3 leading-relaxed font-sans max-w-3xl">
                  {n.message}
                </p>
              </div>

              {/* Action and Evidence Drawer Toggle */}
              <div className="px-6 py-3.5 bg-[#EEEBDD]/50 border-t border-[#DFD9CA] flex flex-wrap items-center justify-between gap-3 text-xs">
                <button
                  onClick={() => toggleExpand(n.habit_key)}
                  className="flex items-center gap-1.5 text-[#606860] hover:text-[#292D29] font-medium transition-colors cursor-pointer"
                >
                  <span className="font-mono text-xs">
                    {isExpanded ? 'Hide ledger evidence' : 'Inspect ledger evidence'}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFeedback(n.habit_key, 'confirmed')}
                    disabled={feedbackLoading === n.habit_key || isConfirmed}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isConfirmed
                        ? 'bg-[#365844] text-white border border-[#365844]'
                        : 'text-[#292D29] bg-[#FCFBF7] hover:bg-[#EEEBDD] border border-[#DFD9CA]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 text-current" />
                    <span>{isConfirmed ? 'Verified Habit' : 'Confirm'}</span>
                  </button>

                  <button
                    onClick={() => handleFeedback(n.habit_key, 'muted')}
                    disabled={feedbackLoading === n.habit_key}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8A928A] hover:text-[#C85A32] bg-[#FCFBF7] hover:bg-[#C85A32]/10 border border-[#DFD9CA] hover:border-[#C85A32]/30 transition-all cursor-pointer"
                    title="Mute this topic from recurring"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Mute</span>
                  </button>
                </div>
              </div>

              {/* Expanded Evidence Drawer */}
              {isExpanded && (
                <div className="p-6 bg-[#F7F5EE] border-t border-[#DFD9CA] space-y-4 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between text-[#606860] border-b border-[#DFD9CA] pb-2">
                    <span className="font-medium text-[#292D29] font-serif text-sm">
                      Why did Usually surface this observation?
                    </span>
                    <span className="font-mono text-[11px] text-[#365844] font-semibold">
                      Rule verified: Minimum longitudinal evidence met
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-2">
                      <div className="text-[11px] text-[#8A928A] uppercase tracking-wider font-mono font-semibold">
                        Grounded Ledger Facts
                      </div>
                      <div className="space-y-1.5 font-mono text-[12px] text-[#292D29]">
                        {Object.entries(n.evidence).map(([k, val]) => (
                          <div key={k} className="flex justify-between border-b border-[#EEEBDD] pb-1">
                            <span className="text-[#606860]">{k.replace(/_/g, ' ')}:</span>
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

                    <div className="p-4 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] text-[#8A928A] uppercase tracking-wider font-mono font-semibold mb-1.5">
                          Local-First Verification
                        </div>
                        <p className="text-[#606860] text-[12px] leading-relaxed font-sans">
                          This observation was computed locally on your device from SQLite records.
                          No personal information, counterparty names, or account balances are transmitted to any cloud servers.
                        </p>
                      </div>
                      <div className="pt-3 text-[10px] text-[#8A928A] font-mono border-t border-[#EEEBDD] mt-3">
                        Pattern ID: {n.habit_key} • Last recorded: {n.last_observed_date || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
