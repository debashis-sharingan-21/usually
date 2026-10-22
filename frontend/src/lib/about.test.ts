import { ABOUT_CONTENT, validateAboutContent, NOTEBOOK_INDEX_ITEMS, validateNotebookIndex } from './about.ts';
import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const footerPath = path.resolve(__dirname, '../components/NotebookFooter.tsx');
const footerSource = fs.readFileSync(footerPath, 'utf-8');

test('About modal content validation passes', () => {
  assert.strictEqual(validateAboutContent(), true);
});

test('About modal contains all 5 required explanation sections', () => {
  const sections = ABOUT_CONTENT.sections;
  assert.strictEqual(sections.length, 5);
  assert.strictEqual(sections[0], 'The Idea');
  assert.strictEqual(sections[1], 'How It Works (6-Step Workflow)');
  assert.strictEqual(sections[2], 'AI, Without the Hype');
  assert.strictEqual(sections[3], 'Privacy and Control');
  assert.strictEqual(sections[4], 'Open Source');
});

test('About modal contains exact philosophy quote', () => {
  assert.strictEqual(
    ABOUT_CONTENT.philosophy,
    'Automate the routine, ask about the ambiguous, remember the answer.'
  );
});

test('About modal contains all 6 verified workflow steps in order', () => {
  const steps = ABOUT_CONTENT.workflowSteps;
  assert.strictEqual(steps.length, 6);
  assert.match(steps[0], /Import Statement/);
  assert.match(steps[1], /Deterministic Logic/);
  assert.match(steps[2], /Home Briefing/);
  assert.match(steps[3], /Financial Analysis/);
  assert.match(steps[4], /Verified Ledger/);
  assert.match(steps[5], /Review & Remember/);
});

test('About modal contains valid GitHub and live application links', () => {
  assert.strictEqual(
    ABOUT_CONTENT.links.github,
    'https://github.com/debashis-sharingan-21/usually'
  );
  assert.strictEqual(
    ABOUT_CONTENT.links.liveApp,
    'https://usually-tau.vercel.app/'
  );
});

test('About modal terminology matches demo guidelines', () => {
  assert.match(ABOUT_CONTENT.terminology.home, /financial briefing/i);
  assert.match(ABOUT_CONTENT.terminology.analysis, /spending patterns/i);
  assert.match(ABOUT_CONTENT.terminology.transactions, /verified and editable ledger/i);
  assert.match(ABOUT_CONTENT.terminology.gemma, /AI-assisted interpretations/i);
  assert.match(ABOUT_CONTENT.terminology.deterministic, /accounting, validation, and fallback/i);
});

test('Notebook Index contains all five entries in the correct order', () => {
  assert.strictEqual(validateNotebookIndex(), true);
  assert.strictEqual(NOTEBOOK_INDEX_ITEMS.length, 5);

  const numbers = NOTEBOOK_INDEX_ITEMS.map((item) => item.number);
  assert.deepStrictEqual(numbers, ['01', '02', '03', '04', '05']);

  const labels = NOTEBOOK_INDEX_ITEMS.map((item) => item.label);
  assert.deepStrictEqual(labels, [
    'Home Briefing',
    'Financial Analysis',
    'Verified Ledger',
    'About',
    'Import Statement'
  ]);
});

test('Notebook Index entry 04 targets About modal with accessible label', () => {
  const item04 = NOTEBOOK_INDEX_ITEMS[3];
  assert.strictEqual(item04.number, '04');
  assert.strictEqual(item04.label, 'About');
  assert.strictEqual(item04.type, 'modal');
  assert.strictEqual(item04.target, 'about');
  assert.strictEqual(item04.ariaLabel, 'About Usually');
});

test('Notebook Index entry 05 targets Import Statement modal', () => {
  const item05 = NOTEBOOK_INDEX_ITEMS[4];
  assert.strictEqual(item05.number, '05');
  assert.strictEqual(item05.label, 'Import Statement');
  assert.strictEqual(item05.type, 'modal');
  assert.strictEqual(item05.target, 'import');
  assert.strictEqual(item05.ariaLabel, 'Import Statement');
});

test('NotebookFooter source contains all five items in exact sequence', () => {
  const indexOrderRegex = /01[\s\S]*?Home Briefing[\s\S]*?02[\s\S]*?Financial Analysis[\s\S]*?03[\s\S]*?Verified Ledger[\s\S]*?04[\s\S]*?About[\s\S]*?05[\s\S]*?Import Statement/;
  assert.match(footerSource, indexOrderRegex);
});

test('NotebookFooter item 04 opens shared About modal via setIsAboutOpen(true)', () => {
  assert.match(
    footerSource,
    /04[\s\S]*?onClick=\{\(\)\s*=>\s*setIsAboutOpen\(true\)\}[\s\S]*?aria-haspopup="dialog"[\s\S]*?aria-expanded=\{isAboutOpen\}[\s\S]*?aria-label="About Usually"[\s\S]*?About/
  );
});

test('NotebookFooter preserves existing navigation links and Import Statement trigger at 05', () => {
  assert.match(footerSource, /href="\/"[\s\S]*?Home Briefing/);
  assert.match(footerSource, /href="\/analysis"[\s\S]*?Financial Analysis/);
  assert.match(footerSource, /href="\/transactions"[\s\S]*?Verified Ledger/);
  assert.match(footerSource, /05[\s\S]*?onClick=\{\(\)\s*=>\s*setIsImportOpen\(true\)\}[\s\S]*?Import Statement[\s\S]*?UploadCloud/);
});

test('NotebookFooter preserves keyboard accessibility and focus styles', () => {
  // Both button rows must be explicit buttons with keyboard focus rings
  const buttonFocusRegex = /focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-\[#365844\]/;
  assert.match(footerSource, buttonFocusRegex);
  assert.match(footerSource, /type="button"/);
});

test('NotebookFooter preserves notebook paper layout, p. 01 header, and tagline', () => {
  assert.match(footerSource, /aria-label="Notebook Index"/);
  assert.match(footerSource, /NOTEBOOK INDEX/);
  assert.match(footerSource, /p\. 01/);
  assert.match(footerSource, /&ldquo;Slow and steady\.&rdquo;/);
  assert.match(footerSource, /teach Usually once, remembered forever/);
  assert.match(footerSource, /Private SQLite workspace/);
});
