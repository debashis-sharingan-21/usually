/**
 * Constants and helpers for the Usually "About" story experience.
 */

export const ABOUT_CONTENT = {
  title: "The Story Behind Usually",
  philosophy: "Automate the routine, ask about the ambiguous, remember the answer.",
  sections: [
    "The Idea",
    "How It Works (6-Step Workflow)",
    "AI, Without the Hype",
    "Privacy and Control",
    "Open Source"
  ],
  workflowSteps: [
    "01 · Import Statement",
    "02 · Deterministic Logic",
    "03 · Home Briefing",
    "04 · Financial Analysis",
    "05 · Verified Ledger",
    "06 · Review & Remember"
  ],
  links: {
    github: "https://github.com/debashis-sharingan-21/usually",
    liveApp: "https://usually-tau.vercel.app/"
  },
  terminology: {
    home: "Home: your financial briefing.",
    analysis: "Analysis: your spending patterns and historical context.",
    transactions: "Transactions: your verified and editable ledger.",
    gemma: "Gemma: selected AI-assisted interpretations.",
    deterministic: "Deterministic engine: accounting, validation, and fallback."
  }
} as const;

export function validateAboutContent(): boolean {
  if (!ABOUT_CONTENT.title || ABOUT_CONTENT.title !== "The Story Behind Usually") {
    return false;
  }
  if (!ABOUT_CONTENT.philosophy.includes("Automate the routine")) {
    return false;
  }
  if (ABOUT_CONTENT.workflowSteps.length !== 6) {
    return false;
  }
  if (!ABOUT_CONTENT.links.github.startsWith("https://github.com/")) {
    return false;
  }
  if (!ABOUT_CONTENT.links.liveApp.startsWith("https://")) {
    return false;
  }
  return true;
}

export interface NotebookIndexItem {
  readonly number: string;
  readonly label: string;
  readonly type: 'link' | 'modal';
  readonly target: string;
  readonly ariaLabel: string;
}

export const NOTEBOOK_INDEX_ITEMS: readonly NotebookIndexItem[] = [
  { number: '01', label: 'Home Briefing', type: 'link', target: '/', ariaLabel: 'Home Briefing' },
  { number: '02', label: 'Financial Analysis', type: 'link', target: '/analysis', ariaLabel: 'Financial Analysis' },
  { number: '03', label: 'Verified Ledger', type: 'link', target: '/transactions', ariaLabel: 'Verified Ledger' },
  { number: '04', label: 'About', type: 'modal', target: 'about', ariaLabel: 'About Usually' },
  { number: '05', label: 'Import Statement', type: 'modal', target: 'import', ariaLabel: 'Import Statement' },
] as const;

export function validateNotebookIndex(): boolean {
  if (NOTEBOOK_INDEX_ITEMS.length !== 5) return false;
  if (NOTEBOOK_INDEX_ITEMS[0].number !== '01' || NOTEBOOK_INDEX_ITEMS[0].target !== '/') return false;
  if (NOTEBOOK_INDEX_ITEMS[1].number !== '02' || NOTEBOOK_INDEX_ITEMS[1].target !== '/analysis') return false;
  if (NOTEBOOK_INDEX_ITEMS[2].number !== '03' || NOTEBOOK_INDEX_ITEMS[2].target !== '/transactions') return false;
  if (NOTEBOOK_INDEX_ITEMS[3].number !== '04' || NOTEBOOK_INDEX_ITEMS[3].target !== 'about') return false;
  if (NOTEBOOK_INDEX_ITEMS[4].number !== '05' || NOTEBOOK_INDEX_ITEMS[4].target !== 'import') return false;
  return true;
}
