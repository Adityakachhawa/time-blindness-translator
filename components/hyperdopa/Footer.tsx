'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer 
      className="relative z-10 w-full border-t py-12 flex flex-col items-center justify-center gap-6 text-center mt-auto"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <span className="font-bold tracking-widest uppercase text-sm">HYPERDOPA</span>
        <p className="text-sm font-semibold tracking-wide opacity-75">
          Tools for when your brain gets stuck.
        </p>
      </div>
      
      <div className="flex items-center gap-4 text-sm font-medium opacity-80 flex-wrap justify-center px-4">
        <Link href="/time-translator" className="hover:opacity-100 transition-opacity outline-none">Time Translator</Link>
        <span className="opacity-40">·</span>
        <Link href="/privacy" className="hover:opacity-100 transition-opacity outline-none">Privacy</Link>
        <span className="opacity-40">·</span>
        <Link href="/support" className="hover:opacity-100 transition-opacity outline-none">Support</Link>
      </div>

      <p className="text-xs opacity-50 font-medium">
        Free tools, built with care.
      </p>
    </footer>
  );
}
