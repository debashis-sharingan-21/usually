"use client";

import React from 'react';
import { StatementProvider, useStatement } from '@/context/StatementContext';
import { Navbar } from './Navbar';
import { NotebookFooter } from './NotebookFooter';
import { CSVImportModal } from './CSVImportModal';

const ShellContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isImportOpen, setIsImportOpen, handleImportSuccess } = useStatement();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F5EE] text-[#292D29] notebook-ruled selection:bg-[#E8C95D]/60 selection:text-[#292D29]">
      <Navbar />
      
      <main className="flex-1 pb-20 md:pb-12">
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
