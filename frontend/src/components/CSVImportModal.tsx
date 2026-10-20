"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { previewCSV, importCSV } from '../api/client';
import type { CSVPreviewResponse, CSVImportResult } from '../types';
import { SlothMascot } from './SlothMascot';

export type ImportModalStatus =
  | 'idle'
  | 'previewing'
  | 'preview_ready'
  | 'preview_error'
  | 'importing'
  | 'import_error'
  | 'success';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: CSVImportResult) => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [status, setStatus] = useState<ImportModalStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<CSVPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [currency] = useState('INR');
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'backend_unavailable' | 'invalid_csv' | 'empty_file' | 'general' | null>(null);
  const [showMappingManual, setShowMappingManual] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef<number>(0);

  // Clean state reset helper
  const resetToIdle = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setFile(null);
    setPreview(null);
    setMapping({});
    setImportResult(null);
    setErrorMsg(null);
    setErrorType(null);
    setShowMappingManual(false);
    setStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Safe reset when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    } else {
      // If reopening after an error or after successful completion, reset to clean idle state
      if (status === 'success' || status === 'preview_error') {
        resetToIdle();
      }
    }
  }, [isOpen, status, resetToIdle]);

  if (!isOpen) return null;

  const runPreview = async (selectedFile: File, userMapping?: Record<string, string>) => {
    const currentRequestId = ++latestRequestIdRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus('previewing');
    setErrorMsg(null);
    setErrorType(null);

    try {
      const res = await previewCSV(selectedFile, userMapping, abortController.signal);
      if (currentRequestId !== latestRequestIdRef.current) {
        return; // Stale request response ignored
      }
      setPreview(res);
      setMapping(res.suggested_mapping);
      setShowMappingManual(!res.is_confident);
      setStatus('preview_ready');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (currentRequestId !== latestRequestIdRef.current) return;

      const rawMsg = err.message || 'Failed to inspect CSV file';
      setErrorMsg(rawMsg);

      if (rawMsg.includes('Unable to reach') || rawMsg.includes('Failed to fetch') || rawMsg.includes('connect')) {
        setErrorType('backend_unavailable');
      } else if (rawMsg.includes('header') || rawMsg.includes('parse') || rawMsg.includes('Date column')) {
        setErrorType('invalid_csv');
      } else {
        setErrorType('general');
      }
      setStatus('preview_error');
    }
  };

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Please select a valid .csv statement export file.');
      setErrorType('invalid_csv');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (selectedFile.size === 0) {
      setFile(selectedFile);
      setErrorMsg('The selected CSV file is empty (0 bytes). Please select a statement with transaction rows.');
      setErrorType('empty_file');
      setStatus('preview_error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(selectedFile);
    setPreview(null);
    setImportResult(null);

    // Reset input value so re-selecting the exact same file in future triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    await runPreview(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRetryPreview = async () => {
    if (!file) return;
    await runPreview(file, Object.keys(mapping).length > 0 ? mapping : undefined);
  };

  const handleRemap = async (newMapping: Record<string, string>) => {
    setMapping(newMapping);
    if (!file) return;
    await runPreview(file, newMapping);
  };

  const handleCommit = async () => {
    if (!file || !preview || preview.valid_count === 0) return;

    const currentRequestId = ++latestRequestIdRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus('importing');
    setErrorMsg(null);
    setErrorType(null);

    try {
      const res = await importCSV(file, mapping, currency, abortController.signal);
      if (currentRequestId !== latestRequestIdRef.current) return;
      setImportResult(res);
      setStatus('success');
      onImportSuccess(res);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (currentRequestId !== latestRequestIdRef.current) return;
      setErrorMsg(err.message || 'Failed to import transactions');
      setStatus('import_error');
    }
  };

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (status === 'success' || status === 'preview_error') {
      resetToIdle();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      {/* Hidden file input maintained in DOM across all states */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

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
              <h2 id="import-modal-title" className="font-serif text-xl font-normal text-[#292D29]">
                Effortless Statement Import
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-[#8A928A] hover:text-[#292D29] rounded-lg hover:bg-[#EEEBDD] transition-colors cursor-pointer"
            aria-label="Close import dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm bg-[#FCFBF7]">
          
          {/* STATE 1: SUCCESS RESULT */}
          {status === 'success' && importResult && (
            <div className="space-y-5 py-4 text-center animate-fade-in">
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

              <div className="pt-3">
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-sm transition-all btn-tactile cursor-pointer"
                >
                  Done & View Insights
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: PREVIEW ERROR / RECOVERABLE ERROR CARD */}
          {(status === 'preview_error' || status === 'import_error') && (
            <div className="p-5 rounded-2xl bg-[#FCFBF7] border border-[#C85A32]/30 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-[#C85A32]/10 text-[#C85A32] shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="font-serif text-lg font-normal text-[#292D29]">
                    {errorType === 'backend_unavailable'
                      ? "Couldn't connect to local backend"
                      : errorType === 'empty_file'
                      ? "Empty statement file"
                      : "Couldn't read this statement"}
                  </h3>
                  <p className="text-xs text-[#606860] leading-relaxed font-sans">
                    {errorMsg || 'The preview request failed.'}
                  </p>
                  <p className="text-[11px] text-[#8A928A] font-mono">
                    Your file has not been imported. No transactions were written to your database.
                  </p>
                </div>
              </div>

              {/* Recovery Actions: Retry preview · Choose another file */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#DFD9CA]/60">
                {file && status === 'preview_error' && (
                  <button
                    onClick={handleRetryPreview}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-2xs btn-tactile cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry preview</span>
                  </button>
                )}
                {file && status === 'import_error' && (
                  <button
                    onClick={handleCommit}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-2xs btn-tactile cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry import</span>
                  </button>
                )}
                <button
                  onClick={resetToIdle}
                  className="px-4 py-2 rounded-xl bg-[#FCFBF7] hover:bg-[#EEEBDD] border border-[#DFD9CA] text-[#292D29] font-medium text-xs btn-tactile cursor-pointer"
                >
                  Choose another file
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: DROPZONE (When idle or no file selected) */}
          {status === 'idle' && (
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

          {/* STATE 4: PREVIEWING (Loading Spinner) */}
          {status === 'previewing' && file && (
            <div className="p-10 rounded-2xl bg-[#F7F5EE] border border-[#DFD9CA] text-center space-y-4 animate-fade-in">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#EEEBDD] border border-[#DFD9CA] flex items-center justify-center text-[#365844]">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-normal text-[#292D29]">
                  Analyzing Statement: {file.name}
                </h3>
                <p className="text-xs text-[#606860] font-sans">
                  Recognizing columns, header rows, debit/credit flow, and recurring counterparties...
                </p>
              </div>
            </div>
          )}

          {/* STATE 5: PREVIEW READY (Confidence Banner, File Bar, Table, Mapping) */}
          {(status === 'preview_ready' || status === 'importing') && file && preview && (
            <div className="space-y-4 animate-fade-in">
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
                    disabled={status === 'importing' || preview.valid_count === 0}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-sm transition-all btn-tactile cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    {status === 'importing' ? (
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

              {/* File Info Bar */}
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
                    onClick={resetToIdle}
                    className="text-xs text-[#8A928A] hover:text-[#292D29] underline cursor-pointer"
                  >
                    Change file
                  </button>
                </div>
              </div>

              {/* Manual Column Mapping Section (Collapsible) */}
              {showMappingManual && (
                <div className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFD9CA] space-y-3 animate-fade-in">
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
                  <span className="text-xs font-semibold text-[#292D29] font-mono">
                    Parsed Preview (First {preview.preview_rows.length} rows)
                  </span>
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
        </div>

        {/* Footer */}
        {status !== 'success' && (
          <div className="px-6 py-4 border-t border-[#DFD9CA] bg-[#F7F5EE] flex items-center justify-between">
            <div className="text-xs text-[#606860] font-mono">
              {status === 'previewing'
                ? 'Analyzing statement format...'
                : status === 'preview_ready'
                ? `${preview?.valid_count ?? 0} valid records ready to commit`
                : status === 'preview_error'
                ? 'Preview failed • Ready to retry or select another file'
                : 'Awaiting statement file'}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#606860] hover:text-[#292D29] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                disabled={status !== 'preview_ready' || !preview || preview.valid_count === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#365844] hover:bg-[#2c4737] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs shadow-sm transition-all btn-tactile cursor-pointer"
              >
                {status === 'importing' ? (
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
