import React, { useState } from 'react';
import { UploadCloud, Sparkles, ShieldCheck, RefreshCw, Trash2, Cpu, Menu, X } from 'lucide-react';
import type { SystemHealthResponse } from '../types';
import { SlothMascot } from './SlothMascot';

interface NavbarProps {
  health: SystemHealthResponse | null;
  onOpenImport: () => void;
  onLoadDemo: () => void;
  onClearData: () => void;
  isDemoLoading: boolean;
  onToneChange?: (tone: 'playful' | 'dry' | 'minimal') => void;
  onSwitchContext?: (context: 'personal' | 'demo') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  onOpenImport,
  onLoadDemo,
  onClearData,
  isDemoLoading,
  onToneChange,
  onSwitchContext,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-[#DFD9CA] bg-[#F7F5EE]/95 backdrop-blur sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <SlothMascot size="md" variant="calm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl tracking-tight text-[#292D29] font-medium leading-none">
                Usually
              </span>
              <span className="text-[10px] tracking-widest uppercase font-mono px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#606860] border border-[#DFD9CA]">
                slow & steady
              </span>
            </div>
            <p className="text-[11px] text-[#8A928A] tracking-tight font-sans mt-0.5">
              Your money has habits
            </p>
          </div>
        </div>

        {/* Desktop Center Badges */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs">
          {/* Privacy status */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCFBF7] border border-[#DFD9CA] text-[#606860]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#365844]" />
            <span className="font-sans">100% On-Device • Local SQLite</span>
          </div>

          {/* AI / Fallback status */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCFBF7] border border-[#DFD9CA] text-[#606860]">
            <Cpu className="w-3.5 h-3.5 text-[#365844]" />
            {health?.ollama_available ? (
              <span className="font-sans font-medium text-[#365844]">Ollama: {health.ollama_model}</span>
            ) : (
              <span className="font-sans">Deterministic Rule Engine</span>
            )}
          </div>

          {/* Context status */}
          {health?.is_demo_mode ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8C95D]/25 border border-[#E8C95D] text-[#292D29] font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#9E8224]" />
              <span className="font-sans">Demo Notebook</span>
              {health?.has_personal_data && (
                <button
                  onClick={() => onSwitchContext?.('personal')}
                  className="ml-1 text-[11px] underline hover:text-[#365844] cursor-pointer font-semibold"
                  title="Switch to your personal statement"
                >
                  (Return to My Data)
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#9CAF88]/20 border border-[#9CAF88] text-[#292D29] font-medium">
              <div className="w-2 h-2 rounded-full bg-[#365844]" />
              <span className="font-sans">Personal Notebook</span>
            </div>
          )}
        </div>

        {/* Desktop Action Controls */}
        <div className="hidden md:flex items-center gap-3">
          {/* Tone Selector */}
          <div className="flex items-center gap-0.5 bg-[#EEEBDD] border border-[#DFD9CA] rounded-full p-1 text-xs">
            <span className="text-[10px] text-[#8A928A] font-semibold px-2 uppercase tracking-wider">Tone:</span>
            {(['playful', 'dry', 'minimal'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onToneChange?.(t)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] capitalize font-medium transition-all cursor-pointer ${
                  health?.current_tone === t
                    ? 'bg-[#365844] text-[#FCFBF7] shadow-sm font-semibold'
                    : 'text-[#606860] hover:text-[#292D29]'
                }`}
                title={`Tone: ${t}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Demo toggle / Explore */}
          {health?.is_demo_mode ? (
            health?.has_personal_data && (
              <button
                onClick={() => onSwitchContext?.('personal')}
                className="px-3 py-1.5 text-xs font-medium text-[#365844] bg-[#FCFBF7] hover:bg-[#EEEBDD] border border-[#DFD9CA] rounded-full transition-colors cursor-pointer"
              >
                My Personal Data
              </button>
            )
          ) : (
            <button
              onClick={() => onSwitchContext ? onSwitchContext('demo') : onLoadDemo()}
              disabled={isDemoLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#606860] hover:text-[#292D29] bg-[#FCFBF7] hover:bg-[#EEEBDD] border border-[#DFD9CA] rounded-full transition-colors cursor-pointer"
              title="Explore realistic 6-month demonstration statements"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDemoLoading ? 'animate-spin' : ''}`} />
              <span>Explore Demo</span>
            </button>
          )}

          {/* Clear data button */}
          <button
            onClick={onClearData}
            className="p-2 text-[#8A928A] hover:text-[#C85A32] hover:bg-[#C85A32]/10 rounded-full transition-colors cursor-pointer"
            title="Clear data from current context"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Import CSV CTA */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#FCFBF7] bg-[#365844] hover:bg-[#2A4535] rounded-full shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import Statement</span>
          </button>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#FCFBF7] bg-[#365844] rounded-full"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-full border border-[#DFD9CA] bg-[#FCFBF7] text-[#292D29]"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#DFD9CA] bg-[#FCFBF7] px-6 py-4 space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#DFD9CA]">
            <span className="text-[#8A928A] uppercase tracking-wider text-[10px]">Context</span>
            <span className="font-semibold text-[#292D29]">
              {health?.is_demo_mode ? 'Realistic Demo Data' : 'Personal Data'}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-[#DFD9CA]">
            <span className="text-[#8A928A] uppercase tracking-wider text-[10px]">Tone</span>
            <div className="flex gap-1">
              {(['playful', 'dry', 'minimal'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onToneChange?.(t)}
                  className={`px-2 py-0.5 rounded-full text-[11px] capitalize ${
                    health?.current_tone === t ? 'bg-[#365844] text-white font-bold' : 'text-[#606860]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {health?.is_demo_mode ? (
              <button
                onClick={() => { onSwitchContext?.('personal'); setMobileMenuOpen(false); }}
                className="text-[#365844] font-semibold underline"
              >
                Return to My Data
              </button>
            ) : (
              <button
                onClick={() => { onSwitchContext?.('demo'); setMobileMenuOpen(false); }}
                className="text-[#606860] hover:text-[#292D29]"
              >
                Explore Demo Data
              </button>
            )}

            <button
              onClick={() => { onClearData(); setMobileMenuOpen(false); }}
              className="text-[#C85A32] flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Data</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
