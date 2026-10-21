import { useEffect, type RefObject, type DependencyList } from 'react';
import gsap from 'gsap';

/**
 * Checks whether the user has requested reduced motion.
 * Safely handles SSR and environments without window.matchMedia.
 */
export function isReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * React hook to manage GSAP animations scoped to a DOM container.
 *
 * Lifecycle guarantees:
 * 1. The GSAP context is created first and assigned before any animation callback runs.
 *    This completely eliminates Temporal Dead Zone (TDZ) ReferenceErrors (e.g. accessing `ctx` before initialization).
 * 2. Scoped selectors (`ctx.selector` or scoped querySelectors) are bound to `scopeRef.current`.
 * 3. On unmount or dependency change, `ctx.revert()` is called to reverse inline styles,
 *    halt active tweens, and prevent memory leaks / duplicate timelines in React Strict Mode.
 * 4. Respects `prefers-reduced-motion: reduce`.
 * 5. Exceptions inside animation callbacks are caught and logged so UI components never crash.
 */
export function useGsapContext(
  scopeRef: RefObject<HTMLElement | null>,
  animationFn: (ctx: gsap.Context) => void,
  deps: DependencyList = []
) {
  useEffect(() => {
    if (typeof window === 'undefined' || !scopeRef.current) return;
    if (isReducedMotion()) return;

    let ctx: gsap.Context | undefined;
    try {
      // 1. Create the GSAP context first, binding the DOM container as scope.
      ctx = gsap.context(() => {}, scopeRef.current);

      // 2. Add and execute the animation callback inside the context safely.
      // `ctx` is already assigned and fully initialized before `ctx.add()` runs.
      ctx.add((self) => {
        try {
          animationFn(self);
        } catch (err) {
          console.error('[Usually Motion] Error in GSAP animation callback:', err);
        }
      });
    } catch (err) {
      console.error('[Usually Motion] Error initializing GSAP context:', err);
    }

    return () => {
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Attaches a one-time IntersectionObserver to trigger a reveal when visible.
 * Returns an unmount cleanup function that disconnects the observer.
 */
export function observeViewportReveal(
  element: HTMLElement | null,
  onReveal: () => void,
  threshold = 0.15
): () => void {
  if (!element || typeof window === 'undefined') return () => {};

  if (isReducedMotion()) {
    onReveal();
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        observer.disconnect();
        onReveal();
      }
    },
    { threshold }
  );

  observer.observe(element);
  return () => observer.disconnect();
}
