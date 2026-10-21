"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SlothMascot } from './SlothMascot';
import { AuthModal } from './AuthModal';
import {
  UploadCloud,
  SlidersHorizontal,
  Home,
  BarChart3,
  ListFilter,
  Cpu,
  Database,
  Trash2,
  X,
  Sparkles,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import { useStatement } from '@/context/StatementContext';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const {
    health,
    user,
    workspaceMode,
    isAuthModalOpen,
    setIsAuthModalOpen,
    setIsImportOpen,
    handleToneChange,
    handleSwitchContext,
    handleClearData,
    logout,
    deleteCurrentWorkspace
  } = useStatement();

  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [showWsTooltip, setShowWsTooltip] = useState(false);
  const diagnosticRef = useRef<HTMLDivElement>(null);
  const wsBadgeRef = useRef<HTMLDivElement>(null);

  // Close diagnostic dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (diagnosticRef.current && !diagnosticRef.current.contains(e.target as Node)) {
        setIsDiagnosticOpen(false);
      }
      if (wsBadgeRef.current && !wsBadgeRef.current.contains(e.target as Node)) {
        setShowWsTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isDemo = workspaceMode === 'demo';
  const currentTone = health?.current_tone ?? 'playful';

  const navLinks = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Analysis', href: '/analysis', icon: BarChart3 },
    { label: 'Transactions', href: '/transactions', icon: ListFilter },
  ];

  return (
    <>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <header className="sticky top-0 z-40 bg-[#FCFBF7]/95 backdrop-blur-md border-b border-[#DFD9CA] transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <SlothMascot mood="peaceful" size="sm" className="transition-transform group-hover:scale-105 duration-200" />
              <div className="flex flex-col">
                <span className="font-serif text-lg font-medium text-[#292D29] tracking-tight leading-none">
                  Usually
                </span>
                <span className="text-[10px] text-[#8A928A] tracking-wide font-sans hidden sm:inline">
                  Your money has habits
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Desktop Navigation Bar */}
          <nav className="hidden md:flex items-center gap-1 bg-[#F7F5EE] p-1 rounded-xl border border-[#DFD9CA]" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs px-3.5 py-1.5 rounded-lg transition-all duration-150 font-medium flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844] focus-visible:ring-offset-1 active:scale-[0.98] ${
                    isActive
                      ? 'bg-[#FCFBF7] text-[#292D29] border border-[#DFD9CA] shadow-2xs font-semibold'
                      : 'text-[#606860] hover:text-[#292D29] hover:bg-[#EEEBDD]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <link.icon className={`w-3.5 h-3.5 transition-colors duration-150 ${isActive ? 'text-[#365844]' : 'text-[#8A928A]'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Workspace Badge, Import Action & Diagnostics Button */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Compact Workspace Status Badge with Tooltip Popover */}
            <div className="relative" ref={wsBadgeRef}>
              <button
                onClick={() => {
                  if (isDemo) {
                    if (user) {
                      handleSwitchContext('personal');
                    } else {
                      setIsAuthModalOpen(true);
                    }
                  } else {
                    handleSwitchContext('demo');
                  }
                }}
                onMouseEnter={() => setShowWsTooltip(true)}
                onMouseLeave={() => setShowWsTooltip(false)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-[#F7F5EE] hover:bg-[#EEEBDD] border border-[#DFD9CA] text-[#606860] hover:text-[#292D29] flex items-center gap-1.5 transition-all btn-tactile cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
                aria-label={isDemo ? 'Synthetic Demo - Click to personalize' : 'Personal Workspace - Click to switch to demo'}
                title={isDemo ? 'Click to personalize Usually with your own statements' : 'Click to switch to Synthetic Demo'}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${isDemo ? 'bg-[#E8C95D]' : 'bg-[#365844]'}`} />
                <span className="font-mono text-[11px] font-medium whitespace-nowrap">
                  {isDemo ? (
                    <>
                      <span className="hidden sm:inline">Synthetic Demo</span>
                      <span className="sm:hidden">Demo</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Personal Workspace</span>
                      <span className="sm:hidden">Personal</span>
                    </>
                  )}
                </span>
              </button>

              {/* Accessible Workspace Information Tooltip */}
              {showWsTooltip && (
                <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-[#FCFBF7] border border-[#DFD9CA] rounded-xl shadow-lg z-50 text-xs space-y-1.5 animate-slide-up pointer-events-none">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider font-semibold text-[#292D29]">
                    <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? 'bg-[#E8C95D]' : 'bg-[#365844]'}`} />
                    <span>{isDemo ? 'Synthetic Showcase' : 'Personal Workspace'}</span>
                  </div>
                  <p className="text-[11px] text-[#606860] leading-relaxed font-sans">
                    {isDemo
                      ? 'Exploring 6 months of sample finances in read-only mode. Click this badge to create an isolated personal workspace.'
                      : user?.email
                      ? `Active session for ${user.email}. Statements and habit memory are isolated to your private database.`
                      : 'Active private guest workspace. Your statements and habit observations remain isolated on this device.'}
                  </p>
                  <div className="text-[10px] text-[#8A928A] font-mono pt-1 border-t border-[#EEEBDD]">
                    Click badge to {isDemo ? 'personalize Usually' : 'switch to demo'}
                  </div>
                </div>
              )}
            </div>

            {/* Import Statement Action */}
            <button
              onClick={() => setIsImportOpen(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-[#365844] hover:bg-[#2c4737] text-white font-medium shadow-2xs transition-all btn-tactile cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Import Statement</span>
            </button>

            {/* Diagnostics & Settings trigger */}
            <div className="relative" ref={diagnosticRef}>
              <button
                onClick={() => setIsDiagnosticOpen(!isDiagnosticOpen)}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  isDiagnosticOpen
                    ? 'bg-[#EEEBDD] text-[#292D29] border border-[#DFD9CA]'
                    : 'text-[#8A928A] hover:text-[#292D29] hover:bg-[#F7F5EE]'
                }`}
                aria-label="Settings and System Diagnostics"
                title="Settings & System Diagnostics"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              {/* Diagnostic Dropdown Popover */}
              {isDiagnosticOpen && (
                <div className="absolute right-0 mt-2 w-80 p-4 bg-[#FCFBF7] border border-[#DFD9CA] rounded-2xl shadow-xl z-50 text-xs space-y-4 animate-slide-up">
                  <div className="flex items-center justify-between border-b border-[#EEEBDD] pb-2">
                    <span className="font-mono font-medium text-[11px] uppercase tracking-wider text-[#292D29]">
                      Workspace & Tone
                    </span>
                    <button
                      onClick={() => setIsDiagnosticOpen(false)}
                      className="text-[#8A928A] hover:text-[#292D29] p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tone selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-[#606860] font-mono">
                      Observation Tone
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-[#F7F5EE] p-1 rounded-lg border border-[#DFD9CA]">
                      {(['playful', 'dry', 'minimal'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => handleToneChange(t)}
                          className={`py-1 text-center capitalize rounded-md transition-all cursor-pointer ${
                            currentTone === t
                              ? 'bg-[#FCFBF7] text-[#365844] font-medium border border-[#DFD9CA] shadow-2xs'
                              : 'text-[#8A928A] hover:text-[#292D29]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Diagnostic status block */}
                  <div className="p-3 bg-[#F7F5EE] border border-[#DFD9CA] rounded-xl space-y-2">
                    <div className="text-[10px] uppercase tracking-wider font-mono text-[#8A928A]">
                      Workspace Diagnostics
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[#606860]">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#365844]" />
                        <span>Isolation:</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#292D29]">
                        {isDemo ? 'Shared Demo DB (Read-only)' : 'Per-User SQLite (Isolated)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[#606860]">
                        <Database className="w-3.5 h-3.5 text-[#365844]" />
                        <span>Records:</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#292D29]">
                        {health?.transaction_count || 0} rows
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[#606860]">
                        <Cpu className="w-3.5 h-3.5 text-[#365844]" />
                        <span>AI Engine:</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#292D29]">
                        {health?.ollama_available ? 'Gemma (Ollama Local)' : 'Deterministic Rules'}
                      </span>
                    </div>

                    <div className="text-[10px] text-[#8A928A] pt-1 border-t border-[#DFD9CA]/50 font-sans">
                      {isDemo
                        ? 'Synthetic transactions showcase. Switch to Personal Workspace to import your statements.'
                        : 'Temporary isolated SQLite workspace. For permanent offline persistence, run Usually locally.'}
                    </div>
                  </div>

                  {/* Workspace Actions */}
                  {!isDemo && (
                    <div className="space-y-1.5 pt-1">
                      {user?.email && (
                        <button
                          onClick={() => {
                            setIsDiagnosticOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[#606860] hover:text-[#292D29] bg-[#F7F5EE] hover:bg-[#EEEBDD] border border-[#DFD9CA] transition-colors cursor-pointer text-xs font-medium"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsDiagnosticOpen(false);
                          handleClearData();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[#606860] hover:text-[#292D29] bg-[#F7F5EE] hover:bg-[#EEEBDD] border border-[#DFD9CA] transition-colors cursor-pointer text-xs font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#8A928A]" />
                        <span>Clear Transactions</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsDiagnosticOpen(false);
                          deleteCurrentWorkspace();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer text-xs font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Personal Workspace</span>
                      </button>
                    </div>
                  )}

                  {isDemo && (
                    <button
                      onClick={() => {
                        setIsDiagnosticOpen(false);
                        setIsAuthModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#365844] hover:bg-[#2c4737] text-white transition-colors cursor-pointer text-xs font-medium"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#E8C95D]" />
                      <span>Start Personal Workspace</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FCFBF7]/95 backdrop-blur-md border-t border-[#DFD9CA] px-4 py-2 flex items-center justify-around shadow-lg"
        aria-label="Mobile Navigation"
      >
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844] ${
                isActive
                  ? 'text-[#365844] font-semibold'
                  : 'text-[#8A928A] hover:text-[#292D29]'
              }`}
            >
              <link.icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'text-[#365844] scale-105' : 'text-[#8A928A]'}`} />
              <span>{link.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#365844] -mt-0.5" aria-hidden="true" />
              )}
            </Link>
          );
        })}

        {/* Mobile Quick Import button */}
        <button
          onClick={() => setIsImportOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg text-[11px] font-medium text-[#365844] hover:text-[#2c4737] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
          title="Import Statement"
        >
          <UploadCloud className="w-5 h-5" />
          <span>Import</span>
        </button>
      </nav>
    </>
  );
};
