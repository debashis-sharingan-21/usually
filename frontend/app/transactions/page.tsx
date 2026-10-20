"use client";

import React from 'react';
import Link from 'next/link';
import { useStatement } from '@/context/StatementContext';
import { TransactionList } from '@/components/TransactionList';
import { ArrowLeft } from 'lucide-react';

export default function TransactionsPage() {
  const { loadAll } = useStatement();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 animate-fade-in">
      
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#8A928A]">
        <Link href="/" className="hover:text-[#292D29] flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>
        <span>/</span>
        <span className="text-[#292D29] font-medium">Verified Ledger</span>
      </div>

      {/* Full Dedicated Ledger Component */}
      <TransactionList onTransactionUpdated={loadAll} />
    </div>
  );
}
