export interface WorkspaceEvaluationOptions {
  workspaceMode: 'personal' | 'demo';
  user?: { id?: string | null } | null;
  userId?: string | null;
  isSessionResolved: boolean;
  deploymentMode?: string;
}

/**
 * Authoritatively determines whether the current active workspace is read-only.
 *
 * Requirements:
 * 1. During initial session loading (!isSessionResolved), fails closed (returns true)
 *    to prevent briefly displaying the wrong controls or firing mutations before the session token is verified.
 * 2. When the user is viewing the synthetic demo workspace ('demo'), returns true.
 *    Shared synthetic demo data is strictly read-only.
 * 3. In personal workspaces ('personal'):
 *    - In local development mode (deploymentMode === 'local'), returns false (unrestricted local SQLite).
 *    - In hosted environments, returns false if an authenticated user session is resolved (userId is present).
 *    - If unauthenticated in hosted mode, returns true (must authenticate first).
 */
export function isReadOnlyWorkspace(opts: WorkspaceEvaluationOptions): boolean {
  if (!opts.isSessionResolved) {
    return true;
  }
  if (opts.workspaceMode === 'demo') {
    return true;
  }
  if (opts.workspaceMode === 'personal') {
    if (opts.deploymentMode === 'local') {
      return false;
    }
    const hasUser = Boolean(opts.userId || opts.user?.id);
    return !hasUser;
  }
  return true;
}

/**
 * Legacy / Presentation-only helper: determines if the deployment environment defaults
 * to a public showcase presentation for unauthenticated first-time visitors.
 * 
 * NOTE: This must NOT be used to decide if an authenticated user's workspace is read-only.
 * Use `isReadOnlyWorkspace` or `useStatement().isReadOnly` instead.
 */
export function isPublicDemoUI(healthDemoMode?: boolean, deploymentMode?: string): boolean {
  if (process.env.NEXT_PUBLIC_USUALLY_PUBLIC_DEMO === 'true') {
    return true;
  }
  if (deploymentMode === 'public_demo') {
    return true;
  }
  return Boolean(healthDemoMode);
}
