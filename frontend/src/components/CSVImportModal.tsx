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
  FolderOpen,
  ShieldCheck
} from 'lucide-react';
import { previewCSV, importCSV } from '../api/client';
import type { CSVPreviewResponse, CSVImportResult } from '../types';
import { SlothMascot } from './SlothMascot';
import { useStatement } from '@/context/StatementContext';
import { isPublicDemoUI } from '@/lib/demo';

export type SelectionStatus =
  | 'idle'
  | 'previewing'
  | 'preview_ready'
  | 'preview_error'
  | 'importing'
  | 'import_error'
  | 'success';

export interface AuthoritativeSelection {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  formattedSize: string;
  preview: CSVPreviewResponse | null;
  status: SelectionStatus;
}

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: CSVImportResult) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const { health } = useStatement();
  const isPublicDemo = isPublicDemoUI(health?.is_demo_mode, health?.deployment_mode);

  const [selection, setSelection] = useState<AuthoritativeSelection | null>(null);
  const activeSelectionRef = useRef<AuthoritativeSelection | null>(null);

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [currency] = useState('INR');
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'backend_unavailable' | 'invalid_csv' | 'empty_file' | 'general' | null>(null);
  const [showMappingManual, setShowMappingManual] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Key to force remounting a fresh native file input element on every reset/selection
  const [fileInputKey, setFileInputKey] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean state reset helper
  const resetToIdle = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    activeSelectionRef.current = null;
    setSelection(null);
    setMapping({});
    setImportResult(null);
    setErrorMsg(null);
    setErrorType(null);
    setShowMappingManual(false);
    setIsDragging(false);
    setFileInputKey((k) => k + 1);
  }, []);

  // Safe reset when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      resetToIdle();
    } else {
      // Always start fresh when modal opens
      resetToIdle();
    }
  }, [isOpen, resetToIdle]);

  if (!isOpen) return null;

  const currentStatus: SelectionStatus = selection?.status || 'idle';

  const runPreviewForSelection = async (
    targetSelection: AuthoritativeSelection,
    userMapping?: Record<string, string>
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const previewingSel: AuthoritativeSelection = {
      ...targetSelection,
      status: 'previewing',
      preview: null,
    };
    activeSelectionRef.current = previewingSel;
    setSelection(previewingSel);
    setErrorMsg(null);
    setErrorType(null);

    try {
      const res = await previewCSV(targetSelection.file, userMapping, abortController.signal);
      // Ensure obsolete requests from previous file selections are strictly dropped
      if (activeSelectionRef.current?.id !== targetSelection.id) {
        return;
      }

      const readySel: AuthoritativeSelection = {
        ...targetSelection,
        preview: res,
        status: 'preview_ready',
      };
      activeSelectionRef.current = readySel;
      setSelection(readySel);
      setMapping(res.suggested_mapping);
      setShowMappingManual(!res.is_confident);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (activeSelectionRef.current?.id !== targetSelection.id) return;

      const rawMsg = err.message || 'Failed to inspect CSV file';
      setErrorMsg(rawMsg);

      if (rawMsg.includes('Unable to reach') || rawMsg.includes('Failed to fetch') || rawMsg.includes('connect')) {
        setErrorType('backend_unavailable');
      } else if (rawMsg.includes('header') || rawMsg.includes('parse') || rawMsg.includes('Date column')) {
        setErrorType('invalid_csv');
      } else {
        setErrorType('general');
      }

      const errorSel: AuthoritativeSelection = {
        ...targetSelection,
        status: 'preview_error',
        preview: null,
      };
      activeSelectionRef.current = errorSel;
      setSelection(errorSel);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    // 1. Invalidate any in-flight requests immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Remount input so subsequent selections of same or new file always trigger native event
    setFileInputKey((k) => k + 1);

    // 3. Validate file extension
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      resetToIdle();
      setErrorMsg('Please select a valid .csv statement export file.');
      setErrorType('invalid_csv');
      return;
    }

    // 4. Validate non-empty file
    if (selectedFile.size === 0) {
      const emptySel: AuthoritativeSelection = {
        id: `sel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file: selectedFile,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        formattedSize: '0 B',
        preview: null,
        status: 'preview_error',
      };
      activeSelectionRef.current = emptySel;
      setSelection(emptySel);
      setErrorMsg('The selected CSV file is empty (0 bytes). Please select a statement with transaction rows.');
      setErrorType('empty_file');
      return;
    }

    // 5. Establish new authoritative selection
    const selectionId = `sel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newSelection: AuthoritativeSelection = {
      id: selectionId,
      file: selectedFile,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      formattedSize: formatFileSize(selectedFile.size),
      preview: null,
      status: 'previewing',
    };

    activeSelectionRef.current = newSelection;
    setSelection(newSelection);
    setMapping({});
    setImportResult(null);
    setErrorMsg(null);
    setErrorType(null);
    setShowMappingManual(false);

    // 6. Launch preview immediately bound to this exact selection
    await runPreviewForSelection(newSelection);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleRetryPreview = async () => {
    const currentSel = activeSelectionRef.current;
    if (!currentSel) return;
    await runPreviewForSelection(currentSel, Object.keys(mapping).length > 0 ? mapping : undefined);
  };

  const handleRemap = async (newMapping: Record<string, string>) => {
    setMapping(newMapping);
    const currentSel = activeSelectionRef.current;
    if (!currentSel) return;
    await runPreviewForSelection(currentSel, newMapping);
  };

  const handleCommit = async () => {
    const currentSel = activeSelectionRef.current;
    if (
      !currentSel ||
      currentSel.status !== 'preview_ready' ||
      !currentSel.preview ||
      currentSel.preview.valid_count === 0
    ) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const importingSel: AuthoritativeSelection = {
      ...currentSel,
      status: 'importing',
    };
    activeSelectionRef.current = importingSel;
    setSelection(importingSel);
    setErrorMsg(null);
    setErrorType(null);

    try {
      // Strictly pass currentSel.file, guaranteed to match currentSel.preview
      const res = await importCSV(currentSel.file, mapping, currency, abortController.signal);
      if (activeSelectionRef.current?.id !== currentSel.id) return;

      const successSel: AuthoritativeSelection = {
        ...currentSel,
        status: 'success',
      };
      activeSelectionRef.current = successSel;
      setSelection(successSel);
      setImportResult(res);
      onImportSuccess(res);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (activeSelectionRef.current?.id !== currentSel.id) return;

      setErrorMsg(err.message || 'Failed to import transactions');
      const errSel: AuthoritativeSelection = {
        ...currentSel,
        status: 'import_error',
      };
      activeSelectionRef.current = errSel;
      setSelection(errSel);
    }
  };

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    resetToIdle();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Fresh native file input remounted by fileInputKey */}
      <input
        key={fileInputKey}
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
      />

      <div
        className={`bg-[#FCFBF7] border rounded-2xl w-full max-w-4xl h-full max-h-[calc(100vh-2rem)] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden transition-all ${
          isDragging ? 'border-[#365844] ring-2 ring-[#365844]/30' : 'border-[#DFD9CA]'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
      >
        {/* Header */}
        <div className="shrink-0 px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#DFD9CA] flex items-center justify-between bg-[#F7F5EE]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#365844] font-semibold">
                  Statement Intake
                </span>
                {selection && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
                    {selection.fileName} ({selection.formattedSize})
                  </span>
                )}
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0 text-sm bg-[#FCFBF7]">
          {isPublicDemo ? (
            <div className="space-y-6 py-6 text-center animate-fade-in max-w-xl mx-auto">
              <div className="flex justify-center mb-1">
                <div className="p-4 rounded-2xl bg-[#EEEBDD] border border-[#DFD9CA]">
                  <SlothMascot mood="peaceful" size={64} />
                </div>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#365844] font-semibold">
                  Public Showcase • Read-Only
                </span>
                <h3 className="font-serif text-2xl font-normal text-[#292D29]">
                  Synthetic Data Demonstration
                </h3>
                <p className="text-xs text-[#606860] leading-relaxed font-sans">
                  This hosted deployment is a read-only demonstration running against a synthetic 6-month transaction dataset.
                  Statement uploads, parsing, and ledger modifications are disabled on this public server to ensure data isolation.
                </p>
              </div>

              <div className="p-4 bg-[#F7F5EE] rounded-xl border border-[#DFD9CA] text-xs text-left space-y-2">
                <div className="font-mono text-[11px] uppercase tracking-wider text-[#365844] font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#365844]" />
                  <span>Analyze Your Statements Privately with Local SQLite</span>
                </div>
                <p className="text-[11px] text-[#606860] leading-relaxed">
                  Usually is built as a local-first application. When you clone and run Usually on your personal computer,
                  all parsing, SQLite storage, and habit analysis stay 100% on your machine—no transaction data is ever sent to a server.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* STATE 1: SUCCESS RESULT */}
          {currentStatus === 'success' && importResult && selection && (
            <div className="space-y-5 py-4 text-center animate-fade-in">
              <div className="flex justify-center mb-1">
                <div className="p-3 rounded-2xl bg-[#EEEBDD] border border-[#DFD9CA]">
                  <SlothMascot mood="celebrating" size={64} />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-serif text-2xl font-normal text-[#292D29]">
                  Statement Processed Successfully
                </h3>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEEBDD] text-[#365844] text-xs font-mono border border-[#DFD9CA]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Imported file: {selection.fileName} ({selection.formattedSize})</span>
                </div>
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

              {/* Accounting Breakdown */}
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

                {((importResult.blank_rows_skipped !== undefined && importResult.blank_rows_skipped > 0) ||
                  (importResult.ignored_footer_rows !== undefined && importResult.ignored_footer_rows > 0)) && (
                  <div className="text-[10px] text-[#8A928A] pt-1 border-t border-[#DFD9CA] flex items-center gap-3">
                    {importResult.blank_rows_skipped !== undefined && importResult.blank_rows_skipped > 0 && (
                      <span>• {importResult.blank_rows_skipped} blank row(s) safely skipped</span>
                    )}
                    {importResult.ignored_footer_rows !== undefined && importResult.ignored_footer_rows > 0 && (
                      <span>• {importResult.ignored_footer_rows} footer notice(s) safely filtered</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STATE 2: PREVIEW ERROR / RECOVERABLE ERROR CARD */}
          {(currentStatus === 'preview_error' || currentStatus === 'import_error') && (
            <div className="p-5 rounded-2xl bg-[#FCFBF7] border border-[#C85A32]/30 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-[#C85A32]/10 text-[#C85A32] shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-normal text-[#292D29]">
                      {errorType === 'backend_unavailable'
                        ? "Couldn't connect to local backend"
                        : errorType === 'empty_file'
                        ? "Empty statement file"
                        : "Couldn't read this statement"}
                    </h3>
                    {selection && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#F7F5EE] text-[#8A928A] border border-[#DFD9CA]">
                        {selection.fileName} ({selection.formattedSize})
                      </span>
                    )}
                  </div>
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
                {selection && currentStatus === 'preview_error' && (
                  <button
                    onClick={handleRetryPreview}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-2xs btn-tactile cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry preview</span>
                  </button>
                )}
                {selection && currentStatus === 'import_error' && (
                  <button
                    onClick={handleCommit}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-2xs btn-tactile cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry import</span>
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FCFBF7] hover:bg-[#EEEBDD] border border-[#DFD9CA] text-[#292D29] font-medium text-xs btn-tactile cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#365844]" />
                  <span>Choose another file</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: DROPZONE (When idle or awaiting file selection) */}
          {currentStatus === 'idle' && (
            <div
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

          {/* STATE 4: PREVIEWING (Loading Spinner bound to selected file) */}
          {currentStatus === 'previewing' && selection && (
            <div className="p-10 rounded-2xl bg-[#F7F5EE] border border-[#DFD9CA] text-center space-y-4 animate-fade-in">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#EEEBDD] border border-[#DFD9CA] flex items-center justify-center text-[#365844]">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FCFBF7] border border-[#DFD9CA] text-xs font-mono text-[#365844]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{selection.fileName} ({selection.formattedSize})</span>
                </div>
                <h3 className="font-serif text-lg font-normal text-[#292D29] pt-1">
                  Analyzing Statement: {selection.fileName}
                </h3>
                <p className="text-xs text-[#606860] font-sans">
                  Recognizing columns, header rows, debit/credit flow, and recurring counterparties...
                </p>
              </div>
            </div>
          )}

          {/* STATE 5: PREVIEW READY (Confidence Banner, File Bar, Table, Mapping) */}
          {(currentStatus === 'preview_ready' || currentStatus === 'importing') && selection && selection.preview && (
            <div className="space-y-4 animate-fade-in">
              {/* Confidence Banner */}
              {selection.preview.is_confident ? (
                <div className="p-4 rounded-xl bg-[#EEEBDD] border border-[#DFD9CA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#365844]/10 text-[#365844]">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#292D29] flex items-center gap-2">
                        <span>Format Recognized</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FCFBF7] text-[#365844] font-mono border border-[#DFD9CA]">
                          {Math.round(selection.preview.confidence_score * 100)}% Confidence
                        </span>
                      </div>
                      <p className="text-xs text-[#606860] mt-0.5 font-sans">
                        {selection.preview.confidence_reasons.join(' • ')}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleCommit}
                    disabled={currentStatus === 'importing' || selection.preview.valid_count === 0}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-sm transition-all btn-tactile cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    {currentStatus === 'importing' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Importing ledger...</span>
                      </>
                    ) : (
                      <>
                        <span>One-Click Import ({selection.preview.valid_count} rows)</span>
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

              {/* File Info Bar with Explicit File Details and Replace Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-[#F7F5EE] border border-[#DFD9CA] gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-[#EEEBDD] text-[#365844] border border-[#DFD9CA]">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#292D29] text-xs">{selection.fileName}</span>
                      <span className="text-[11px] text-[#8A928A] font-mono">({selection.formattedSize})</span>
                    </div>
                    <div className="text-[11px] text-[#365844] font-mono">
                      Preview ready · {selection.preview.valid_count} valid rows · {selection.preview.error_count} incomplete rows
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <button
                    onClick={() => setShowMappingManual(!showMappingManual)}
                    className="text-xs text-[#606860] hover:text-[#292D29] flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showMappingManual ? 'Hide mapping' : 'Inspect mapping'}</span>
                    {showMappingManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-[#365844] hover:text-[#2c4737] font-medium bg-[#FCFBF7] hover:bg-[#EEEBDD] px-2.5 py-1 rounded-lg border border-[#DFD9CA] transition-all cursor-pointer"
                    title="Choose a different CSV file"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Replace file</span>
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
                        {selection.preview.headers.map((h) => (
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
                        {selection.preview.headers.map((h) => (
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
                        {selection.preview.headers.map((h) => (
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
                        {selection.preview.headers.map((h) => (
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
                  <div className="font-semibold text-[#292D29] mt-0.5 font-mono">{selection.preview.total_rows}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F7F5EE] border border-[#365844]/30">
                  <div className="text-[#365844] font-mono">Valid Rows</div>
                  <div className="font-semibold text-[#365844] mt-0.5 font-mono">{selection.preview.valid_count}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F7F5EE] border border-[#C85A32]/30">
                  <div className="text-[#C85A32] font-mono">Incomplete / Notice</div>
                  <div className="font-semibold text-[#C85A32] mt-0.5 font-mono">{selection.preview.error_count}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F7F5EE] border border-[#DFD9CA]">
                  <div className="text-[#606860] font-mono">Ambiguous</div>
                  <div className="font-semibold text-[#606860] mt-0.5 font-mono">{selection.preview.ambiguous_count}</div>
                </div>
              </div>

              {/* Preview Rows Table */}
              <div className="border border-[#DFD9CA] rounded-xl overflow-hidden bg-[#FCFBF7]">
                <div className="px-4 py-2 bg-[#EEEBDD] border-b border-[#DFD9CA] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#292D29] font-mono">
                    Parsed Preview (First {selection.preview.preview_rows.length} rows)
                  </span>
                  {selection.preview.detected_date_range && (
                    <span className="text-[11px] text-[#606860] font-mono">
                      Date range: {selection.preview.detected_date_range[0]} to {selection.preview.detected_date_range[1]}
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
                      {selection.preview.preview_rows.map((row) => (
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

    {/* Persistent Action Footer */}
    <div className="shrink-0 px-5 sm:px-6 py-3.5 sm:py-4 border-t border-[#DFD9CA] bg-[#F7F5EE] flex flex-col sm:flex-row items-center justify-between gap-3">
      {isPublicDemo ? (
        <>
          <div className="text-xs text-[#606860] font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E8C95D]" />
            <span>Public demo locked to synthetic dataset</span>
          </div>
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-sm transition-all btn-tactile cursor-pointer"
          >
            Explore Synthetic Ledger
          </button>
        </>
      ) : currentStatus === 'success' ? (
            <>
              <div className="text-xs text-[#365844] font-mono flex items-center gap-2 self-start sm:self-auto">
                <CheckCircle2 className="w-4 h-4 text-[#365844] shrink-0" />
                <span>
                  {importResult?.accepted_rows ?? 0} transactions accepted • Ledger updated
                </span>
              </div>
              <button
                onClick={handleClose}
                autoFocus
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#365844] hover:bg-[#2c4737] text-white font-medium text-xs shadow-sm transition-all btn-tactile cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#365844]/40"
              >
                <span>Done & View Insights</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <div className="text-xs text-[#606860] font-mono truncate max-w-md self-start sm:self-auto">
                {currentStatus === 'previewing' && selection
                  ? `Analyzing ${selection.fileName} (${selection.formattedSize})...`
                  : currentStatus === 'preview_ready' && selection?.preview
                  ? `${selection.preview.valid_count} valid records ready to commit from ${selection.fileName}`
                  : currentStatus === 'preview_error'
                  ? 'Preview failed • Ready to retry or select another file'
                  : 'Awaiting statement file'}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#606860] hover:text-[#292D29] hover:bg-[#EEEBDD] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommit}
                  disabled={currentStatus !== 'preview_ready' || !selection?.preview || selection.preview.valid_count === 0}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#365844] hover:bg-[#2c4737] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs shadow-sm transition-all btn-tactile cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#365844]/40"
                >
                  {currentStatus === 'importing' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Import {selection?.preview ? `(${selection.preview.valid_count} rows)` : ''}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
