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
import { SlothMascot } from './SlothMascot';

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
      setErrorMsg('Please select a valid .csv statement export file.');
      return;
    }
    setErrorMsg(null);
    setFile(selectedFile);
    setImportResult(null);
    try {
      const res = await previewCSV(selectedFile);
      setPreview(res);
      setMapping(res.suggested_mapping);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FCFBF7] border border-[#DFD9CA] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DFD9CA] flex items-center justify-between bg-[#F7F5EE]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#365844] font-semibold">
                  Statement Intake
                </span>
              </div>
              <h2 className="font-serif text-xl font-normal text-[#292D29]">
                Effortless Statement Import
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8A928A] hover:text-[#292D29] rounded-lg hover:bg-[#EEEBDD] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm bg-[#FCFBF7]">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#C85A32]/10 border border-[#C85A32]/20 text-[#C85A32] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="text-xs">{errorMsg}</div>
            </div>
          )}

          {/* Import Result Feedback if completed */}
          {importResult ? (
            <div className="space-y-5 py-4 text-center">
              <div className="flex justify-center mb-1">
                <div className="p-3 rounded-2xl bg-[#EEEBDD] border border-[#DFD9CA]">
                  <SlothMascot mood="celebrating" size={64} />
                </div>
              </div>
              <div>
                <h3 className="font-serif text-2xl font-normal text-[#292D29]">
                  Statement Processed Successfully
                </h3>
                <p className="text-xs text-[#606860] mt-1 font-sans">
                  Transactions committed locally to SQLite. Habit engine updated with fresh longitudinal history.
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto pt-1">
                <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFD9CA]">
                  <div className="text-xs text-[#8A928A] font-mono">Total Rows</div>
                  <div className="text-lg font-bold text-[#292D29] mt-1 font-mono">{importResult.total_rows}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#365844]/30">
                  <div className="text-xs text-[#365844] font-mono">Accepted</div>
                  <div className="text-lg font-bold text-[#365844] mt-1 font-mono">{importResult.accepted_rows}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFD9CA]">
                  <div className="text-xs text-[#606860] font-mono">Duplicates</div>
                  <div className="text-lg font-bold text-[#606860] mt-1 font-mono">{importResult.duplicate_rows}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#C85A32]/30">
                  <div className="text-xs text-[#C85A32] font-mono">Rejected</div>
                  <div className="text-lg font-bold text-[#C85A32] mt-1 font-mono">{importResult.rejected_rows}</div>
                </div>
              </div>

              {/* Distinct Accounting Breakdown */}
              <div className="max-w-lg mx-auto p-5 rounded-xl bg-[#F7F5EE] border border-[#DFD9CA] text-xs space-y-3 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-[#DFD9CA] text-[11px] text-[#606860]">
                  <span>Statement Coverage</span>
                  <span className="font-semibold text-[#292D29] font-mono">
                    {importResult.date_range ? `${importResult.date_range[0]} to ${importResult.date_range[1]}` : 'N/A'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="text-[11px] text-[#8A928A] uppercase font-mono">Gross Debit Outflow</div>
                    <div className="text-sm font-semibold text-[#C85A32] font-mono">
                      ₹{(importResult.gross_debit_outflow ?? importResult.total_spent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-[#8A928A] uppercase font-mono">Incoming Credits & P2P</div>
                    <div className="text-sm font-semibold text-[#365844] font-mono">
                      ₹{(importResult.gross_credit_inflow ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-[#8A928A] uppercase font-mono">Classified Expenses</div>
                    <div className="text-sm font-semibold text-[#292D29] font-mono">
                      ₹{(importResult.classified_expenses ?? importResult.total_spent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-[#8A928A] uppercase font-mono">Net Spending</div>
                    <div className="text-sm font-semibold text-[#365844] font-mono">
                      ₹{(importResult.net_spending ?? importResult.total_spent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {importResult.blank_rows_skipped !== undefined && importResult.blank_rows_skipped > 0 && (
                  <div className="text-[10px] text-[#8A928A] pt-1 border-t border-[#DFD9CA]">
                    • {importResult.blank_rows_skipped} blank row(s) safely skipped
                  </div>
                )}
              </div>

              {importResult.pending_questions_count > 0 && (
                <div className="p-3.5 rounded-xl bg-[#EEEBDD] border border-[#DFD9CA] text-[#365844] max-w-lg mx-auto text-xs flex items-center justify-between">
                  <span>Usually generated {importResult.pending_questions_count} one-tap payee clarification question(s).</span>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-[#F7F5EE] border border-[#C85A32]/20 text-left max-w-lg mx-auto">
                  <div className="text-xs font-semibold text-[#C85A32] mb-2 font-mono uppercase">Incomplete / Rejected Records:</div>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-[#606860]">
                    {importResult.errors.map((e, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-[#C85A32] font-mono">Row {e.row}:</span>
                        <span>{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-sm transition-all cursor-pointer"
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
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#365844] bg-[#EEEBDD]'
                      : 'border-[#DFD9CA] hover:border-[#365844] bg-[#F7F5EE]/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EEEBDD] text-[#365844] flex items-center justify-center mb-3.5 border border-[#DFD9CA]">
                    <FileText className="w-7 h-7" />
                  </div>
                  <h3 className="font-serif text-xl font-normal text-[#292D29] mb-1">
                    Drag and drop your bank or UPI statement CSV
                  </h3>
                  <p className="text-xs text-[#606860] max-w-sm mx-auto leading-relaxed font-sans">
                    PhonePe, HDFC, ICICI, SBI, and standard CSV exports are recognized automatically without manual mapping.
                  </p>
                  <div className="mt-4 inline-block px-4 py-1.5 rounded-lg bg-[#FCFBF7] border border-[#DFD9CA] text-xs text-[#292D29] font-medium shadow-2xs">
                    Browse statement file
                  </div>
                </div>
              )}

              {/* Step 2: Recognition banner & Preview when file is present */}
              {file && preview && (
                <div className="space-y-4">
                  {/* Confidence Banner */}
                  {preview.is_confident ? (
                    <div className="p-4 rounded-xl bg-[#EEEBDD] border border-[#DFD9CA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#365844]/10 text-[#365844]">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#292D29] flex items-center gap-2">
                            <span>Format Recognized</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FCFBF7] text-[#365844] font-mono border border-[#DFD9CA]">
                              {Math.round(preview.confidence_score * 100)}% Confidence
                            </span>
                          </div>
                          <p className="text-xs text-[#606860] mt-0.5 font-sans">
                            {preview.confidence_reasons.join(' • ')}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleCommit}
                        disabled={importing}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap"
                      >
                        {importing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Importing ledger...</span>
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
                    <div className="p-3.5 rounded-xl bg-[#985324]/10 border border-[#985324]/20 text-[#985324] flex items-center gap-2 text-xs">
                      <HelpCircle className="w-4 h-4 shrink-0" />
                      <span>Some columns need your confirmation below before importing.</span>
                    </div>
                  )}

                  {/* File info bar */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F5EE] border border-[#DFD9CA]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#365844]" />
                      <span className="font-medium text-[#292D29]">{file.name}</span>
                      <span className="text-xs text-[#8A928A] font-mono">({preview.total_rows} rows found)</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowMappingManual(!showMappingManual)}
                        className="text-xs text-[#606860] hover:text-[#292D29] flex items-center gap-1 cursor-pointer"
                      >
                        <span>{showMappingManual ? 'Hide column mapping' : 'Inspect column mapping'}</span>
                        {showMappingManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { setFile(null); setPreview(null); }}
                        className="text-xs text-[#8A928A] hover:text-[#292D29] underline cursor-pointer"
                      >
                        Change file
                      </button>
                    </div>
                  </div>

                  {/* Manual Column Mapping Section (Collapsible) */}
                  {showMappingManual && (
                    <div className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFD9CA] space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-[#292D29] uppercase tracking-wider font-mono">
                          Column Mapping Inspection
                        </h4>
                        <span className="text-[11px] text-[#8A928A]">Auto-detected from CSV headers</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block text-[#606860] mb-1 font-mono">Date Column *</label>
                          <select
                            value={mapping.date || ''}
                            onChange={(e) => handleRemap({ ...mapping, date: e.target.value })}
                            className="w-full bg-[#FCFBF7] border border-[#DFD9CA] rounded-lg px-2.5 py-1.5 text-[#292D29] focus:outline-none focus:border-[#365844]"
                          >
                            <option value="">-- Select --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[#606860] mb-1 font-mono">Description / Payee *</label>
                          <select
                            value={mapping.description || ''}
                            onChange={(e) => handleRemap({ ...mapping, description: e.target.value })}
                            className="w-full bg-[#FCFBF7] border border-[#DFD9CA] rounded-lg px-2.5 py-1.5 text-[#292D29] focus:outline-none focus:border-[#365844]"
                          >
                            <option value="">-- Select --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[#606860] mb-1 font-mono">Amount Column *</label>
                          <select
                            value={mapping.amount || ''}
                            onChange={(e) => handleRemap({ ...mapping, amount: e.target.value })}
                            className="w-full bg-[#FCFBF7] border border-[#DFD9CA] rounded-lg px-2.5 py-1.5 text-[#292D29] focus:outline-none focus:border-[#365844]"
                          >
                            <option value="">-- Select --</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[#606860] mb-1 font-mono">Direction / Type (Optional)</label>
                          <select
                            value={mapping.type || ''}
                            onChange={(e) => handleRemap({ ...mapping, type: e.target.value })}
                            className="w-full bg-[#FCFBF7] border border-[#DFD9CA] rounded-lg px-2.5 py-1.5 text-[#292D29] focus:outline-none focus:border-[#365844]"
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
                    <div className="p-2.5 rounded-lg bg-[#F7F5EE] border border-[#DFD9CA]">
                      <div className="text-[#8A928A] font-mono">Rows Scanned</div>
                      <div className="font-semibold text-[#292D29] mt-0.5 font-mono">{preview.total_rows}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F7F5EE] border border-[#365844]/30">
                      <div className="text-[#365844] font-mono">Valid Rows</div>
                      <div className="font-semibold text-[#365844] mt-0.5 font-mono">{preview.valid_count}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F7F5EE] border border-[#C85A32]/30">
                      <div className="text-[#C85A32] font-mono">Incomplete / Errors</div>
                      <div className="font-semibold text-[#C85A32] mt-0.5 font-mono">{preview.error_count}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F7F5EE] border border-[#DFD9CA]">
                      <div className="text-[#606860] font-mono">Ambiguous</div>
                      <div className="font-semibold text-[#606860] mt-0.5 font-mono">{preview.ambiguous_count}</div>
                    </div>
                  </div>

                  {/* Preview Rows Table */}
                  <div className="border border-[#DFD9CA] rounded-xl overflow-hidden bg-[#FCFBF7]">
                    <div className="px-4 py-2 bg-[#EEEBDD] border-b border-[#DFD9CA] flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#292D29] font-mono">Parsed Preview (First {preview.preview_rows.length} rows)</span>
                      {preview.detected_date_range && (
                        <span className="text-[11px] text-[#606860] font-mono">
                          Date range: {preview.detected_date_range[0]} to {preview.detected_date_range[1]}
                        </span>
                      )}
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F7F5EE] text-[#606860] font-mono uppercase text-[10px] sticky top-0 border-b border-[#DFD9CA]">
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
                        <tbody className="divide-y divide-[#EEEBDD]">
                          {preview.preview_rows.map((row) => (
                            <tr key={row.row_index} className="hover:bg-[#F7F5EE]/70">
                              <td className="py-2 px-3 font-mono text-[#8A928A]">{row.row_index}</td>
                              <td className="py-2 px-3 font-mono text-[#606860]">{row.parsed_date || '—'}</td>
                              <td className="py-2 px-3 font-medium text-[#292D29]">{row.parsed_merchant || '—'}</td>
                              <td className="py-2 px-3 text-[#606860]">{row.parsed_category || '—'}</td>
                              <td className="py-2 px-3 text-right font-mono text-[#292D29] font-medium">
                                {row.parsed_amount ? `₹${row.parsed_amount.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2 px-3">
                                <span className="capitalize px-1.5 py-0.5 rounded text-[10px] bg-[#EEEBDD] text-[#606860] font-mono">
                                  {row.parsed_type || '—'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {row.status === 'valid' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[#365844]">
                                    <CheckCircle2 className="w-3 h-3" /> Valid
                                  </span>
                                )}
                                {row.status === 'ambiguous' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[#985324]" title={row.error_message}>
                                    <HelpCircle className="w-3 h-3" /> Ambiguous
                                  </span>
                                )}
                                {row.status === 'error' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[#C85A32]" title={row.error_message}>
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
          <div className="px-6 py-4 border-t border-[#DFD9CA] bg-[#F7F5EE] flex items-center justify-between">
            <div className="text-xs text-[#606860] font-mono">
              {preview?.valid_count ? `${preview.valid_count} valid records ready to commit` : 'Awaiting statement file'}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#606860] hover:text-[#292D29] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                disabled={!file || !preview || preview.valid_count === 0 || importing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#365844] hover:bg-[#2c4737] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs shadow-sm transition-all cursor-pointer"
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
