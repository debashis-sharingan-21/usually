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
    <div className="p-5 rounded-2xl bg-[#12141d] border border-[#242938] space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Verified Transactions ({total})
          </h3>
          <p className="text-xs text-[#8e96ac]">
            Direct in-place editing updates merchant & category labels immediately.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8e96ac]" />
            <input
              type="text"
              placeholder="Search payee or raw memo..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-8 pr-3 py-1.5 bg-[#161a26] border border-[#242938] rounded-lg text-xs text-white placeholder-[#8e96ac] focus:outline-none focus:border-lime-400 w-48 md:w-60"
            />
          </div>

          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => { setDirectionFilter(e.target.value); setPage(0); }}
            className="py-1.5 px-3 bg-[#161a26] border border-[#242938] rounded-lg text-xs text-white focus:outline-none focus:border-lime-400"
          >
            <option value="">All Flows</option>
            <option value="debit">Debits (Outflow)</option>
            <option value="credit">Credits (Inflow)</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="py-1.5 px-3 bg-[#161a26] border border-[#242938] rounded-lg text-xs text-white focus:outline-none focus:border-lime-400"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-[#242938] rounded-xl overflow-hidden bg-[#161a26]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1a1e2b] text-[#8e96ac] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Flow</th>
                <th className="py-2.5 px-4">Merchant / Payee</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Fingerprint</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242938]">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8e96ac]">
                    No transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isEditing = editingId === t.id;

                  return (
                    <tr key={t.id} className="hover:bg-[#1f2536]/40 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-zinc-300 whitespace-nowrap">
                        {t.date}
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          t.direction === 'credit'
                            ? 'bg-lime-400/15 text-lime-400 border border-lime-400/30'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}>
                          {t.direction}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 font-medium text-white max-w-xs">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editMerchant}
                            onChange={(e) => setEditMerchant(e.target.value)}
                            className="bg-[#12141d] border border-lime-400/50 rounded px-2 py-0.5 text-xs text-white w-full focus:outline-none"
                          />
                        ) : (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{t.clean_merchant}</span>
                              {t.is_user_modified && (
                                <span className="text-[9px] px-1 rounded bg-lime-400/10 text-lime-400 border border-lime-400/20">
                                  edited
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#8e96ac] truncate font-normal">
                              {t.raw_description}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-4">
                        {isEditing ? (
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="bg-[#12141d] border border-lime-400/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                          >
                            {CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#1a1e2b] text-[#8e96ac] border border-[#242938]">
                            <Tag className="w-2.5 h-2.5" />
                            <span>{t.category}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-semibold whitespace-nowrap">
                        <span className={
                          t.direction === 'credit' ? 'text-lime-400' : 'text-slate-100'
                        }>
                          {t.direction === 'credit' ? '+' : '-'}₹{t.amount.toFixed(2)}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="capitalize px-1.5 py-0.5 rounded text-[10px] bg-[#1a1e2b] text-[#8e96ac]">
                          {t.type}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 font-mono text-[10px] text-zinc-500 whitespace-nowrap">
                        <span title={`Fingerprint SHA-256: ${t.fingerprint}`}>
                          {t.fingerprint.slice(0, 10)}...
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveEdit(t.id)}
                              className="p-1 text-lime-400 hover:bg-lime-400/20 rounded cursor-pointer"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-zinc-400 hover:bg-zinc-700/30 rounded cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(t)}
                            className="p-1 text-[#8e96ac] hover:text-white rounded hover:bg-[#242938] transition-colors cursor-pointer"
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
          <div className="px-4 py-2.5 bg-[#12141d] border-t border-[#242938] flex items-center justify-between text-xs text-[#8e96ac]">
            <div>
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={page === 0}
                className="p-1 rounded bg-[#161a26] border border-[#242938] disabled:opacity-40 disabled:cursor-not-allowed hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded bg-[#161a26] border border-[#242938] disabled:opacity-40 disabled:cursor-not-allowed hover:text-white"
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
