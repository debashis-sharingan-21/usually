"use client";

import React, { useState } from 'react';
import { X, Sparkles, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useStatement } from '@/context/StatementContext';
import { SlothMascot } from './SlothMascot';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { startGuestWorkspace, login, register } = useStatement();
  const [tab, setTab] = useState<'instant' | 'login' | 'register'>('instant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInstant = async () => {
    setLoading(true);
    setError(null);
    try {
      await startGuestWorkspace();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize instant workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FCFBF7] border border-[#DFD9CA] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EEEBDD]">
          <div className="flex items-center gap-2.5">
            <SlothMascot mood="peaceful" size="sm" />
            <span className="font-serif text-base font-medium text-[#292D29]">
              Personal Workspace
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8A928A] hover:text-[#292D29] p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="grid grid-cols-3 border-b border-[#EEEBDD] bg-[#F7F5EE] text-xs font-medium">
          <button
            onClick={() => { setTab('instant'); setError(null); }}
            className={`py-2.5 text-center transition-all cursor-pointer ${
              tab === 'instant'
                ? 'bg-[#FCFBF7] text-[#365844] font-semibold border-b-2 border-[#365844]'
                : 'text-[#8A928A] hover:text-[#292D29]'
            }`}
          >
            Instant Private
          </button>
          <button
            onClick={() => { setTab('login'); setError(null); }}
            className={`py-2.5 text-center transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-[#FCFBF7] text-[#365844] font-semibold border-b-2 border-[#365844]'
                : 'text-[#8A928A] hover:text-[#292D29]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('register'); setError(null); }}
            className={`py-2.5 text-center transition-all cursor-pointer ${
              tab === 'register'
                ? 'bg-[#FCFBF7] text-[#365844] font-semibold border-b-2 border-[#365844]'
                : 'text-[#8A928A] hover:text-[#292D29]'
            }`}
          >
            New Account
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'instant' ? (
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFD9CA] space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs font-medium text-[#292D29]">
                  <ShieldCheck className="w-4 h-4 text-[#365844]" />
                  <span>Physical SQLite Isolation</span>
                </div>
                <p className="text-xs text-[#606860] leading-relaxed">
                  Start an isolated personal workspace immediately. No registration or personal credentials required.
                  Your statements and habit observations remain completely private to your session.
                </p>
              </div>

              <button
                onClick={handleInstant}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#365844] hover:bg-[#2c4737] text-white rounded-xl text-xs font-medium transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer btn-tactile"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#E8C95D]" />
                <span>{loading ? 'Creating Workspace...' : 'Start Instant Private Workspace'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono text-[#606860] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8A928A] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#DFD9CA] rounded-xl text-xs text-[#292D29] focus:outline-none focus:ring-1 focus:ring-[#365844]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#606860] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8A928A] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#DFD9CA] rounded-xl text-xs text-[#292D29] focus:outline-none focus:ring-1 focus:ring-[#365844]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#365844] hover:bg-[#2c4737] text-white rounded-xl text-xs font-medium transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer btn-tactile mt-2"
              >
                <span>{loading ? 'Processing...' : tab === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* Ephemeral Hosting Transparency Notice */}
          <div className="text-[10px] text-[#8A928A] text-center pt-2 border-t border-[#EEEBDD]">
            Hosted workspaces use isolated SQLite storage. For permanent 100% offline persistence, run Usually locally.
          </div>
        </div>
      </div>
    </div>
  );
};
