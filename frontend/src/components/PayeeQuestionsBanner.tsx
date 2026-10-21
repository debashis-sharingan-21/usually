import React, { useState } from 'react';
import type { PayeeQuestion } from '../types';
import { HelpCircle, User, Home, Briefcase, ArrowLeftRight, ShoppingBag } from 'lucide-react';
import { answerQuestion, dismissQuestion } from '../api/client';
import { useStatement } from '@/context/StatementContext';

interface PayeeQuestionsBannerProps {
  questions: PayeeQuestion[];
  onAnswered: () => void;
}

export const PayeeQuestionsBanner: React.FC<PayeeQuestionsBannerProps> = ({ questions, onAnswered }) => {
  const { isReadOnly } = useStatement();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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

  return (
    <div className="paper-card p-5 border-l-4 border-l-[#E8C95D] transition-all">
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

        <button
          onClick={handleDismiss}
          disabled={submittingId === currentQ.id}
          className="text-xs text-[#8A928A] hover:text-[#292D29] px-2 py-1 rounded transition-colors cursor-pointer self-start"
          title="Skip question for now"
        >
          Skip for now
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3">
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
  );
};
