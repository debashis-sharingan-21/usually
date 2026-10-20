"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [h, s, n, hab, q] = await Promise.all([
        fetchHealth(),
        fetchSummary(),
        fetchNotifications(),
        fetchHabits(),
        fetchQuestions(),
      ]);
      setHealth(h);
      setSummary(s);
      setNotifications(n);
      setHabits(hab);
      setQuestions(q);
    } catch (e) {
      console.error('Failed to load application data:', e);
    } finally {
      setLoading(false);
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
      await switchContext(targetContext);
      await loadAll();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoadDemo = async () => {
    setIsDemoLoading(true);
    try {
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
        await clearAllData();
        await loadAll();
      } catch (e) {
        console.error(e);
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
