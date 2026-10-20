"use client";

import React from 'react';
import { StatementProvider, useStatement } from '@/context/StatementContext';
import { Navbar } from './Navbar';
import { CSVImportModal } from './CSVImportModal';

const ShellContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isImportOpen, setIsImportOpen, handleImportSuccess } = useStatement();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5EE] text-[#292D29] notebook-ruled selection:bg-[#E8C95D]/60 selection:text-[#292D29]">
      <Navbar />
      
      <main className="flex-1 pb-20 md:pb-12">
        {children}
      </main>

      {/* Editorial Colophon Footer */}
      <footer className="border-t border-[#DFD9CA] bg-[#FCFBF7] py-6 px-4 sm:px-6 text-xs text-[#8A928A] mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm font-medium text-[#292D29]">Usually</span>
            <span>—</span>
            <span>Your Money Has Habits</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Local SQLite</span>
            <span>•</span>
            <span>Zero Cloud Transmit</span>
            <span>•</span>
            <span>Slow and Steady</span>
          </div>
        </div>
      </footer>

      {/* Shared CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <StatementProvider>
      <ShellContent>{children}</ShellContent>
    </StatementProvider>
  );
};
