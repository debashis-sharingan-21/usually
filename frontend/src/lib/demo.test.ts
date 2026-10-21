import { isReadOnlyWorkspace } from './demo.ts';
import assert from 'node:assert';
import test from 'node:test';

test('isReadOnlyWorkspace fails closed during initial session loading', () => {
  const result = isReadOnlyWorkspace({
    workspaceMode: 'personal',
    userId: 'usr_123',
    isSessionResolved: false,
    deploymentMode: 'public_demo'
  });
  assert.strictEqual(result, true);
});

test('isReadOnlyWorkspace returns true for synthetic demo workspace', () => {
  const result = isReadOnlyWorkspace({
    workspaceMode: 'demo',
    userId: 'usr_123',
    isSessionResolved: true,
    deploymentMode: 'public_demo'
  });
  assert.strictEqual(result, true);
});

test('isReadOnlyWorkspace allows editing in personal workspace even when deployment_mode is public_demo', () => {
  // This was the exact bug: deploymentMode === 'public_demo' forced personal workspaces into read-only
  const result = isReadOnlyWorkspace({
    workspaceMode: 'personal',
    userId: 'usr_123',
    isSessionResolved: true,
    deploymentMode: 'public_demo'
  });
  assert.strictEqual(result, false);
});

test('isReadOnlyWorkspace allows editing in local dev mode without login', () => {
  const result = isReadOnlyWorkspace({
    workspaceMode: 'personal',
    userId: null,
    isSessionResolved: true,
    deploymentMode: 'local'
  });
  assert.strictEqual(result, false);
});

test('isReadOnlyWorkspace blocks unauthenticated personal mutations in hosted mode', () => {
  const result = isReadOnlyWorkspace({
    workspaceMode: 'personal',
    userId: null,
    isSessionResolved: true,
    deploymentMode: 'public_demo'
  });
  assert.strictEqual(result, true);
});
