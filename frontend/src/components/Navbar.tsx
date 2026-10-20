import React from 'react';
import { UploadCloud, Sparkles, ShieldCheck, RefreshCw, Trash2, Cpu } from 'lucide-react';
import type { SystemHealthResponse } from '../types';

interface NavbarProps {
  health: SystemHealthResponse | null;
  onOpenImport: () => void;
  onLoadDemo: () => void;
  onClearData: () => void;
  isDemoLoading: boolean;
  onToneChange?: (tone: 'playful' | 'dry' | 'minimal') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  onOpenImport,
  onLoadDemo,
  onClearData,
  isDemoLoading,
  onToneChange,
}) => {
  return (
    <header className="border-b border-[#242938] bg-[#0d0f17]/80 backdrop-blur sticky top-0 z-40 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center font-black text-black text-lg shadow-lg shadow-lime-500/20">
            U
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-xl text-white">Usually</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/20">
                Local AI Habit Memory
              </span>
            </div>
            <p className="text-xs text-[#8e96ac] tracking-tight">Your Money Has Habits</p>
          </div>
        </div>

        {/* Center Indicators */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Privacy badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#161a26] border border-[#242938] text-[#8e96ac]">
            <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
            <span>Local SQLite • Zero Cloud Send</span>
          </div>

          {/* AI engine badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#161a26] border border-[#242938] text-[#8e96ac]">
            <Cpu className="w-3.5 h-3.5 text-lime-400" />
            {health?.ollama_available ? (
              <span className="text-lime-300 font-medium">Ollama: {health.ollama_model}</span>
            ) : (
              <span className="text-zinc-300">Local Deterministic Engine (Ollama offline)</span>
            )}
          </div>

          {/* Demo Mode Badge if active */}
          {health?.is_demo_mode && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Realistic Demo Data</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Tone Selector */}
          <div className="flex items-center gap-1 bg-[#161a26] border border-[#242938] rounded-lg p-0.5 text-xs">
            <span className="text-[10px] text-[#8e96ac] font-medium px-1.5 uppercase tracking-wider">Tone:</span>
            {(['playful', 'dry', 'minimal'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onToneChange?.(t)}
                className={`px-2 py-0.5 rounded text-[11px] capitalize font-medium transition-all cursor-pointer ${
                  health?.current_tone === t
                    ? 'bg-lime-400 text-black font-bold shadow-sm'
                    : 'text-[#8e96ac] hover:text-white'
                }`}
                title={`Set AI insight tone to ${t}`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={onLoadDemo}
            disabled={isDemoLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-[#161a26] hover:bg-[#1f2536] border border-[#242938] rounded-lg transition-colors cursor-pointer"
            title="Load 6-month realistic synthetic statement"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDemoLoading ? 'animate-spin' : ''}`} />
            <span>{health?.transaction_count ? 'Reload Demo' : 'Try Demo Data'}</span>
          </button>

          <button
            onClick={onClearData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
            title="Delete all transactions from local machine"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-lime-400 hover:bg-lime-300 rounded-lg shadow-md shadow-lime-400/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
};
