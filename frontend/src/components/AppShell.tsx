"use client";

import React from 'react';
import { StatementProvider, useStatement } from '@/context/StatementContext';
import { Navbar } from './Navbar';
import { NotebookFooter } from './NotebookFooter';
import { CSVImportModal } from './CSVImportModal';

const ShellContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isImportOpen, setIsImportOpen, handleImportSuccess } = useStatement();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5EE] text-[#292D29] notebook-ruled selection:bg-[#E8C95D]/60 selection:text-[#292D29] relative overflow-x-hidden">
      {/* Notebook Spine: Narrow Muted Sage-Green Binding Accent along Left Edge */}
      <div
        className="fixed top-0 bottom-0 left-0 w-1.5 sm:w-2 bg-[#8FA882] border-r border-[#768C69]/40 z-30 pointer-events-none select-none"
        aria-hidden="true"
      />

      {/* Notebook Margin: Thin Understated Faded-Red Vertical Line */}
      <div
        className="fixed top-0 bottom-0 left-4 sm:left-6 md:left-8 lg:left-12 w-[1px] bg-[rgba(215,90,75,0.20)] z-0 pointer-events-none select-none"
        aria-hidden="true"
      />

      <Navbar />
      
      <main className="flex-1 pb-20 md:pb-12 relative z-10">
        {children}
      </main>

      {/* Signature Notebook Footer */}
      <NotebookFooter />

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
