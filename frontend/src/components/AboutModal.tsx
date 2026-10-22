"use client";

import React, { useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers,
  Database,
  Lock
} from 'lucide-react';
import { SlothMascot } from './SlothMascot';

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard accessibility: Close on Escape key & trap focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus on close button
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/40 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#FCFBF7] border border-[#DFD9CA] rounded-2xl shadow-2xl overflow-hidden relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Notebook Left Spine Binding Accent */}
        <div
          className="absolute top-0 bottom-0 left-0 w-2 bg-[#8FA882] border-r border-[#768C69]/40 z-20 pointer-events-none select-none"
          aria-hidden="true"
        />

        {/* Modal Header */}
        <div className="relative pl-6 sm:pl-8 pr-4 sm:pr-6 py-4 sm:py-5 border-b border-[#DFD9CA] bg-[#FAF8F3] flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <SlothMascot mood="peaceful" size="sm" className="shrink-0 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#365844] font-semibold bg-[#365844]/10 px-2 py-0.5 rounded-full border border-[#365844]/20">
                  Product Guide &amp; Story
                </span>
                <span className="font-mono text-[10px] text-[#8A928A]">p. 00</span>
              </div>
              <h2
                id="about-modal-title"
                className="font-serif text-xl sm:text-2xl font-medium text-[#292D29] tracking-tight mt-0.5 leading-tight"
              >
                The Story Behind Usually
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8A928A] hover:text-[#292D29] hover:bg-[#EEEBDD] border border-transparent hover:border-[#DFD9CA] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
            aria-label="Close story panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto pl-6 sm:pl-8 pr-4 sm:pr-6 py-5 space-y-6 text-[#292D29]">
          
          {/* Section 1: The Idea */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#365844] font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>The Idea</span>
            </div>
            
            <div className="p-3.5 rounded-xl bg-[#F4F1E6] border border-[#DFD9CA] space-y-2">
              <p className="font-serif italic text-sm sm:text-base text-[#292D29] leading-relaxed">
                &ldquo;Automate the routine, ask about the ambiguous, remember the answer.&rdquo;
              </p>
              <span className="text-[11px] font-mono text-[#606860] block">
                — The Usually Core Philosophy
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#606860] leading-relaxed font-sans">
              Usually is an AI-assisted personal finance companion designed with a quiet, editorial notebook aesthetic. It observes recurring rhythms in your transaction ledger (such as dining surges, commute patterns, and weekend spending cadences) and turns them into concise, evidence-backed observations at your own pace.
            </p>
            <p className="text-xs sm:text-sm text-[#606860] leading-relaxed font-sans">
              Unlike generic budgeting apps that hound you with arbitrary spend limits, Usually takes a <strong>“Slow and Steady”</strong> approach—inspired by our peaceful sloth mascot. It gives you space to reflect on what your money usually does.
            </p>
          </section>

          <hr className="border-[#DFD9CA]/80" />

          {/* Section 2: How It Works */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#365844] font-semibold">
              <Layers className="w-3.5 h-3.5" />
              <span>How It Works (6-Step Workflow)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-1">
                <span className="font-mono text-[10px] text-[#365844] font-bold">01 · Import Statement</span>
                <p className="text-[#606860] leading-relaxed">
                  Import a bank or UPI statement as CSV or TSV (e.g. PhonePe, HDFC, SBI, ICICI exports).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-1">
                <span className="font-mono text-[10px] text-[#365844] font-bold">02 · Deterministic Logic</span>
                <p className="text-[#606860] leading-relaxed">
                  Normalize records and calculate balances and living expenses using pure mathematical rules.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-1">
                <span className="font-mono text-[10px] text-[#365844] font-bold">03 · Home Briefing</span>
                <p className="text-[#606860] leading-relaxed">
                  Review your executive financial briefing: concise habit headlines supported by verified ledger facts.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-1">
                <span className="font-mono text-[10px] text-[#365844] font-bold">04 · Financial Analysis</span>
                <p className="text-[#606860] leading-relaxed">
                  Explore category breakdowns, longitudinal spending habits, and checkpoint pacing benchmarks.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-1">
                <span className="font-mono text-[10px] text-[#365844] font-bold">05 · Verified Ledger</span>
                <p className="text-[#606860] leading-relaxed">
                  Inspect, search, and edit individual transactions with complete direction and amount auditability.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-1">
                <span className="font-mono text-[10px] text-[#365844] font-bold">06 · Review &amp; Remember</span>
                <p className="text-[#606860] leading-relaxed">
                  Review ambiguous merchant suggestions, accept or correct them, and remember classifications permanently.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-[#DFD9CA]/80" />

          {/* Section 3: AI, Without the Hype */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#365844] font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#365844]" />
              <span>AI, Without the Hype</span>
            </div>

            <p className="text-xs sm:text-sm text-[#606860] leading-relaxed font-sans">
              Local development integrates the open-weight <strong>Gemma 2B</strong> model via Ollama for selected assistive tasks—namely candidate merchant classification and natural-language spending pace interpretation.
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FAF8F3] border border-[#DFD9CA]">
                <CheckCircle2 className="w-4 h-4 text-[#365844] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#292D29]">Deterministic Accounting Invariants:</strong>
                  <span className="text-[#606860] ml-1">
                    Arithmetic, ledger totals, pacing math, and balances are always calculated deterministically. AI never computes numbers.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FAF8F3] border border-[#DFD9CA]">
                <CheckCircle2 className="w-4 h-4 text-[#365844] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#292D29]">Validated Output &amp; Motive Guardrails:</strong>
                  <span className="text-[#606860] ml-1">
                    AI texts are validated against extracted figures. Guardrails reject numerical hallucinations, polarity reversals, and invented motives (*&ldquo;spending spree&rdquo;*, *&ldquo;fun October&rdquo;*, *&ldquo;treating yourself&rdquo;*), falling back to deterministic wording.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FAF8F3] border border-[#DFD9CA]">
                <CheckCircle2 className="w-4 h-4 text-[#365844] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#292D29]">Merchant Suggestions Require Review:</strong>
                  <span className="text-[#606860] ml-1">
                    Suggestions are labeled as honest estimates (<span className="font-mono text-[10px] bg-[#EEEBDD] px-1 py-0.2 rounded border border-[#DFD9CA]">Model estimate · Review required</span>). Transactions are never auto-reclassified without confirmation.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FAF8F3] border border-[#DFD9CA]">
                <CheckCircle2 className="w-4 h-4 text-[#365844] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#292D29]">Persistent Memory (Zero Repeat Inference):</strong>
                  <span className="text-[#606860] ml-1">
                    Confirmed classifications are stored in your private database. Future statement imports reuse the learned rule deterministically without querying the model again.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FAF8F3] border border-[#DFD9CA]">
                <CheckCircle2 className="w-4 h-4 text-[#365844] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#292D29]">Local vs. Hosted Production Reality:</strong>
                  <span className="text-[#606860] ml-1">
                    Local mode runs real Gemma on device. The hosted Render backend operates without a local Ollama daemon and intentionally uses our deterministic engine fallback, transparently marked as <span className="font-mono text-[10px] bg-[#EEEBDD] px-1 py-0.2 rounded border border-[#DFD9CA]">Deterministic Pattern Rules</span> in the UI.
                  </span>
                </div>
              </div>
            </div>

            {/* Expandable Technical Details */}
            <details className="text-xs group border border-[#DFD9CA] rounded-xl bg-[#FAF8F3] p-3 transition-all cursor-pointer">
              <summary className="font-mono text-[11px] font-semibold text-[#365844] flex items-center justify-between select-none">
                <span>View Technical Architecture &amp; Guardrails</span>
                <span className="text-[#8A928A] group-open:rotate-90 transition-transform">▸</span>
              </summary>
              <div className="mt-2.5 pt-2 border-t border-[#DFD9CA] space-y-2 text-[#606860] leading-relaxed">
                <p>
                  <strong>Input Sanitization:</strong> Raw statement descriptors are sanitized to strip delimiters, quotes, and brackets, preventing prompt injection attacks before reaching Gemma.
                </p>
                <p>
                  <strong>Claim Validator:</strong> The backend extracts numerical tokens and checks against verified evidence within 0.01 tolerance. Polarity contradiction detection ensures a +20% spending pace is never described as a drop.
                </p>
                <p>
                  <strong>Zero-Repeat Memory:</strong> Mappings store normalized payee keys in <code className="font-mono text-[11px] bg-[#EEEBDD] px-1 py-0.2 rounded">learned_payees</code> with <code className="font-mono text-[11px] bg-[#EEEBDD] px-1 py-0.2 rounded">user_classified = 1</code>, bypassing LLM inference entirely on subsequent imports.
                </p>
              </div>
            </details>
          </section>

          <hr className="border-[#DFD9CA]/80" />

          {/* Section 4: Privacy and Control */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#365844] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#365844]" />
              <span>Privacy and Control</span>
            </div>

            <p className="text-xs sm:text-sm text-[#606860] leading-relaxed font-sans">
              Privacy at Usually is built on tangible architectural boundaries, not vague marketing claims:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#365844] font-semibold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>Local Development</span>
                </span>
                <p className="text-[#606860] leading-relaxed">
                  When running Usually locally on your computer, your transactions are stored in local SQLite databases on your hard drive. Ollama runs on your local CPU/GPU. Zero financial data is sent to external cloud servers.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FCFBF7] border border-[#DFD9CA] space-y-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-[#365844] font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Hosted Application</span>
                </span>
                <p className="text-[#606860] leading-relaxed">
                  On the hosted cloud deployment, each user workspace is physically segregated into an isolated SQLite database file (<code className="font-mono text-[10px] bg-[#EEEBDD] px-1 py-0.2 rounded">workspace_&lt;id&gt;.db</code>). 1-click workspace deletion permanently unlinks database and WAL files.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#606860] leading-relaxed italic">
              You remain in complete control: approve, edit, or reject any classification, and edit transaction categories at any time in the Verified Ledger.
            </p>
          </section>

          <hr className="border-[#DFD9CA]/80" />

          {/* Section 5: Open Source & Links */}
          <section className="space-y-3 pb-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#365844] font-semibold">
              <GithubIcon className="w-3.5 h-3.5 text-[#365844]" />
              <span>Open Source</span>
            </div>

            <p className="text-xs sm:text-sm text-[#606860] leading-relaxed font-sans">
              Usually is an open-source project licensed under the <strong>MIT License</strong>, built for the <strong>Hacktoberfest 2026 Open-Source AI Challenge</strong>.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href="https://github.com/debashis-sharingan-21/usually"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#292D29] hover:bg-[#1f221f] text-white text-xs font-medium transition-all shadow-xs btn-tactile cursor-pointer"
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>View GitHub Repository</span>
                <ExternalLink className="w-3 h-3 text-[#DFD9CA]" />
              </a>

              <a
                href="https://usually-tau.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF8F3] hover:bg-[#EEEBDD] border border-[#DFD9CA] text-[#292D29] text-xs font-medium transition-all shadow-xs btn-tactile cursor-pointer"
              >
                <span>Live Application</span>
                <ExternalLink className="w-3 h-3 text-[#606860]" />
              </a>
            </div>
          </section>

        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-3 border-t border-[#DFD9CA] bg-[#FAF8F3] flex items-center justify-between text-xs font-mono text-[#8A928A] shrink-0">
          <span className="notebook-annotation text-xs text-[#365844]">
            teach Usually once, remembered forever
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#EEEBDD] hover:bg-[#E2DECE] border border-[#DFD9CA] text-[#292D29] font-medium transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
