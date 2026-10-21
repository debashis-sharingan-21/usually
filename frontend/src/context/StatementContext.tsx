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
  clearAllData,
  fetchMe,
  createGuestWorkspace,
  registerUser as apiRegister,
  loginUser as apiLogin,
  logoutUser as apiLogout,
  deleteWorkspace as apiDeleteWorkspace,
  getStoredToken,
  clearStoredToken,
  getActiveWorkspaceContext,
  setActiveWorkspaceContext,
} from '@/api/client';
import { isReadOnlyWorkspace } from '@/lib/demo';
import type {
  SystemHealthResponse,
  SpendingSummaryResponse,
  HabitObservation,
  PayeeQuestion,
  CSVImportResult
} from '@/types';

export interface UserState {
  id: string;
  email?: string | null;
  is_guest: boolean;
  workspace_type: string;
}

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
  user: UserState | null;
  workspaceMode: 'personal' | 'demo';
  isReadOnly: boolean;
  isSessionResolved: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  setIsImportOpen: (open: boolean) => void;
  loadAll: () => Promise<void>;
  handleToneChange: (tone: 'playful' | 'dry' | 'minimal') => Promise<void>;
  handleSwitchContext: (targetContext: 'personal' | 'demo') => Promise<void>;
  handleLoadDemo: () => Promise<void>;
  handleClearData: () => Promise<void>;
  handleImportSuccess: (result: CSVImportResult) => Promise<void>;
  startGuestWorkspace: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteCurrentWorkspace: () => Promise<void>;
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserState | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<'personal' | 'demo'>('demo');
  const [isSessionResolved, setIsSessionResolved] = useState(false);
  const isFetchingRef = useRef(false);

  // Initialize session and workspace state on client mount
  useEffect(() => {
    const initSession = async () => {
      const storedCtx = getActiveWorkspaceContext();
      setWorkspaceMode(storedCtx);

      const token = getStoredToken();
      if (token) {
        try {
          const me = await fetchMe();
          if (me.user_id) {
            setUser({
              id: me.user_id,
              email: me.email,
              is_guest: me.is_guest,
              workspace_type: me.workspace_type
            });
            if (storedCtx === 'personal' || me.workspace_type === 'personal') {
              setWorkspaceMode('personal');
            }
          } else {
            setUser(null);
            clearStoredToken();
          }
        } catch {
          // Token expired or invalid
          setUser(null);
          clearStoredToken();
        }
      } else {
        setUser(null);
      }
      setIsSessionResolved(true);
    };
    initSession();
  }, []);

  const isReadOnly = isReadOnlyWorkspace({
    workspaceMode,
    user,
    isSessionResolved,
    deploymentMode: health?.deployment_mode,
  });

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
        if (hRes.value.active_context === 'demo' || hRes.value.active_context === 'personal') {
          setWorkspaceMode(hRes.value.active_context);
        }
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

  const startGuestWorkspace = async () => {
    try {
      setLoading(true);
      const res = await createGuestWorkspace();
      setUser({
        id: res.user.id,
        email: null,
        is_guest: true,
        workspace_type: 'personal'
      });
      setWorkspaceMode('personal');
      setActiveWorkspaceContext('personal');
      setIsSessionResolved(true);
      await loadAll();
    } catch (e) {
      console.error('Failed to create guest workspace:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const res = await apiLogin(email, password);
      setUser({
        id: res.user.id,
        email: res.user.email,
        is_guest: false,
        workspace_type: 'personal'
      });
      setWorkspaceMode('personal');
      setActiveWorkspaceContext('personal');
      setIsSessionResolved(true);
      await loadAll();
    } catch (e) {
      console.error('Login error:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    try {
      setLoading(true);
      const res = await apiRegister(email, password);
      setUser({
        id: res.user.id,
        email: res.user.email,
        is_guest: false,
        workspace_type: 'personal'
      });
      setWorkspaceMode('personal');
      setActiveWorkspaceContext('personal');
      setIsSessionResolved(true);
      await loadAll();
    } catch (e) {
      console.error('Registration error:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await apiLogout();
      setUser(null);
      setWorkspaceMode('demo');
      setActiveWorkspaceContext('demo');
      setIsSessionResolved(true);
      await loadAll();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setLoading(false);
    }
  };

  const deleteCurrentWorkspace = async () => {
    if (window.confirm('Are you sure you want to permanently delete your private workspace and all associated statement records? This cannot be undone.')) {
      try {
        setLoading(true);
        await apiDeleteWorkspace();
        setUser(null);
        setWorkspaceMode('demo');
        setActiveWorkspaceContext('demo');
        setIsSessionResolved(true);
        await loadAll();
      } catch (e) {
        console.error('Delete workspace error:', e);
      } finally {
        setLoading(false);
      }
    }
  };

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
      setLoading(true);
      setSummary(null);
      setNotifications([]);
      setHabits([]);
      setQuestions([]);
      setLoadErrors({});

      if (targetContext === 'personal' && !getStoredToken()) {
        // If switching to personal without an existing session, auto-provision guest workspace
        await startGuestWorkspace();
        return;
      }

      setWorkspaceMode(targetContext);
      setActiveWorkspaceContext(targetContext);
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
      setWorkspaceMode('demo');
      setActiveWorkspaceContext('demo');
      await seedDemoData();
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear transactions and habits in your current workspace?')) {
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
        user,
        workspaceMode,
        isReadOnly,
        isSessionResolved,
        isAuthModalOpen,
        setIsAuthModalOpen,
        setIsImportOpen,
        loadAll,
        handleToneChange,
        handleSwitchContext,
        handleLoadDemo,
        handleClearData,
        handleImportSuccess,
        startGuestWorkspace,
        login,
        register,
        logout,
        deleteCurrentWorkspace
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
