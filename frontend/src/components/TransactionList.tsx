import React, { useState, useEffect } from 'react';
import type { Transaction } from '../types';
import { fetchTransactions, updateTransaction } from '../api/client';
import { Search, Edit2, Check, X, Tag, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { useStatement } from '@/context/StatementContext';

interface TransactionListProps {
  onTransactionUpdated: () => void;
}

const CATEGORIES = [
  'Food & Dining',
  'Shopping',
  'Groceries',
  'Transportation',
  'Entertainment',
  'Utilities',
  'Health & Fitness',
  'Transfers',
  'Income',
  'General',
];

export const TransactionList: React.FC<TransactionListProps> = ({ onTransactionUpdated }) => {
  const { isReadOnly, isSessionResolved } = useStatement();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMerchant, setEditMerchant] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetchTransactions({
        limit,
        offset: page * limit,
        category: categoryFilter || undefined,
        direction: directionFilter || undefined,
        search: search || undefined,
      });
      setTransactions(res.items);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, categoryFilter, directionFilter, search, isReadOnly]);

  const startEdit = (t: Transaction) => {
    setEditError(null);
    setEditingId(t.id);
    setEditMerchant(t.clean_merchant);
    setEditCategory(t.category);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async (id: number) => {
    setIsSaving(true);
    setEditError(null);
    try {
      await updateTransaction(id, {
        clean_merchant: editMerchant.trim() || undefined,
        category: editCategory || undefined,
      });
      setEditingId(null);
      await loadData();
      onTransactionUpdated();
    } catch (e: any) {
      const msg = e?.message || 'Failed to update transaction';
      setEditError(`Failed to save changes: ${msg}`);
      console.error('Update transaction error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      {/* Editorial Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#DFD9CA] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-[#365844] font-medium">
              04 / Verified Ledger
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
              {total} verified records
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#292D29] tracking-tight mt-1">
            Complete transaction record.
          </h2>
        </div>
        <p className="text-xs text-[#8A928A] max-w-xs sm:text-right font-sans">
          {isReadOnly && isSessionResolved
            ? 'Viewing synthetic records in read-only mode.'
            : 'Click the pen icon on any transaction to edit the merchant or category instantly.'}
        </p>
      </div>

      {editError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between font-mono animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{editError}</span>
          </div>
          <button
            onClick={() => setEditError(null)}
            className="p-1 hover:text-rose-900 cursor-pointer rounded"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="p-5 sm:p-6 rounded-2xl bg-[#FCFBF7] border border-[#DFD9CA] shadow-sm space-y-4">
        {/* Filters bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A928A]" />
              <input
                type="text"
                placeholder="Search counterparty or raw memo..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-8 pr-3 py-1.5 bg-[#F7F5EE] border border-[#DFD9CA] rounded-lg text-xs text-[#292D29] placeholder-[#8A928A] focus:outline-none focus:border-[#365844] focus:ring-2 focus:ring-[#365844]/20 transition-all w-48 sm:w-64 font-sans"
              />
            </div>

            {/* Direction Filter */}
            <select
              value={directionFilter}
              onChange={(e) => { setDirectionFilter(e.target.value); setPage(0); }}
              className="py-1.5 px-3 bg-[#F7F5EE] border border-[#DFD9CA] rounded-lg text-xs text-[#292D29] focus:outline-none focus:border-[#365844] focus:ring-2 focus:ring-[#365844]/20 transition-all font-sans cursor-pointer"
            >
              <option value="">All Flow Types</option>
              <option value="debit">Debits (Outflow)</option>
              <option value="credit">Credits (Inflow)</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
              className="py-1.5 px-3 bg-[#F7F5EE] border border-[#DFD9CA] rounded-lg text-xs text-[#292D29] focus:outline-none focus:border-[#365844] focus:ring-2 focus:ring-[#365844]/20 transition-all font-sans cursor-pointer"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {(search || categoryFilter || directionFilter) && (
              <button
                onClick={() => { setSearch(''); setCategoryFilter(''); setDirectionFilter(''); setPage(0); }}
                className="text-xs text-[#8A928A] hover:text-[#292D29] underline px-2 py-1 font-sans cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="text-xs font-mono text-[#8A928A] flex items-center gap-2">
            <span>Showing {transactions.length} of {total}</span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EEEBDD]">
                <th className="py-2.5 px-4 font-mono font-medium text-[#8A928A]">DATE</th>
                <th className="py-2.5 px-4 font-mono font-medium text-[#8A928A]">FLOW</th>
                <th className="py-2.5 px-4 font-mono font-medium text-[#8A928A]">COUNTERPARTY / MEMO</th>
                <th className="py-2.5 px-4 font-mono font-medium text-[#8A928A]">CATEGORY</th>
                <th className="py-2.5 px-4 font-mono font-medium text-right text-[#8A928A]">AMOUNT</th>
                <th className="py-2.5 px-4 font-mono font-medium text-[#8A928A]">TYPE</th>
                <th className="py-2.5 px-4 font-mono font-medium text-[#8A928A]">FINGERPRINT</th>
                <th className="py-2.5 px-4 font-mono font-medium text-right text-[#8A928A]">
                  {isReadOnly && isSessionResolved ? 'STATUS' : 'EDIT'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEBDD]/60 font-sans">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8A928A] font-sans">
                    No transactions match your current filters.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isEditing = editingId === t.id;

                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-[#F7F5EE]/80 transition-colors ${
                        isEditing ? 'bg-[#F7F5EE]' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[#606860] whitespace-nowrap">
                        {t.date}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          t.direction === 'credit'
                            ? 'bg-[#365844]/10 text-[#365844] border border-[#365844]/20'
                            : 'bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/20'
                        }`}>
                          {t.direction}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#292D29] max-w-xs">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editMerchant}
                            onChange={(e) => setEditMerchant(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(t.id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                            className="bg-[#FCFBF7] border border-[#365844] rounded px-2 py-1 text-xs text-[#292D29] w-full focus:outline-none focus:ring-1 focus:ring-[#365844]"
                          />
                        ) : (
                          <div>
                            <div className="flex items-center gap-1.5 font-medium text-sm">
                              <span>{t.clean_merchant}</span>
                              {t.is_user_modified && (
                                <span className="text-[9px] px-1 rounded bg-[#365844]/10 text-[#365844] border border-[#365844]/20 font-mono">
                                  edited
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#8A928A] truncate font-normal">
                              {t.raw_description}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(t.id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="bg-[#FCFBF7] border border-[#365844] rounded px-2 py-1 text-xs text-[#292D29] focus:outline-none focus:ring-1 focus:ring-[#365844]"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#606860] border border-[#DFD9CA]">
                            <Tag className="w-2.5 h-2.5 text-[#8A928A]" />
                            <span>{t.category}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap text-sm">
                        <span className={
                          t.direction === 'credit' ? 'text-[#365844]' : 'text-[#292D29]'
                        }>
                          {t.direction === 'credit' ? '+' : '-'}₹{t.amount.toFixed(2)}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="capitalize px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#EEEBDD] text-[#606860]">
                          {t.type}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[10px] text-[#8A928A] whitespace-nowrap">
                        <span title={`Fingerprint SHA-256: ${t.fingerprint}`}>
                          {t.fingerprint.slice(0, 10)}...
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveEdit(t.id)}
                              disabled={isSaving}
                              className="p-1.5 text-[#365844] hover:bg-[#365844]/10 rounded-lg cursor-pointer btn-tactile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
                              title="Save changes"
                              aria-label="Save changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={isSaving}
                              className="p-1.5 text-[#8A928A] hover:bg-[#EEEBDD] rounded-lg cursor-pointer btn-tactile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
                              title="Cancel"
                              aria-label="Cancel editing"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : !isSessionResolved ? (
                          <span className="inline-block w-4 h-4" />
                        ) : !isReadOnly ? (
                          <button
                            onClick={() => startEdit(t)}
                            className="p-1.5 text-[#8A928A] hover:text-[#292D29] rounded-lg hover:bg-[#EEEBDD] transition-colors btn-tactile cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
                            title={`Edit transaction: ${t.clean_merchant}`}
                            aria-label={`Edit ${t.clean_merchant}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span
                            className="text-[10px] font-mono text-[#8A928A] px-1.5 py-0.5 rounded bg-[#EEEBDD]/70 border border-[#DFD9CA]/60 select-none cursor-default"
                            title="Synthetic demo dataset is read-only. Open personal workspace to edit."
                          >
                            Read-only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-[#F7F5EE] border-t border-[#DFD9CA] flex items-center justify-between text-xs text-[#606860]">
            <div className="font-sans">
              Page {page + 1} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg border border-[#DFD9CA] bg-[#FCFBF7] text-[#292D29] hover:bg-[#EEEBDD] disabled:opacity-40 disabled:cursor-not-allowed transition-all btn-tactile cursor-pointer"
                aria-label="Previous page"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-[#DFD9CA] bg-[#FCFBF7] text-[#292D29] hover:bg-[#EEEBDD] disabled:opacity-40 disabled:cursor-not-allowed transition-all btn-tactile cursor-pointer"
                aria-label="Next page"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
