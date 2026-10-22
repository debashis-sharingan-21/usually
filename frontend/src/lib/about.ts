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
