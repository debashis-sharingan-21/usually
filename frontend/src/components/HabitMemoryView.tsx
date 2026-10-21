import React from 'react';
import type { HabitObservation } from '../types';
import { Brain, Clock, Calendar, Check, VolumeX, Sparkles } from 'lucide-react';
import { sendHabitFeedback } from '../api/client';
import { SlothMascot } from './SlothMascot';
import { useStatement } from '@/context/StatementContext';
import { isPublicDemoUI } from '@/lib/demo';

interface HabitMemoryViewProps {
  habits: HabitObservation[];
  onRefresh: () => void;
}

export const HabitMemoryView: React.FC<HabitMemoryViewProps> = ({ habits, onRefresh }) => {
  const { health } = useStatement();
  const isPublicDemo = isPublicDemoUI(health?.is_demo_mode, health?.deployment_mode);

  const handleFeedback = async (key: string, status: 'confirmed' | 'muted' | 'active') => {
    if (isPublicDemo) return;
    try {
      await sendHabitFeedback(key, status);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  if (habits.length === 0) {
    return (
      <div className="p-10 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-2xl bg-[#EEEBDD] border border-[#DFD9CA]">
            <SlothMascot mood="contemplating" size={56} />
          </div>
        </div>
        <span className="font-mono text-xs uppercase tracking-widest text-[#365844]">02 / Habit Memory</span>
        <h3 className="font-serif text-2xl font-normal text-[#292D29] mt-2 mb-2 tracking-tight">
          No longitudinal patterns formed yet
        </h3>
        <p className="text-sm text-[#606860] max-w-md mx-auto leading-relaxed">
          Usually records memory slowly and carefully. As you import additional months of statements,
          enduring routines and recurring cadences will be catalogued here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#DFD9CA] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-[#365844] font-medium">
              02 / Longitudinal Memory
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
              {habits.length} recorded
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#292D29] tracking-tight mt-1">
            Enduring habits across your statement archive.
          </h2>
        </div>
        <p className="text-xs text-[#8A928A] max-w-xs sm:text-right font-sans">
          Permanent behavioural patterns synthesized across all imported statements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {habits.map((h) => {
          const isConfirmed = h.status === 'confirmed';
          const isMuted = h.status === 'muted';

          return (
            <div
              key={h.habit_key}
              className={`p-6 rounded-2xl border transition-all ${
                isMuted
                  ? 'bg-[#FCFBF7]/60 border-[#DFD9CA] opacity-65'
                  : isConfirmed
                  ? 'bg-[#FCFBF7] border-[#365844]/40 shadow-sm'
                  : 'bg-[#FCFBF7] border-[#DFD9CA] hover:border-[#BFB9AA] shadow-[0_2px_12px_rgba(41,45,41,0.03)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#365844] bg-[#EEEBDD] px-2 py-0.5 rounded border border-[#DFD9CA]">
                      {h.habit_type.replace(/_/g, ' ')}
                    </span>
                    {isConfirmed && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#365844]/10 text-[#365844] border border-[#365844]/20">
                        Confirmed Habit
                      </span>
                    )}
                    {isMuted && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#EEEBDD] text-[#8A928A] border border-[#DFD9CA]">
                        Muted
                      </span>
                    )}
                  </div>
                  <h4 className="font-serif text-lg font-normal text-[#292D29] mt-2">
                    {h.title}
                  </h4>
                </div>

                <div className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
                  {Math.round(h.confidence * 100)}%
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[#404540] leading-relaxed mb-4 font-sans">
                {h.message}
              </p>

              <div className="pt-3 border-t border-[#EEEBDD] flex items-center justify-between text-[11px] text-[#606860]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#365844]" />
                    <span>{h.observation_window}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#8A928A]" />
                    <span>Last: {h.last_observed_date || 'N/A'}</span>
                  </span>
                </div>

                {!isPublicDemo ? (
                  <div className="flex items-center gap-2 font-medium">
                    {isMuted ? (
                      <button
                        onClick={() => handleFeedback(h.habit_key, 'active')}
                        className="text-[#365844] hover:underline cursor-pointer"
                      >
                        Unmute
                      </button>
                    ) : (
                      <>
                        {!isConfirmed && (
                          <button
                            onClick={() => handleFeedback(h.habit_key, 'confirmed')}
                            className="flex items-center gap-1 text-[#292D29] hover:text-[#365844] cursor-pointer"
                          >
                            <Check className="w-3 h-3 text-[#365844]" />
                            <span>Confirm</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleFeedback(h.habit_key, 'muted')}
                          className="flex items-center gap-1 text-[#8A928A] hover:text-[#C85A32] cursor-pointer"
                        >
                          <VolumeX className="w-3 h-3" />
                          <span>Mute</span>
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-[#8A928A]">
                    Synthetic Observation
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
