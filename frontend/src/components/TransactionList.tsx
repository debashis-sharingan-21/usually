import React, { useState, useEffect } from 'react';
import type { Transaction } from '../types';
import { fetchTransactions, updateTransaction } from '../api/client';
import { Search, Edit2, Check, X, Tag, ArrowLeft, ArrowRight } from 'lucide-react';

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
  }, [page, categoryFilter, directionFilter, search]);

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditMerchant(t.clean_merchant);
    setEditCategory(t.category);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: number) => {
    try {
      await updateTransaction(id, {
        clean_merchant: editMerchant,
        category: editCategory,
      });
      setEditingId(null);
      loadData();
      onTransactionUpdated();
    } catch (e) {
      console.error(e);
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
          Click the pen icon on any transaction to edit the merchant or category instantly.
        </p>
      </div>

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
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="text-xs text-[#8A928A] font-mono">
            Showing {total === 0 ? 0 : page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
          </div>
        </div>

        {/* Table */}
        <div className="border border-[#DFD9CA] rounded-xl overflow-hidden bg-[#FCFBF7]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EEEBDD] text-[#606860] uppercase tracking-wider text-[10px] font-mono border-b border-[#DFD9CA]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Date</th>
                  <th className="py-2.5 px-4 font-medium">Flow</th>
                  <th className="py-2.5 px-4 font-medium">Merchant / Payee</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 text-right font-medium">Amount</th>
                  <th className="py-2.5 px-4 font-medium">Type</th>
                  <th className="py-2.5 px-4 font-medium">Fingerprint</th>
                  <th className="py-2.5 px-4 text-right font-medium">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEBDD]">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#8A928A] font-sans">
                      No transactions match the selected filter.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const isEditing = editingId === t.id;

                    return (
                      <tr key={t.id} className="hover:bg-[#F7F5EE]/70 transition-colors duration-150">
                        <td className="py-3 px-4 font-mono text-[#606860] whitespace-nowrap">
                          {t.date}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
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
                              className="bg-[#F7F5EE] border border-[#365844] rounded px-2 py-0.5 text-xs text-[#292D29] w-full focus:outline-none"
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
                              className="bg-[#F7F5EE] border border-[#365844] rounded px-2 py-0.5 text-xs text-[#292D29] focus:outline-none"
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
                                className="p-1 text-[#365844] hover:bg-[#365844]/10 rounded cursor-pointer btn-tactile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
                                title="Save changes"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-[#8A928A] hover:bg-[#EEEBDD] rounded cursor-pointer btn-tactile focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(t)}
                              className="p-1.5 text-[#8A928A] hover:text-[#292D29] rounded-lg hover:bg-[#EEEBDD] transition-colors btn-tactile cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
                              title="Edit merchant name or category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
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
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  className="px-2.5 py-1 rounded-lg bg-[#FCFBF7] border border-[#DFD9CA] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EEEBDD] text-[#292D29] flex items-center gap-1 cursor-pointer btn-tactile transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Previous</span>
                </button>
                <span className="px-2 font-mono text-[#292D29]">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className="px-2.5 py-1 rounded-lg bg-[#FCFBF7] border border-[#DFD9CA] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EEEBDD] text-[#292D29] flex items-center gap-1 cursor-pointer btn-tactile transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#365844]"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
