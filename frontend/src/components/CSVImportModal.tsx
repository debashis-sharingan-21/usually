import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { previewCSV, importCSV } from '../api/client';
import type { CSVPreviewResponse, CSVImportResult } from '../types';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: CSVImportResult) => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<CSVPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [currency] = useState('INR');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showMappingManual, setShowMappingManual] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setErrorMsg('Please select a valid .csv file.');
      return;
    }
    setErrorMsg(null);
    setFile(selectedFile);
    setImportResult(null);
    try {
      const res = await previewCSV(selectedFile);
      setPreview(res);
      setMapping(res.suggested_mapping);
      // Auto-collapse manual mapping if confident
      setShowMappingManual(!res.is_confident);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to inspect CSV file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemap = async (newMapping: Record<string, string>) => {
    setMapping(newMapping);
    if (!file) return;
    try {
      const res = await previewCSV(file, newMapping);
      setPreview(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to re-preview with mapping');
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      const res = await importCSV(file, mapping, currency);
      setImportResult(res);
      onImportSuccess(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import transactions');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#12141d] border border-[#242938] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#242938] flex items-center justify-between bg-[#161a26]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-lime-400/10 text-lime-400 border border-lime-400/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Effortless Statement Import</h2>
              <p className="text-xs text-[#8e96ac]">
                Automatic format recognition, zero-effort import, and local privacy.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-[#242938] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="text-xs">{errorMsg}</div>
            </div>
          )}

          {/* Import Result Feedback if completed */}
          {importResult ? (
            <div className="space-y-4 py-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-lime-400/10 text-lime-400 flex items-center justify-center border border-lime-400/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Statement Processed Successfully</h3>
                <p className="text-xs text-[#8e96ac] mt-1">
                  Transactions committed locally to SQLite. Habit engine updated.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto pt-2">
                <div className="p-3 rounded-xl bg-[#161a26] border border-[#242938]">
                  <div className="text-xs text-[#8e96ac]">Total Rows</div>
                  <div className="text-lg font-bold text-white mt-1">{importResult.total_rows}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#161a26] border border-lime-500/30">
                  <div className="text-xs text-lime-400">Accepted</div>
                  <div className="text-lg font-bold text-lime-300 mt-1">{importResult.accepted_rows}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#161a26] border border-amber-500/30">
                  <div className="text-xs text-amber-400">Duplicates</div>
                  <div className="text-lg font-bold text-amber-300 mt-1">{importResult.duplicate_rows}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#161a26] border border-rose-500/30">
                  <div className="text-xs text-rose-400">Rejected</div>
                  <div className="text-lg font-bold text-rose-300 mt-1">{importResult.rejected_rows}</div>
                </div>
              </div>

              {/* Distinct Accounting Breakdown */}
              <div className="max-w-lg mx-auto p-4 rounded-xl bg-[#161a26] border border-[#242938] text-xs space-y-2.5 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-[#242938] text-[11px] text-[#8e96ac]">
                  <span>Statement Coverage</span>
                  <span className="font-semibold text-white">
                    {importResult.date_range ? `${importResult.date_range[0]} to ${importResult.date_range[1]}` : 'N/A'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="text-[11px] text-[#8e96ac]">Gross Debit Outflow</div>
                    <div className="text-sm font-bold text-rose-300">
                      ₹{(importResult.gross_debit_outflow ?? importResult.total_spent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-[#8e96ac]">Incoming Credits & P2P</div>
                    <div className="text-sm font-bold text-emerald-400">
                      ₹{(importResult.gross_credit_inflow ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-[#8e96ac]">Classified Expenses</div>
                    <div className="text-sm font-bold text-zinc-200">
                      ₹{(importResult.classified_expenses ?? importResult.total_spent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-[#8e96ac]">Net Spending</div>
                    <div className="text-sm font-bold text-lime-400">
                      ₹{(importResult.net_spending ?? importResult.total_spent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {importResult.blank_rows_skipped !== undefined && importResult.blank_rows_skipped > 0 && (
                  <div className="text-[10px] text-[#8e96ac] pt-1">
                    • {importResult.blank_rows_skipped} blank row(s) safely skipped
                  </div>
                )}
              </div>

              {importResult.pending_questions_count > 0 && (
                <div className="p-3 rounded-xl bg-lime-400/10 border border-lime-400/30 text-lime-300 max-w-lg mx-auto text-xs flex items-center justify-between">
                  <span>Usually has {importResult.pending_questions_count} quick one-tap clarification question(s) for recurring payees.</span>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-[#1a1e2b] border border-rose-500/20 text-left max-w-lg mx-auto">
                  <div className="text-xs font-semibold text-rose-300 mb-2">Incomplete / Rejected Records:</div>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-[#8e96ac]">
                    {importResult.errors.map((e, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-rose-400 font-mono">Row {e.row}:</span>
                        <span>{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-lg bg-lime-400 hover:bg-lime-300 text-black font-semibold text-xs shadow-md shadow-lime-400/20 cursor-pointer"
                >
                  Done & View Insights
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Dropzone if no file selected */}
              {!file && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-lime-400 bg-lime-400/5'
                      : 'border-[#242938] hover:border-[#3b435a] bg-[#161a26]/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#1f2536] text-lime-400 flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">
                    Drag and drop your bank or UPI statement CSV
                  </h3>
                  <p className="text-xs text-[#8e96ac] max-w-sm mx-auto">
                    PhonePe, HDFC, ICICI, SBI, and standard CSV exports are recognized automatically.
                  </p>
                  <div className="mt-4 inline-block px-3 py-1.5 rounded-lg bg-[#242938] text-xs text-zinc-300 font-medium">
                    Browse file
                  </div>
                </div>
              )}

              {/* Step 2: Recognition banner & Preview when file is present */}
              {file && preview && (
                <div className="space-y-4">
                  {/* Confidence Banner */}
                  {preview.is_confident ? (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-lime-500/10 to-emerald-500/5 border border-lime-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-lime-400/20 text-lime-400">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            <span>Format Recognized!</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-lime-400/20 text-lime-300 font-mono">
                              {Math.round(preview.confidence_score * 100)}% Confidence
                            </span>
                          </div>
                          <p className="text-xs text-[#8e96ac] mt-0.5">
                            {preview.confidence_reasons.join(' • ')}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleCommit}
                        disabled={importing}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-black font-bold text-xs shadow-lg shadow-lime-400/20 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {importing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Importing...</span>
                          </>
                        ) : (
                          <>
                            <span>One-Click Import ({preview.valid_count} rows)</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2 text-xs">
                      <HelpCircle className="w-4 h-4 shrink-0" />
                      <span>Some columns need your confirmation below before importing.</span>
                    </div>
                  )}

                  {/* File info bar */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#161a26] border border-[#242938]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-lime-400" />
                      <span className="font-medium text-white">{file.name}</span>
                      <span className="text-xs text-[#8e96ac]">({preview.total_rows} rows found)</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowMappingManual(!showMappingManual)}
                        className="text-xs text-[#8e96ac] hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <span>{showMappingManual ? 'Hide Column Mapping' : 'Review / Customize Mapping'}</span>
                        {showMappingManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { setFile(null); setPreview(null); }}
                        className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        Change file
                      </button>
                    </div>
                  </div>

                  {/* Manual Column Mapping Section (Collapsible) */}
                  {showMappingManual && (
                    <div className="p-4 rounded-xl bg-[#161a26] border border-[#242938] space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Column Mapping Inspection
                        </h4>
                        <span className="text-[11px] text-[#8e96ac]">Auto-detected from CSV headers</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block text-[#8e96ac] mb-1">Date Column *</label>
                          <select
                            value={mapping.date || ''}
                            onChange={(e) => handleRemap({ ...mapping, date: e.target.value })}
                            className="w-full bg-[#12141d] border border-[#242938] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-lime-400"
                          >
                            <option value="">-- Select --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[#8e96ac] mb-1">Description / Payee *</label>
                          <select
                            value={mapping.description || ''}
                            onChange={(e) => handleRemap({ ...mapping, description: e.target.value })}
                            className="w-full bg-[#12141d] border border-[#242938] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-lime-400"
                          >
                            <option value="">-- Select --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[#8e96ac] mb-1">Amount Column *</label>
                          <select
                            value={mapping.amount || ''}
                            onChange={(e) => handleRemap({ ...mapping, amount: e.target.value })}
                            className="w-full bg-[#12141d] border border-[#242938] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-lime-400"
                          >
                            <option value="">-- Select --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[#8e96ac] mb-1">Direction / Type (Optional)</label>
                          <select
                            value={mapping.type || ''}
                            onChange={(e) => handleRemap({ ...mapping, type: e.target.value })}
                            className="w-full bg-[#12141d] border border-[#242938] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-lime-400"
                          >
                            <option value="">-- Optional (e.g. Debit/Credit) --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary Bar */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-lg bg-[#161a26] border border-[#242938]">
                      <div className="text-[#8e96ac]">Rows Scanned</div>
                      <div className="font-bold text-white mt-0.5">{preview.total_rows}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#161a26] border border-lime-500/20">
                      <div className="text-lime-400">Valid Rows</div>
                      <div className="font-bold text-lime-300 mt-0.5">{preview.valid_count}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#161a26] border border-rose-500/20">
                      <div className="text-rose-400">Incomplete / Errors</div>
                      <div className="font-bold text-rose-300 mt-0.5">{preview.error_count}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#161a26] border border-amber-500/20">
                      <div className="text-amber-400">Ambiguous</div>
                      <div className="font-bold text-amber-300 mt-0.5">{preview.ambiguous_count}</div>
                    </div>
                  </div>

                  {/* Preview Rows Table */}
                  <div className="border border-[#242938] rounded-xl overflow-hidden bg-[#161a26]">
                    <div className="px-4 py-2 border-b border-[#242938] flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Parsed Preview (First {preview.preview_rows.length} rows)</span>
                      {preview.detected_date_range && (
                        <span className="text-[11px] text-[#8e96ac]">
                          Date range: {preview.detected_date_range[0]} to {preview.detected_date_range[1]}
                        </span>
                      )}
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#1a1e2b] text-[#8e96ac] sticky top-0">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Merchant / Payee</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3 text-right">Amount</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#242938]">
                          {preview.preview_rows.map((row) => (
                            <tr key={row.row_index} className="hover:bg-[#1f2536]/40">
                              <td className="py-2 px-3 font-mono text-[#8e96ac]">{row.row_index}</td>
                              <td className="py-2 px-3 font-mono text-zinc-300">{row.parsed_date || '—'}</td>
                              <td className="py-2 px-3 font-medium text-white">{row.parsed_merchant || '—'}</td>
                              <td className="py-2 px-3 text-[#8e96ac]">{row.parsed_category || '—'}</td>
                              <td className="py-2 px-3 text-right font-mono text-white">
                                {row.parsed_amount ? `₹${row.parsed_amount.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2 px-3">
                                <span className="capitalize px-1.5 py-0.5 rounded text-[10px] bg-[#242938] text-zinc-300">
                                  {row.parsed_type || '—'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {row.status === 'valid' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-lime-400">
                                    <CheckCircle2 className="w-3 h-3" /> Valid
                                  </span>
                                )}
                                {row.status === 'ambiguous' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-400" title={row.error_message}>
                                    <HelpCircle className="w-3 h-3" /> Ambiguous
                                  </span>
                                )}
                                {row.status === 'error' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-rose-400" title={row.error_message}>
                                    <AlertCircle className="w-3 h-3" /> {row.error_message}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!importResult && (
          <div className="px-6 py-4 border-t border-[#242938] bg-[#161a26] flex items-center justify-between">
            <div className="text-xs text-[#8e96ac]">
              {preview?.valid_count ? `${preview.valid_count} valid rows ready to import` : 'Awaiting CSV selection'}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                disabled={!file || !preview || preview.valid_count === 0 || importing}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-xs shadow-md shadow-lime-400/20 transition-all cursor-pointer"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Import {preview ? `(${preview.valid_count} rows)` : ''}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
