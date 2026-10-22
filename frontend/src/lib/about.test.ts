import { ABOUT_CONTENT, validateAboutContent } from './about.ts';
import assert from 'node:assert';
import test from 'node:test';

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
