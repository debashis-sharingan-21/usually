import React, { useState, useEffect } from 'react';
import {
  fetchHealth,
  fetchSummary,
  fetchNotifications,
  fetchHabits,
  fetchQuestions,
  updateTone,
  seedDemoData,
  clearAllData
} from './api/client';
import type {
  SystemHealthResponse,
  SpendingSummaryResponse,
  HabitObservation,
  CSVImportResult,
  PayeeQuestion
} from './types';
import { Navbar } from './components/Navbar';
import { NotificationFeed } from './components/NotificationFeed';
import { HabitMemoryView } from './components/HabitMemoryView';
import { SpendingSummary } from './components/SpendingSummary';
import { TransactionList } from './components/TransactionList';
import { CSVImportModal } from './components/CSVImportModal';
import { PayeeQuestionsBanner } from './components/PayeeQuestionsBanner';
import {
  Sparkles,
  UploadCloud,
  Brain,
  BarChart3,
  ListFilter
} from 'lucide-react';

export const App: React.FC = () => {
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
    <div className="min-h-screen bg-[#0a0b10] text-[#f1f3f9] flex flex-col selection:bg-lime-400 selection:text-black">
      {/* Top Navigation */}
      <Navbar
        health={health}
        onOpenImport={() => setIsImportOpen(true)}
        onLoadDemo={handleLoadDemo}
        onClearData={handleClearData}
        isDemoLoading={isDemoLoading}
        onToneChange={handleToneChange}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {!hasData && !loading ? (
          /* Empty / Onboarding State */
          <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-lime-400/20 to-lime-600/10 border border-lime-400/30 text-lime-400">
              <Brain className="w-10 h-10" />
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Your Money Has Habits.
              </h1>
              <p className="text-sm md:text-base text-[#8e96ac] leading-relaxed max-w-lg mx-auto">
                Usually is not a generic expense tracker or chatbot. It runs 100% locally on your machine,
                learning recurring cadences and delivering short, evidence-backed observations.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                onClick={handleLoadDemo}
                disabled={isDemoLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-black font-bold text-xs tracking-wide shadow-lg shadow-lime-400/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Explore with 6-Month Demo Data</span>
              </button>

              <button
                onClick={() => setIsImportOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#161a26] hover:bg-[#1f2536] border border-[#242938] text-white font-semibold text-xs tracking-wide transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-lime-400" />
                <span>Import Bank CSV Statement</span>
              </button>
            </div>

            {/* Philosophy Box */}
            <div className="mt-12 p-6 rounded-2xl bg-[#12141d] border border-[#242938] text-left text-xs space-y-3">
              <div className="font-bold text-white uppercase tracking-wider text-[11px] text-lime-400">
                Hacktoberfest 2026 • “Slow and Steady” Architectural Principles
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[#8e96ac]">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-lime-400 mt-1.5 shrink-0" />
                  <span><strong>Deterministic accounting:</strong> No AI calculates financial totals or invents amounts.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-lime-400 mt-1.5 shrink-0" />
                  <span><strong>Zero cloud transmit:</strong> Raw CSVs, SQLite records, and fingerprints never leave your machine.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-lime-400 mt-1.5 shrink-0" />
                  <span><strong>Longitudinal habit memory:</strong> Only produces claims when supported by verified multi-month data.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-lime-400 mt-1.5 shrink-0" />
                  <span><strong>Safe local AI fallback:</strong> Works with Gemma locally, or seamlessly falls back to tested rules.</span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          /* Active Dashboard with Tabs */
          <div className="space-y-6">
            {/* Payee Clarification Banner */}
            {questions.length > 0 && (
              <PayeeQuestionsBanner questions={questions} onAnswered={loadAll} />
            )}

            {/* Tab Bar */}
            <div className="flex items-center gap-2 border-b border-[#242938] pb-3 overflow-x-auto text-xs">
              <button
                onClick={() => setActiveTab('feed')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'feed'
                    ? 'bg-lime-400 text-black shadow-md shadow-lime-400/20'
                    : 'text-[#8e96ac] hover:text-white hover:bg-[#161a26]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Habit Feed</span>
                {notifications.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === 'feed' ? 'bg-black text-lime-400' : 'bg-[#242938] text-lime-400'
                  }`}>
                    {notifications.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('habits')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'habits'
                    ? 'bg-lime-400 text-black shadow-md shadow-lime-400/20'
                    : 'text-[#8e96ac] hover:text-white hover:bg-[#161a26]'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Longitudinal Memory</span>
                {habits.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === 'habits' ? 'bg-black text-lime-400' : 'bg-[#242938] text-lime-400'
                  }`}>
                    {habits.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('spending')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'spending'
                    ? 'bg-lime-400 text-black shadow-md shadow-lime-400/20'
                    : 'text-[#8e96ac] hover:text-white hover:bg-[#161a26]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Spending & Pacing</span>
              </button>

              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'transactions'
                    ? 'bg-lime-400 text-black shadow-md shadow-lime-400/20'
                    : 'text-[#8e96ac] hover:text-white hover:bg-[#161a26]'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Transactions</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'transactions' ? 'bg-black text-lime-400' : 'bg-[#242938] text-zinc-300'
                }`}>
                  {health?.transaction_count || 0}
                </span>
              </button>
            </div>

            {/* Tab Views */}
            {activeTab === 'feed' && (
              <div className="space-y-6">
                <NotificationFeed notifications={notifications} onRefresh={loadAll} />
                <div className="pt-4 border-t border-[#1e2333]">
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

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default App;
