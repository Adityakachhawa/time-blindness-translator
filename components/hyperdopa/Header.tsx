'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('tbt-theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
    } else {
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tbt-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b w-full"
      style={{
        background: 'var(--card)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 outline-none min-h-11 min-w-11">
          <span className="font-bold tracking-widest uppercase text-sm">HYPERDOPA</span>
        </Link>

        <div className="flex items-center gap-1 md:gap-6">
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium opacity-80">
            <Link href="/time-translator" className="hover:opacity-100 transition-opacity outline-none">Time Translator</Link>
            <Link href="/#how-it-works" className="hover:opacity-100 transition-opacity outline-none">How It Works</Link>
            <Link href="/privacy" className="hover:opacity-100 transition-opacity outline-none">Privacy</Link>
          </nav>

          <button 
            onClick={toggleTheme}
            className="opacity-80 hover:opacity-100 outline-none min-w-11 min-h-11 flex items-center justify-center transition-opacity"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : theme === 'light' ? <Moon className="w-5 h-5" /> : <div className="w-5 h-5" />}
          </button>

          {/* Mobile Nav Toggle */}
          <button 
            className="md:hidden opacity-80 hover:opacity-100 outline-none min-w-11 min-h-11 flex items-center justify-center -mr-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden"
            style={{
              borderTop: '1px solid var(--card-border)',
              background: 'var(--bg)',
            }}
          >
            <div className="flex flex-col px-4 py-2">
              <Link href="/time-translator" onClick={() => setMenuOpen(false)} className="py-3 font-medium outline-none min-h-11 flex items-center" style={{ borderBottom: '1px solid var(--card-border)' }}>Time Translator</Link>
              <Link href="/#how-it-works" onClick={() => setMenuOpen(false)} className="py-3 font-medium outline-none min-h-11 flex items-center" style={{ borderBottom: '1px solid var(--card-border)' }}>How It Works</Link>
              <Link href="/privacy" onClick={() => setMenuOpen(false)} className="py-3 font-medium outline-none min-h-11 flex items-center">Privacy</Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
