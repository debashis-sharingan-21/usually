import React, { useState } from 'react';
import type { PayeeQuestion } from '../types';
import { HelpCircle, Sparkles, User, Home, Briefcase, ArrowLeftRight, ShoppingBag } from 'lucide-react';
import { answerQuestion, dismissQuestion } from '../api/client';

interface PayeeQuestionsBannerProps {
  questions: PayeeQuestion[];
  onAnswered: () => void;
}

export const PayeeQuestionsBanner: React.FC<PayeeQuestionsBannerProps> = ({ questions, onAnswered }) => {
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (questions.length === 0) return null;

  const currentQ = questions[0]; // Present one at a time for near-zero effort

  const handleSelectOption = async (optionId: string) => {
    setSubmittingId(currentQ.id);
    try {
      await answerQuestion(currentQ.id, optionId);
      onAnswered();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDismiss = async () => {
    setSubmittingId(currentQ.id);
    try {
      await dismissQuestion(currentQ.id);
      onAnswered();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingId(null);
    }
  };

  const getOptionIcon = (id: string) => {
    switch (id) {
      case 'friend_family':
        return <User className="w-3.5 h-3.5 text-lime-400" />;
      case 'rent_household':
        return <Home className="w-3.5 h-3.5 text-amber-400" />;
      case 'work_business':
        return <Briefcase className="w-3.5 h-3.5 text-cyan-400" />;
      case 'self_transfer':
        return <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />;
      case 'services_groceries':
        return <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-[#141a24] to-[#121622] border border-lime-500/30 shadow-lg shadow-lime-950/20 space-y-3 animate-in fade-in duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-lime-400">
                One-Tap Clarification ({questions.length} pending)
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5">
              {currentQ.prompt}
            </h3>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          disabled={submittingId === currentQ.id}
          className="text-xs text-[#8e96ac] hover:text-zinc-300 px-2 py-1 rounded hover:bg-[#1a1e2b] transition-colors cursor-pointer"
          title="Skip question for now"
        >
          Skip
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {currentQ.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleSelectOption(opt.id)}
            disabled={submittingId === currentQ.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161a26] hover:bg-[#1f2536] border border-[#262c3f] hover:border-lime-400/40 text-xs font-medium text-white transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {getOptionIcon(opt.id)}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="text-[10px] text-[#8e96ac] flex items-center justify-between pt-1">
        <span>Usually remembers your choice and applies it across past and future imports.</span>
        <span className="font-mono text-zinc-500">Payee: {currentQ.payee_name}</span>
      </div>
    </div>
  );
};
