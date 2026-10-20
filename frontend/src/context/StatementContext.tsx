"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchHealth,
  fetchSummary,
  fetchNotifications,
  fetchHabits,
  fetchQuestions,
  updateTone,
  switchContext,
  seedDemoData,
  clearAllData
} from '@/api/client';
import type {
  SystemHealthResponse,
  SpendingSummaryResponse,
  HabitObservation,
  PayeeQuestion,
  CSVImportResult
} from '@/types';

interface StatementContextType {
  health: SystemHealthResponse | null;
  summary: SpendingSummaryResponse | null;
  notifications: HabitObservation[];
  habits: HabitObservation[];
  questions: PayeeQuestion[];
  loading: boolean;
  loadErrors: Record<string, string>;
  isImportOpen: boolean;
  isDemoLoading: boolean;
  setIsImportOpen: (open: boolean) => void;
  loadAll: () => Promise<void>;
  handleToneChange: (tone: 'playful' | 'dry' | 'minimal') => Promise<void>;
  handleSwitchContext: (targetContext: 'personal' | 'demo') => Promise<void>;
  handleLoadDemo: () => Promise<void>;
  handleClearData: () => Promise<void>;
  handleImportSuccess: (result: CSVImportResult) => Promise<void>;
}

const StatementContext = createContext<StatementContextType | undefined>(undefined);

export const StatementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [summary, setSummary] = useState<SpendingSummaryResponse | null>(null);
  const [notifications, setNotifications] = useState<HabitObservation[]>([]);
  const [habits, setHabits] = useState<HabitObservation[]>([]);
  const [questions, setQuestions] = useState<PayeeQuestion[]>([]);
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);

  const loadAll = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [hRes, sRes, nRes, habRes, qRes] = await Promise.allSettled([
        fetchHealth(),
        fetchSummary(),
        fetchNotifications(),
        fetchHabits(),
        fetchQuestions(),
      ]);

      const errors: Record<string, string> = {};

      if (hRes.status === 'fulfilled') {
        setHealth(hRes.value);
      } else {
        errors.health = hRes.reason?.message || 'Failed to fetch health';
      }

      if (sRes.status === 'fulfilled') {
        setSummary(sRes.value);
      } else {
        errors.summary = sRes.reason?.message || 'Failed to fetch summary';
      }

      if (nRes.status === 'fulfilled') {
        setNotifications(nRes.value);
      } else {
        errors.notifications = nRes.reason?.message || 'Failed to fetch notifications';
        console.warn('Notifications request failed:', nRes.reason);
      }

      if (habRes.status === 'fulfilled') {
        setHabits(habRes.value);
      } else {
        errors.habits = habRes.reason?.message || 'Failed to fetch habits';
      }

      if (qRes.status === 'fulfilled') {
        setQuestions(qRes.value);
      } else {
        errors.questions = qRes.reason?.message || 'Failed to fetch questions';
      }

      setLoadErrors(errors);
    } catch (e) {
      console.error('Unexpected error loading application data:', e);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleToneChange = async (tone: 'playful' | 'dry' | 'minimal') => {
    try {
      await updateTone(tone);
      await loadAll();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSwitchContext = async (targetContext: 'personal' | 'demo') => {
    try {
      // Clear data partition immediately to avoid stale cross-context state
      setLoading(true);
      setSummary(null);
      setNotifications([]);
      setHabits([]);
      setQuestions([]);
      setLoadErrors({});
      await switchContext(targetContext);
      await loadAll();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsDemoLoading(true);
    try {
      setLoading(true);
      setSummary(null);
      setNotifications([]);
      setHabits([]);
      setQuestions([]);
      await seedDemoData();
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to delete all transactions and habits from local storage?')) {
      try {
        setLoading(true);
        setSummary(null);
        setNotifications([]);
        setHabits([]);
        setQuestions([]);
        await clearAllData();
        await loadAll();
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    }
  };

  const handleImportSuccess = async (_result: CSVImportResult) => {
    await loadAll();
  };

  return (
    <StatementContext.Provider
      value={{
        health,
        summary,
        notifications,
        habits,
        questions,
        loading,
        loadErrors,
        isImportOpen,
        isDemoLoading,
        setIsImportOpen,
        loadAll,
        handleToneChange,
        handleSwitchContext,
        handleLoadDemo,
        handleClearData,
        handleImportSuccess
      }}
    >
      {children}
    </StatementContext.Provider>
  );
};

export const useStatement = (): StatementContextType => {
  const context = useContext(StatementContext);
  if (!context) {
    throw new Error('useStatement must be used within a StatementProvider');
  }
  return context;
};
