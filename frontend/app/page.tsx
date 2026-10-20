"use client";

import React, { useState, useEffect } from 'react';
import {
  fetchHealth,
  fetchSummary,
  fetchNotifications,
  fetchHabits,
  fetchQuestions,
  updateTone,
  switchContext,
  seedDemoData,
  clearAllData
} from '@/api/client';
import type {
  SystemHealthResponse,
  SpendingSummaryResponse,
  HabitObservation,
  CSVImportResult,
  PayeeQuestion
} from '@/types';
import { Navbar } from '@/components/Navbar';
import { NotificationFeed } from '@/components/NotificationFeed';
import { HabitMemoryView } from '@/components/HabitMemoryView';
import { SpendingSummary } from '@/components/SpendingSummary';
import { TransactionList } from '@/components/TransactionList';
import { CSVImportModal } from '@/components/CSVImportModal';
import { PayeeQuestionsBanner } from '@/components/PayeeQuestionsBanner';
import { SlothMascot } from '@/components/SlothMascot';
import {
  Sparkles,
  UploadCloud,
  Brain,
  BarChart3,
  ListFilter,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Layers
} from 'lucide-react';

export default function HomePage() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [summary, setSummary] = useState<SpendingSummaryResponse | null>(null);
  const [notifications, setNotifications] = useState<HabitObservation[]>([]);
  const [habits, setHabits] = useState<HabitObservation[]>([]);
  const [questions, setQuestions] = useState<PayeeQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'habits' | 'spending' | 'transactions'>('feed');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      const [h, s, n, hab, q] = await Promise.all([
        fetchHealth(),
        fetchSummary(),
        fetchNotifications(),
        fetchHabits(),
        fetchQuestions(),
      ]);
      setHealth(h);
      setSummary(s);
      setNotifications(n);
      setHabits(hab);
      setQuestions(q);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToneChange = async (tone: 'playful' | 'dry' | 'minimal') => {
    try {
      await updateTone(tone);
      await loadAll();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSwitchContext = async (targetContext: 'personal' | 'demo') => {
    try {
      await switchContext(targetContext);
      await loadAll();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleLoadDemo = async () => {
    setIsDemoLoading(true);
    try {
      await seedDemoData();
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to delete all transactions and habits from local storage?')) {
      try {
        await clearAllData();
        await loadAll();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleImportSuccess = async (_result: CSVImportResult) => {
    await loadAll();
    setActiveTab('feed');
  };

  const hasData = (health?.transaction_count || 0) > 0;

  return (
    <div className="min-h-screen bg-[#F7F5EE] text-[#292D29] flex flex-col selection:bg-[#E8C95D] selection:text-[#292D29]">
      {/* Top Navigation */}
      <Navbar
        health={health}
        onOpenImport={() => setIsImportOpen(true)}
        onLoadDemo={handleLoadDemo}
        onClearData={handleClearData}
        isDemoLoading={isDemoLoading}
        onToneChange={handleToneChange}
        onSwitchContext={handleSwitchContext}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {!hasData && !loading ? (
          /* Empty / Onboarding State with Sloth Personality */
          <div className="max-w-3xl mx-auto py-10 sm:py-14 text-center space-y-8 animate-in fade-in duration-300">
            {/* Handcrafted Sloth Companion Illustration */}
            <div className="flex justify-center">
              <div className="p-4 rounded-3xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm">
                <SlothMascot mood="peaceful" size={96} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEEBDD] border border-[#DFD9CA] text-[11px] font-mono text-[#365844]">
                <span>Hacktoberfest 2026</span>
                <span>•</span>
                <span>Themed &ldquo;Slow and Steady&rdquo;</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292D29] tracking-tight leading-tight">
                Your money has <span className="highlight-pen">habits</span>.
              </h1>

              <p className="text-base sm:text-lg text-[#606860] leading-relaxed max-w-xl mx-auto font-sans">
                Usually is not an aggressive expense tracker or an annoying budget bot.
                It runs quietly on your machine, learning recurring patterns and offering
                witty, grounded observations at your own pace.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={handleLoadDemo}
                disabled={isDemoLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs tracking-wide shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#E8C95D]" />
                <span>Explore with 6-Month Demo Data</span>
              </button>

              <button
                onClick={() => setIsImportOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#FCFBF7] hover:bg-[#EEEBDD] border border-[#DFD9CA] text-[#292D29] font-medium text-xs tracking-wide transition-all cursor-pointer shadow-2xs"
              >
                <UploadCloud className="w-4 h-4 text-[#365844]" />
                <span>Import Bank / UPI Statement</span>
              </button>
            </div>

            {/* Architectural Notebook Box */}
            <div className="mt-14 p-6 sm:p-8 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm text-left space-y-4">
              <div className="flex items-center justify-between border-b border-[#EEEBDD] pb-3">
                <span className="font-mono text-xs uppercase tracking-widest text-[#365844] font-semibold">
                  00 / Architectural Principles
                </span>
                <span className="text-[11px] font-mono text-[#8A928A]">Local-First • Evidence-Grounded</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-serif text-sm text-[#292D29]">
                    <CheckCircle2 className="w-4 h-4 text-[#365844]" />
                    <span>Deterministic Accounting</span>
                  </div>
                  <p className="text-[#606860] leading-relaxed pl-6">
                    No generative AI invents sums or computes balances. Cash flows, categories, and totals are computed with verified double-entry formulas.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-serif text-sm text-[#292D29]">
                    <ShieldCheck className="w-4 h-4 text-[#365844]" />
                    <span>Zero Cloud Transmission</span>
                  </div>
                  <p className="text-[#606860] leading-relaxed pl-6">
                    Raw CSVs, account numbers, and counterparties live strictly in your local SQLite database. Nothing is sent to third-party APIs.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-serif text-sm text-[#292D29]">
                    <Layers className="w-4 h-4 text-[#365844]" />
                    <span>Longitudinal Memory</span>
                  </div>
                  <p className="text-[#606860] leading-relaxed pl-6">
                    Observations require strict multi-month minimum evidence. Usually waits patiently until patterns are real before speaking up.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-serif text-sm text-[#292D29]">
                    <Cpu className="w-4 h-4 text-[#365844]" />
                    <span>Honest Local AI Integration</span>
                  </div>
                  <p className="text-[#606860] leading-relaxed pl-6">
                    Can use local Gemma via Ollama when available, or seamlessly fallback to reliable deterministic templates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Active Dashboard with Editorial Tabs */
          <div className="space-y-7 animate-in fade-in duration-200">
            {/* Payee Clarification Banner */}
            {questions.length > 0 && (
              <PayeeQuestionsBanner questions={questions} onAnswered={loadAll} />
            )}

            {/* Editorial Tab Bar */}
            <div className="flex items-center gap-2 border-b border-[#DFD9CA] pb-3 overflow-x-auto text-xs">
              <button
                onClick={() => setActiveTab('feed')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'feed'
                    ? 'bg-[#365844] text-white shadow-sm'
                    : 'text-[#606860] hover:text-[#292D29] hover:bg-[#EEEBDD]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Habit Feed</span>
                {notifications.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    activeTab === 'feed' ? 'bg-[#2c4737] text-white' : 'bg-[#EEEBDD] text-[#365844]'
                  }`}>
                    {notifications.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('habits')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'habits'
                    ? 'bg-[#365844] text-white shadow-sm'
                    : 'text-[#606860] hover:text-[#292D29] hover:bg-[#EEEBDD]'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Habit Memory</span>
                {habits.length > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    activeTab === 'habits' ? 'bg-[#2c4737] text-white' : 'bg-[#EEEBDD] text-[#365844]'
                  }`}>
                    {habits.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('spending')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'spending'
                    ? 'bg-[#365844] text-white shadow-sm'
                    : 'text-[#606860] hover:text-[#292D29] hover:bg-[#EEEBDD]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Cash Flow & Pacing</span>
              </button>

              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'transactions'
                    ? 'bg-[#365844] text-white shadow-sm'
                    : 'text-[#606860] hover:text-[#292D29] hover:bg-[#EEEBDD]'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Verified Ledger</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === 'transactions' ? 'bg-[#2c4737] text-white' : 'bg-[#EEEBDD] text-[#606860]'
                }`}>
                  {health?.transaction_count || 0}
                </span>
              </button>
            </div>

            {/* Tab Views */}
            {activeTab === 'feed' && (
              <div className="space-y-8">
                <NotificationFeed notifications={notifications} onRefresh={loadAll} />
                <div className="pt-4 border-t border-[#DFD9CA]">
                  <SpendingSummary summary={summary} />
                </div>
              </div>
            )}

            {activeTab === 'habits' && (
              <HabitMemoryView habits={habits} onRefresh={loadAll} />
            )}

            {activeTab === 'spending' && (
              <SpendingSummary summary={summary} />
            )}

            {activeTab === 'transactions' && (
              <TransactionList onTransactionUpdated={loadAll} />
            )}
          </div>
        )}
      </main>

      {/* Editorial Colophon Footer */}
      <footer className="border-t border-[#DFD9CA] bg-[#FCFBF7] py-6 px-4 sm:px-6 text-xs text-[#8A928A] mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm font-medium text-[#292D29]">Usually</span>
            <span>—</span>
            <span>Your Money Has Habits</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Local-first SQLite</span>
            <span>•</span>
            <span>No third-party trackers</span>
            <span>•</span>
            <span>Hacktoberfest 2026</span>
          </div>
        </div>
      </footer>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportOpen}
        onClose={async () => {
          setIsImportOpen(false);
          await loadAll();
        }}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
