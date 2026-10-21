/**
 * Determines whether the frontend is running in public demo mode.
 * Evaluates both the explicit build-time flag (NEXT_PUBLIC_USUALLY_PUBLIC_DEMO)
 * and the runtime backend health response.
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
