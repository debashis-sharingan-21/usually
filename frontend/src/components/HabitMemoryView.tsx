import React from 'react';
import type { HabitObservation } from '../types';
import { Brain, Clock, Calendar } from 'lucide-react';
import { sendHabitFeedback } from '../api/client';

interface HabitMemoryViewProps {
  habits: HabitObservation[];
  onRefresh: () => void;
}

export const HabitMemoryView: React.FC<HabitMemoryViewProps> = ({ habits, onRefresh }) => {
  const handleFeedback = async (key: string, status: 'confirmed' | 'muted' | 'active') => {
    try {
      await sendHabitFeedback(key, status);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-lime-400" />
            <span>Longitudinal Habit Memory</span>
          </h2>
          <p className="text-xs text-[#8e96ac]">
            Permanent habit patterns discovered across your statement history.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {habits.map((h) => {
          const isConfirmed = h.status === 'confirmed';
          const isMuted = h.status === 'muted';

          return (
            <div
              key={h.habit_key}
              className={`p-5 rounded-2xl border transition-all ${
                isMuted
                  ? 'bg-[#12141d]/50 border-[#242938] opacity-60'
                  : isConfirmed
                  ? 'bg-[#141824] border-lime-500/30 shadow-md shadow-lime-950/20'
                  : 'bg-[#12141d] border-[#242938]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-lime-400 font-mono">
                      {h.habit_type.replace(/_/g, ' ')}
                    </span>
                    {isConfirmed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-lime-400/10 text-lime-400 border border-lime-400/20">
                        Confirmed Habit
                      </span>
                    )}
                    {isMuted && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/30 text-zinc-400 border border-zinc-700">
                        Muted
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-white mt-1">{h.title}</h4>
                </div>

                <div className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-[#161a26] text-lime-300 border border-[#242938]">
                  {Math.round(h.confidence * 100)}%
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                {h.message}
              </p>

              <div className="pt-3 border-t border-[#1e2333] flex items-center justify-between text-[11px] text-[#8e96ac]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-lime-400" />
                    <span>{h.observation_window}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Last: {h.last_observed_date || 'N/A'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isMuted ? (
                    <button
                      onClick={() => handleFeedback(h.habit_key, 'active')}
                      className="text-lime-400 hover:underline cursor-pointer"
                    >
                      Unmute
                    </button>
                  ) : (
                    <>
                      {!isConfirmed && (
                        <button
                          onClick={() => handleFeedback(h.habit_key, 'confirmed')}
                          className="hover:text-lime-400 cursor-pointer"
                        >
                          Confirm
                        </button>
                      )}
                      <button
                        onClick={() => handleFeedback(h.habit_key, 'muted')}
                        className="hover:text-rose-400 cursor-pointer"
                      >
                        Mute
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
