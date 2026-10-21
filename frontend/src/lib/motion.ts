import { useEffect, type RefObject, type DependencyList } from 'react';
import gsap from 'gsap';

/**
 * Checks whether the user has requested reduced motion.
 * Safely defaults to true during SSR.
 */
export function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * React hook to manage GSAP animations scoped to a DOM container.
 * Automatically respects `prefers-reduced-motion: reduce` and cleans up on unmount.
 */
export function useGsapContext(
  scopeRef: RefObject<HTMLElement | null>,
  animationFn: (ctx: gsap.Context) => void,
  deps: DependencyList = []
) {
  useEffect(() => {
    if (typeof window === 'undefined' || !scopeRef.current) return;
    if (isReducedMotion()) return;

    const ctx = gsap.context(() => {
      animationFn(ctx);
    }, scopeRef);

    return () => {
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Attaches a one-time IntersectionObserver to trigger a reveal when visible.
 * Automatically cleans up when unmounted.
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
