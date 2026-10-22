import React, { useState } from 'react';
import type { PayeeQuestion } from '../types';
import { HelpCircle, User, Home, Briefcase, ArrowLeftRight, ShoppingBag, Sparkles, Check, Loader2 } from 'lucide-react';
import { answerQuestion, dismissQuestion, requestPayeeAiSuggestion } from '../api/client';
import { useStatement } from '@/context/StatementContext';

interface PayeeQuestionsBannerProps {
  questions: PayeeQuestion[];
  onAnswered: () => void;
}

export const PayeeQuestionsBanner: React.FC<PayeeQuestionsBannerProps> = ({ questions, onAnswered }) => {
  const { isReadOnly, health } = useStatement();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState<boolean>(false);

  if (questions.length === 0 || isReadOnly) return null;

  const currentQ = questions[0];

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

  const handleRequestAiSuggestion = async () => {
    setIsAiSuggesting(true);
    try {
      await requestPayeeAiSuggestion(currentQ.id);
      onAnswered();
    } catch (e) {
      console.error('Failed to request Gemma suggestion:', e);
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const getOptionIcon = (id: string) => {
    switch (id) {
      case 'friend_family':
        return <User className="w-3.5 h-3.5 text-[#365844]" />;
      case 'rent_household':
        return <Home className="w-3.5 h-3.5 text-[#C85A32]" />;
      case 'work_business':
        return <Briefcase className="w-3.5 h-3.5 text-[#606860]" />;
      case 'self_transfer':
        return <ArrowLeftRight className="w-3.5 h-3.5 text-[#546A7B]" />;
      case 'services_groceries':
        return <ShoppingBag className="w-3.5 h-3.5 text-[#365844]" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-[#8A928A]" />;
    }
  };

  const hasGemmaSuggestion = Boolean(currentQ.suggested_category && currentQ.suggested_by === 'ollama_gemma');

  return (
    <div className="paper-card p-5 border-l-4 border-l-[#E8C95D] transition-all space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-mono text-[#8A928A] font-semibold">
              Notebook Note • {questions.length} question{questions.length > 1 ? 's' : ''} left
            </span>
            <span className="notebook-annotation text-sm select-none">
              ~ teach usually once, remembered forever
            </span>
          </div>
          <h3 className="font-serif text-lg text-[#292D29] font-medium leading-snug">
            {currentQ.prompt}
          </h3>
        </div>

        <div className="flex items-center gap-2 self-start">
          {!hasGemmaSuggestion && health?.ollama_available && (
            <button
              onClick={handleRequestAiSuggestion}
              disabled={isAiSuggesting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EEEBDD] hover:bg-[#E2DECE] border border-[#DFD9CA] text-xs font-medium text-[#365844] transition-all cursor-pointer btn-tactile disabled:opacity-50"
              title="Request category suggestion from local Gemma 2B"
            >
              {isAiSuggesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isAiSuggesting ? 'Consulting Gemma...' : 'Ask Gemma'}</span>
            </button>
          )}

          <button
            onClick={handleDismiss}
            disabled={submittingId === currentQ.id}
            className="text-xs text-[#8A928A] hover:text-[#292D29] px-2 py-1 rounded transition-colors cursor-pointer"
            title="Skip question for now"
          >
            Skip for now
          </button>
        </div>
      </div>

      {/* Prominent Gemma Suggestion Review Interface */}
      {hasGemmaSuggestion && (
        <div className="p-3.5 rounded-xl bg-[#F4F1E6] border border-[#DFD9CA] space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#365844] font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#365844]" />
              <span>Gemma suggestion · review before saving</span>
            </span>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#606860] border border-[#DFD9CA]"
              title="Uncalibrated model heuristic. Always review before confirming."
            >
              Model estimate · Review required
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-[#292D29]">
                Suggested: <span className="font-semibold text-[#365844]">{currentQ.suggested_category}</span>
              </div>
              {currentQ.ai_reason && (
                <p className="text-xs text-[#606860] italic">
                  &ldquo;{currentQ.ai_reason}&rdquo;
                </p>
              )}
            </div>

            <button
              onClick={() => handleSelectOption('ai_suggestion')}
              disabled={submittingId === currentQ.id}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#365844] hover:bg-[#2c4737] text-white text-xs font-medium shadow-sm transition-all btn-tactile cursor-pointer shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept Suggestion</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Choice Options Strip */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#8A928A]">
          <span>{hasGemmaSuggestion ? 'Or choose another category:' : 'Select category:'}</span>
          {!health?.ollama_available && (
            <span className="text-[10px]">Local Gemma offline • Manual review</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentQ.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleSelectOption(opt.id)}
              disabled={submittingId === currentQ.id}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EEEBDD] hover:bg-[#E2DECE] border border-[#DFD9CA] text-xs font-medium text-[#292D29] transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
            >
              {getOptionIcon(opt.id)}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
