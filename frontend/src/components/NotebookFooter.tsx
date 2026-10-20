"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useStatement } from '@/context/StatementContext';
import { ShieldCheck, HardDrive, Sparkles, UploadCloud } from 'lucide-react';

export const NotebookFooter: React.FC = () => {
  const { setIsImportOpen, handleLoadDemo, isDemoLoading } = useStatement();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <footer 
      className="border-t border-[#DFD9CA] bg-[#FAF8F3] relative overflow-hidden transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Decorative Curled Page Corner (Top Right) */}
      <div 
        className="absolute top-0 right-0 w-12 h-12 pointer-events-none" 
        aria-hidden="true"
      >
        <svg viewBox="0 0 48 48" className="w-full h-full">
          <path 
            d="M 48 0 L 0 0 C 24 6, 42 24, 48 48 Z" 
            fill="#EEEBDD" 
            stroke="#DFD9CA" 
            strokeWidth="1"
          />
          <path 
            d="M 0 0 L 48 48 L 48 0 Z" 
            fill="#F3EFE4" 
            opacity="0.6"
          />
        </svg>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
        
        {/* Main Footer Scene: Sloth resting on notebook spine + brand copy */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          
          {/* Left: Illustrated Sloth on Branch Scene */}
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left max-w-lg">
            
            {/* Handcrafted Vector Scene */}
            <div 
              className={`shrink-0 w-28 h-24 sm:w-32 sm:h-28 relative transition-transform duration-500 motion-reduce:transform-none ${
                isHovered ? 'scale-105' : 'scale-100'
              }`}
              aria-label="Illustration of a peaceful sloth resting on a notebook spine branch"
            >
              <svg
                viewBox="0 0 128 112"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full select-none"
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

                {/* Sloth Body draped comfortably over the branch */}
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

                {/* Sloth Head resting sideways on front paws */}
                <g transform="translate(68, 48)">
                  {/* Head round contour */}
                  <ellipse cx="14" cy="12" rx="13" ry="11" fill="#D6CEBE" stroke="#8C7E6A" strokeWidth="1" />
                  
                  {/* Lighter face mask */}
                  <ellipse cx="13" cy="13" rx="10" ry="8" fill="#FCFBF7" />

                  {/* Left & Right eye dark patches */}
                  <ellipse cx="8" cy="12" rx="3.5" ry="2.5" transform="rotate(-15 8 12)" fill="#365844" fillOpacity="0.8" />
                  <ellipse cx="18" cy="12" rx="3.5" ry="2.5" transform="rotate(15 18 12)" fill="#365844" fillOpacity="0.8" />

                  {/* Peaceful sleeping curved eyelids */}
                  <path d="M 6.5 12 Q 8 10.5 9.5 12" stroke="#FCFBF7" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M 16.5 12 Q 18 10.5 19.5 12" stroke="#FCFBF7" strokeWidth="1.2" strokeLinecap="round" />

                  {/* Small round dark nose */}
                  <ellipse cx="13" cy="15.5" rx="2" ry="1.4" fill="#292D29" />

                  {/* Gentle contented smile */}
                  <path d="M 11 17.5 Q 13 19 15 17.5" stroke="#292D29" strokeWidth="1" strokeLinecap="round" fill="none" />
                </g>

                {/* Tiny sleepy 'z' marks appearing on hover with calm transition */}
                <g 
                  className={`transition-opacity duration-300 ${isHovered ? 'opacity-90' : 'opacity-40'}`}
                  fill="#365844"
                  fontSize="8"
                  fontFamily="serif"
                >
                  <text x="88" y="38" className="select-none">z</text>
                  <text x="96" y="30" fontSize="10" className="select-none">z</text>
                </g>
              </svg>
            </div>

            {/* Brand Statement & Purpose */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="font-serif text-lg font-medium text-[#292D29]">Usually</span>
                <span className="text-[#8A928A]">—</span>
                <span className="font-sans text-xs text-[#606860] italic">your money has habits</span>
              </div>
              <p className="text-xs text-[#606860] leading-relaxed font-sans max-w-sm">
                A quiet personal finance companion that learns your recurring spending rhythms 
                and turns verified ledger data into conversational observations at your own pace.
              </p>
            </div>
          </div>

          {/* Right: Thoughtful Navigation & Local Guarantees */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 text-xs">
            
            {/* Primary Destinations */}
            <div className="space-y-2 text-center sm:text-left">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#365844] font-semibold">
                Notebook Index
              </span>
              <ul className="space-y-1.5 text-[#606860] font-sans">
                <li>
                  <Link href="/" className="hover:text-[#292D29] transition-colors">
                    Home Briefing
                  </Link>
                </li>
                <li>
                  <Link href="/analysis" className="hover:text-[#292D29] transition-colors">
                    Financial Analysis & Pacing
                  </Link>
                </li>
                <li>
                  <Link href="/transactions" className="hover:text-[#292D29] transition-colors">
                    Verified Ledger
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={() => setIsImportOpen(true)}
                    className="text-[#365844] hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <UploadCloud className="w-3 h-3" />
                    <span>Import Statement</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Local Privacy Note */}
            <div className="space-y-2 max-w-xs text-center sm:text-left bg-[#FCFBF7] p-3.5 rounded-xl border border-[#DFD9CA]">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 font-mono text-[11px] text-[#365844] font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Local SQLite Security</span>
              </div>
              <p className="text-[11px] text-[#8A928A] leading-relaxed font-sans">
                Your bank statements and personal transactions never leave this machine. 
                All parsing, accounting, and habit memory run strictly on local hardware.
              </p>
            </div>

          </div>

        </div>

        {/* Fine Ruled Divider */}
        <div className="border-t border-[#DFD9CA] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-[#8A928A]">
          <div className="flex items-center gap-2">
            <span>Usually • Hacktoberfest 2026</span>
            <span>•</span>
            <span>MIT License</span>
          </div>

          {/* Signature Closing Accent */}
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-xs text-[#365844]">
              &ldquo;Slow and steady.&rdquo;
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
