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
  Cpu
} from 'lucide-react';
import { sendHabitFeedback } from '../api/client';

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
        return <Calendar className="w-4 h-4 text-lime-400" />;
      case 'multi_month_recurrent':
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'pace_shift':
        return <TrendingUp className="w-4 h-4 text-amber-400" />;
      case 'weekend_surge':
        return <Sun className="w-4 h-4 text-cyan-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-lime-400" />;
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-[#12141d] border border-[#242938] text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#161a26] text-[#8e96ac] flex items-center justify-center mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">No habits detected yet</h3>
        <p className="text-xs text-[#8e96ac] max-w-md mx-auto mt-1">
          Usually adheres to strict minimum evidence rules. Import at least 2-3 months of statements
          or click &quot;Try Demo Data&quot; in the top bar to see longitudinal habit memory in action.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>Habit Observations</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/20">
              {notifications.length} active
            </span>
          </h2>
          <p className="text-xs text-[#8e96ac]">
            Evidence-grounded observations generated from your longitudinal history.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {notifications.map((n) => {
          const isExpanded = !!expandedKeys[n.habit_key];
          const isConfirmed = n.status === 'confirmed';

          return (
            <div
              key={n.habit_key}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isConfirmed
                  ? 'bg-[#141824] border-lime-500/30 shadow-lg shadow-lime-950/10'
                  : 'bg-[#12141d] hover:bg-[#151822] border-[#242938] hover:border-[#333a4f]'
              }`}
            >
              {/* Card Header Strip */}
              <div className="p-5 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#1a1e2b] border border-[#2e3547]">
                      {getHabitIcon(n.habit_type)}
                    </div>
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      {n.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    {/* Confidence pill */}
                    <span className="px-2 py-0.5 rounded-full bg-[#1b2130] text-lime-300 border border-lime-400/20 font-mono font-medium">
                      {Math.round(n.confidence * 100)}% confidence
                    </span>

                    {/* Window badge */}
                    <span className="px-2 py-0.5 rounded-full bg-[#1a1e2b] text-[#8e96ac] border border-[#262c3d]">
                      {n.observation_window}
                    </span>

                    {/* Engine badge */}
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#161a26] text-[#8e96ac] border border-[#262c3d]">
                      <Cpu className="w-3 h-3 text-lime-400" />
                      {n.generated_by === 'ollama_gemma' ? 'Gemma' : 'Deterministic'}
                    </span>
                  </div>
                </div>

                {/* Editorial Headline */}
                <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                  &ldquo;{n.headline}&rdquo;
                </h3>

                {/* Conversational Observation Message */}
                <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
                  {n.message}
                </p>
              </div>

              {/* Action and Evidence Drawer Toggle */}
              <div className="px-5 py-3 bg-[#0d0f17]/50 border-t border-[#1e2333] flex items-center justify-between text-xs">
                <button
                  onClick={() => toggleExpand(n.habit_key)}
                  className="flex items-center gap-1 text-[#8e96ac] hover:text-white font-medium transition-colors cursor-pointer"
                >
                  <span>{isExpanded ? 'Hide Supporting Evidence' : 'Inspect Supporting Evidence'}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFeedback(n.habit_key, 'confirmed')}
                    disabled={feedbackLoading === n.habit_key || isConfirmed}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      isConfirmed
                        ? 'bg-lime-400/10 text-lime-400 border border-lime-400/30'
                        : 'text-zinc-400 hover:text-lime-300 bg-[#161a26] hover:bg-[#1d2334] border border-[#242938]'
                    }`}
                  >
                    <Check className="w-3 h-3 text-lime-400" />
                    <span>{isConfirmed ? 'Confirmed' : 'Confirm'}</span>
                  </button>

                  <button
                    onClick={() => handleFeedback(n.habit_key, 'muted')}
                    disabled={feedbackLoading === n.habit_key}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-zinc-400 hover:text-rose-400 bg-[#161a26] hover:bg-rose-500/10 border border-[#242938] hover:border-rose-500/30 transition-colors cursor-pointer"
                    title="Mute this topic from appearing"
                  >
                    <VolumeX className="w-3 h-3" />
                    <span>Mute</span>
                  </button>
                </div>
              </div>

              {/* Expanded Evidence Drawer */}
              {isExpanded && (
                <div className="p-5 bg-[#090b12] border-t border-[#1e2333] space-y-3 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between text-[#8e96ac] border-b border-[#1e2333] pb-2">
                    <span className="font-semibold text-white">Why did this observation appear?</span>
                    <span className="font-mono text-[11px] text-lime-400">
                      Rule status: Minimum evidence met
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#12141d] border border-[#242938] space-y-1.5">
                      <div className="text-[11px] text-[#8e96ac] uppercase tracking-wider font-semibold">
                        Grounded Evidence Facts
                      </div>
                      <div className="space-y-1 font-mono text-[12px] text-zinc-300">
                        {Object.entries(n.evidence).map(([k, val]) => (
                          <div key={k} className="flex justify-between border-b border-[#1e2333]/50 pb-0.5">
                            <span className="text-[#8e96ac]">{k.replace(/_/g, ' ')}:</span>
                            <span className="text-white font-medium">
                              {typeof val === 'boolean'
                                ? val ? 'true' : 'false'
                                : Array.isArray(val)
                                ? `${val.length} dates`
                                : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#12141d] border border-[#242938] flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] text-[#8e96ac] uppercase tracking-wider font-semibold mb-1">
                          Privacy & Local Verification
                        </div>
                        <p className="text-[#8e96ac] text-[11px] leading-relaxed">
                          This observation was computed locally from transaction dates and amounts stored in your local SQLite database.
                          No personal information, account numbers, or bank tokens leave your device.
                        </p>
                      </div>
                      <div className="pt-2 text-[10px] text-zinc-500 font-mono">
                        Pattern ID: {n.habit_key} • Last seen: {n.last_observed_date || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
