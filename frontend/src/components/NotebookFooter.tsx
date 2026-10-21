"use client";

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useStatement } from '@/context/StatementContext';
import { ShieldCheck, UploadCloud } from 'lucide-react';
import gsap from 'gsap';
import { isReducedMotion, observeViewportReveal } from '@/lib/motion';

export const NotebookFooter: React.FC = () => {
  const { setIsImportOpen } = useStatement();
  const [isHovered, setIsHovered] = useState(false);
  const footerRef = useRef<HTMLElement>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (!footerRef.current || isReducedMotion() || hasAnimatedRef.current) return;

    let ctx: gsap.Context | undefined;
    const cleanup = observeViewportReveal(
      footerRef.current,
      () => {
        if (hasAnimatedRef.current || !footerRef.current) return;
        hasAnimatedRef.current = true;

        try {
          ctx = gsap.context(() => {}, footerRef.current);
          ctx.add(() => {
            const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

            // 1. Subtle entrance of the left scene (sloth illustration)
            tl.from('.footer-sloth-scene', {
              opacity: 0,
              y: 8,
              duration: 0.35,
            });

            // 2. Sloth body & head soft settle
            tl.from(
              '.footer-sloth-body, .footer-sloth-head',
              {
                opacity: 0,
                y: 5,
                duration: 0.32,
                stagger: 0.05,
              },
              '-=0.2'
            );

            // 3. Middle branding & Far Right Notebook reveal
            tl.from(
              '.footer-middle-content, .footer-notebook-index',
              {
                opacity: 0,
                y: 6,
                duration: 0.28,
                stagger: 0.08,
              },
              '-=0.15'
            );

            // 4. Closing divider line & signature closing phrase
            tl.from(
              '.footer-bottom-bar',
              {
                opacity: 0,
                duration: 0.25,
              },
              '-=0.1'
            );
          });
        } catch (err) {
          console.error('[Usually Footer Motion] Error executing footer entrance:', err);
        }
      },
      0.12
    );

    return () => {
      cleanup();
      ctx?.revert();
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className="border-t border-[#DFD9CA] bg-[#FAF8F3] relative overflow-hidden transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="contentinfo"
      aria-label="Notebook Footer"
    >
      {/* Decorative Curled Page Corner (Top Right) */}
      <div
        className="absolute top-0 right-0 w-12 h-12 pointer-events-none transition-transform duration-300 ease-out"
        aria-hidden="true"
        style={{
          transform: isHovered && !isReducedMotion() ? 'scale(1.06) translate(1px, -1px)' : 'scale(1)',
        }}
      >
        <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs">
          <path
            d="M 48 0 L 0 0 C 24 6, 42 24, 48 48 Z"
            fill="#EEEBDD"
            stroke="#DFD9CA"
            strokeWidth="1"
          />
          <path
            d="M 0 0 L 48 48 L 48 0 Z"
            fill="#F3EFE4"
            opacity="0.65"
          />
        </svg>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
        {/* Main Footer Row: Sloth (Left), Branding & Tagline (Middle), Vintage Notebook Index (Far Right) */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-6">
          {/* Left: Illustrated Sloth on Branch Scene */}
          <div className="footer-sloth-scene shrink-0 flex justify-center">
            {/* Handcrafted Vector Scene — Scaled ~1.5x with continuous sleeping Z animation */}
            <div
              className={`shrink-0 w-36 h-[126px] sm:w-48 sm:h-[168px] relative transition-all duration-300 ease-out motion-reduce:transform-none cursor-default ${
                isHovered ? 'scale-103 -translate-y-0.5' : 'scale-100'
              }`}
              aria-label="Illustration of a peaceful sloth resting on a notebook spine branch"
            >
              <svg
                viewBox="0 0 128 112"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full select-none overflow-visible"
              >
                {/* Background soft ruled notebook lines */}
                <line x1="10" y1="36" x2="118" y2="36" stroke="#E8E4D8" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="10" y1="56" x2="118" y2="56" stroke="#E8E4D8" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="10" y1="76" x2="118" y2="76" stroke="#E8E4D8" strokeWidth="1" strokeDasharray="3 3" />

                {/* Notebook spine / Branch */}
                <path
                  d="M 6 68 C 30 65, 60 70, 95 67 C 108 66, 118 64, 122 65"
                  stroke="#8C7E6A"
                  strokeWidth="5"
                  strokeLinecap="round"
                />

                {/* Small botanical leaves along branch */}
                <g className="transition-transform duration-300 origin-[22px_66px]" style={{ transform: isHovered ? 'rotate(1.5deg)' : 'none' }}>
                  <path
                    d="M 22 66 C 18 56, 26 52, 28 58 C 30 64, 26 66, 22 66 Z"
                    fill="#9CAF88"
                    stroke="#365844"
                    strokeWidth="1"
                  />
                  <path
                    d="M 98 66 C 104 56, 112 58, 108 64 C 104 68, 100 66, 98 66 Z"
                    fill="#9CAF88"
                    stroke="#365844"
                    strokeWidth="1"
                  />
                  <path
                    d="M 110 65 C 116 60, 122 63, 118 68 Z"
                    fill="#9CAF88"
                    stroke="#365844"
                    strokeWidth="0.8"
                  />
                </g>

                {/* Sloth Body draped comfortably over the branch */}
                <g className="footer-sloth-body">
                  <ellipse cx="62" cy="62" rx="22" ry="14" fill="#C8BEAD" />

                  {/* Fluffy back contours */}
                  <path
                    d="M 44 65 C 46 50, 78 50, 80 65"
                    fill="#D6CEBE"
                  />

                  {/* Limbs hugging branch */}
                  {/* Front arms */}
                  <path
                    d="M 72 66 C 74 74, 80 77, 83 75 C 84 73, 80 66, 78 64"
                    fill="#B8AE9D"
                    stroke="#8C7E6A"
                    strokeWidth="1"
                  />
                  {/* Back legs */}
                  <path
                    d="M 46 66 C 44 74, 38 76, 36 74 C 35 72, 40 66, 42 64"
                    fill="#B8AE9D"
                    stroke="#8C7E6A"
                    strokeWidth="1"
                  />
                </g>

                {/* Sloth Head resting sideways on front paws */}
                <g className="footer-sloth-head" transform="translate(68, 48)">
                  {/* Head round contour */}
                  <ellipse cx="14" cy="12" rx="13" ry="11" fill="#D6CEBE" stroke="#8C7E6A" strokeWidth="1" />

                  {/* Lighter face mask */}
                  <ellipse cx="13" cy="13" rx="10" ry="8" fill="#FCFBF7" />

                  {/* Left & Right eye dark patches */}
                  <ellipse cx="8" cy="12" rx="3.5" ry="2.5" transform="rotate(-15 8 12)" fill="#365844" fillOpacity="0.85" />
                  <ellipse cx="18" cy="12" rx="3.5" ry="2.5" transform="rotate(15 18 12)" fill="#365844" fillOpacity="0.85" />

                  {/* Peaceful sleeping curved eyelids */}
                  <path d="M 6.5 12 Q 8 10.5 9.5 12" stroke="#FCFBF7" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M 16.5 12 Q 18 10.5 19.5 12" stroke="#FCFBF7" strokeWidth="1.2" strokeLinecap="round" />

                  {/* Small round dark nose */}
                  <ellipse cx="13" cy="15.5" rx="2" ry="1.4" fill="#292D29" />

                  {/* Gentle contented smile */}
                  <path d="M 11 17.5 Q 13 19 15 17.5" stroke="#292D29" strokeWidth="1" strokeLinecap="round" fill="none" />
                </g>

                {/* Sleeping Zs with continuous floating animation */}
                <g
                  className="footer-sloth-sleep-zs transition-opacity duration-300"
                  style={{
                    opacity: isHovered ? 1 : 0.85,
                  }}
                  fill="#365844"
                  fontFamily="serif"
                  fontStyle="italic"
                  aria-hidden="true"
                >
                  <text x="86" y="39" fontSize="7.5" className="sloth-z sloth-z-1 select-none">z</text>
                  <text x="93" y="32" fontSize="9" className="sloth-z sloth-z-2 select-none">z</text>
                  <text x="100" y="25" fontSize="10.5" className="sloth-z sloth-z-3 select-none">z</text>
                </g>
              </svg>
            </div>
          </div>

          {/* Middle: Brand Statement, Mission & Tagline */}
          <div className="footer-middle-content space-y-2.5 text-center lg:text-left max-w-sm xl:max-w-md">
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <span className="font-serif text-lg font-medium text-[#292D29]">Usually</span>
              <span className="text-[#8A928A]" aria-hidden="true">—</span>
              <span className="font-sans text-xs text-[#606860] italic">your money has habits</span>
            </div>
            <p className="text-xs text-[#606860] leading-relaxed font-sans">
              A quiet personal finance companion that learns your recurring spending rhythms
              and turns verified ledger data into conversational observations at your own pace.
            </p>
            <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-2.5 text-[11px]">
              <span className="notebook-annotation text-sm text-[#365844] select-none">
                teach Usually once, remembered forever
              </span>
              <span className="text-[#DFD9CA] hidden sm:inline" aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-[#606860] bg-[#FCFBF7] px-2 py-0.5 rounded-md border border-[#DFD9CA]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#365844] shrink-0" />
                <span>Private SQLite workspace</span>
              </span>
            </div>
          </div>

          {/* Far Right: Vintage Notebook Index Page */}
          <nav
            aria-label="Notebook Index"
            className="footer-notebook-index w-full sm:w-[252px] vintage-notebook-paper border border-[#DFD9CA] rounded-r-lg rounded-l-xs vintage-notebook-shadow relative overflow-hidden select-none shrink-0"
          >
            <div className="flex min-h-[178px]">
              {/* Left Sage Cloth Binding Spine Detail */}
              <div
                className="w-3.5 bg-[#8FA882] border-r border-[#768C69]/60 shrink-0 relative flex flex-col justify-around py-3"
                aria-hidden="true"
              >
                {/* Vintage Thread Stitches */}
                <span className="w-1.5 h-0.5 bg-[#4A5D3F]/70 mx-auto rounded-full" />
                <span className="w-1.5 h-0.5 bg-[#4A5D3F]/70 mx-auto rounded-full" />
                <span className="w-1.5 h-0.5 bg-[#4A5D3F]/70 mx-auto rounded-full" />
              </div>

              {/* Ruled Notebook Paper Surface */}
              <div className="flex-1 py-3 px-3 relative">
                {/* Subtle Red Vertical Margin Line */}
                <div
                  className="absolute top-0 bottom-0 left-[32px] w-[1px] bg-[rgba(215,90,75,0.38)] pointer-events-none"
                  aria-hidden="true"
                />

                {/* Notebook Header */}
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#E8E4D8]/90 pl-1">
                  <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-[#365844] font-bold">
                    NOTEBOOK INDEX
                  </h3>
                  <span className="font-mono text-[9px] text-[#8A928A]">p. 01</span>
                </div>

                {/* 4 Preserved Navigation Links */}
                <ul className="space-y-1 text-xs font-sans">
                  <li className="flex items-center h-[26px]">
                    <span className="w-5 font-mono text-[10px] text-[#A2A89E] pr-1.5 text-right select-none" aria-hidden="true">
                      01
                    </span>
                    <Link
                      href="/"
                      className="pl-2.5 flex-1 py-0.5 text-[#292D29] hover:text-[#365844] hover:translate-x-0.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#365844] rounded-xs font-medium"
                    >
                      Home Briefing
                    </Link>
                  </li>
                  <li className="flex items-center h-[26px]">
                    <span className="w-5 font-mono text-[10px] text-[#A2A89E] pr-1.5 text-right select-none" aria-hidden="true">
                      02
                    </span>
                    <Link
                      href="/analysis"
                      className="pl-2.5 flex-1 py-0.5 text-[#292D29] hover:text-[#365844] hover:translate-x-0.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#365844] rounded-xs font-medium"
                    >
                      Financial Analysis
                    </Link>
                  </li>
                  <li className="flex items-center h-[26px]">
                    <span className="w-5 font-mono text-[10px] text-[#A2A89E] pr-1.5 text-right select-none" aria-hidden="true">
                      03
                    </span>
                    <Link
                      href="/transactions"
                      className="pl-2.5 flex-1 py-0.5 text-[#292D29] hover:text-[#365844] hover:translate-x-0.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#365844] rounded-xs font-medium"
                    >
                      Verified Ledger
                    </Link>
                  </li>
                  <li className="flex items-center h-[26px]">
                    <span className="w-5 font-mono text-[10px] text-[#A2A89E] pr-1.5 text-right select-none" aria-hidden="true">
                      04
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsImportOpen(true)}
                      className="pl-2.5 flex-1 py-0.5 text-left text-[#365844] hover:text-[#243B2E] hover:translate-x-0.5 transition-all duration-150 inline-flex items-center justify-between pr-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#365844] rounded-xs font-medium group"
                    >
                      <span>Import Statement</span>
                      <UploadCloud className="w-3 h-3 text-[#365844] group-hover:scale-110 transition-transform" />
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* Fine Ruled Divider & Closing Accent */}
        <div className="footer-bottom-bar border-t border-[#DFD9CA] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-[#8A928A]">
          <div className="flex items-center gap-2">
            <span>Usually • Hacktoberfest 2026</span>
            <span>•</span>
            <span>MIT License</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-serif italic text-xs text-[#606860]">
              &ldquo;Slow and steady.&rdquo;
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
