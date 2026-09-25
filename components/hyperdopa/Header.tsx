'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

// ---------------------------------------------------------------------------
// Navigation links
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: '/time-translator', label: 'Time Translator' },
  { href: '/reset-my-day',    label: 'Reset My Day' },
  { href: '/#how-it-works',   label: 'How It Works' },
  { href: '/privacy',         label: 'Privacy' },
] as const;

// ---------------------------------------------------------------------------
// Hamburger icon — morphs to X via SVG path animation
// ---------------------------------------------------------------------------

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <motion.line
        x1="3" y1="6" x2="19" y2="6"
        animate={open ? { x1: 4, y1: 4, x2: 18, y2: 18 } : { x1: 3, y1: 6, x2: 19, y2: 6 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
      />
      <motion.line
        x1="3" y1="11" x2="19" y2="11"
        animate={open ? { opacity: 0, x1: 11, x2: 11 } : { opacity: 1, x1: 3, x2: 19 }}
        transition={{ duration: 0.15, ease: 'easeInOut' }}
      />
      <motion.line
        x1="3" y1="16" x2="19" y2="16"
        animate={open ? { x1: 4, y1: 18, x2: 18, y2: 4 } : { x1: 3, y1: 16, x2: 19, y2: 16 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Header
// ---------------------------------------------------------------------------

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  const pathname = usePathname();

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

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, closeDrawer]);

  // Prevent background scroll while drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Close drawer on route change
  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b w-full"
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
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium opacity-80" aria-label="Main navigation">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:opacity-100 transition-opacity outline-none relative"
                  aria-current={pathname === link.href ? 'page' : undefined}
                  style={{
                    color: pathname === link.href ? 'var(--color-coral-500)' : undefined,
                    opacity: pathname === link.href ? 1 : undefined,
                    fontWeight: pathname === link.href ? 700 : undefined,
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="opacity-80 hover:opacity-100 outline-none min-w-11 min-h-11 flex items-center justify-center transition-opacity"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : theme === 'light' ? <Moon className="w-5 h-5" /> : <div className="w-5 h-5" />}
            </button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden min-w-11 min-h-11 flex items-center justify-center rounded-xl outline-none -mr-1 transition-colors"
              style={{
                background: drawerOpen ? 'var(--color-coral-500)' + '18' : 'transparent',
                border: '1.5px solid',
                borderColor: drawerOpen ? 'var(--color-coral-500)' + '40' : 'transparent',
                color: drawerOpen ? 'var(--color-coral-500)' : 'currentColor',
              }}
              onClick={() => setDrawerOpen((o) => !o)}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav-drawer"
            >
              <HamburgerIcon open={drawerOpen} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile slide drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
              onClick={closeDrawer}
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.div
              key="drawer"
              id="mobile-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 38, mass: 0.8 }}
              className="fixed top-0 right-0 bottom-0 z-50 md:hidden flex flex-col"
              style={{
                width: 'min(320px, 85vw)',
                background: 'var(--card)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderLeft: '1px solid var(--card-border)',
                borderRadius: '20px 0 0 20px',
                boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              {/* Drawer header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid var(--card-border)' }}
              >
                <span className="font-bold tracking-widest uppercase text-sm">HYPERDOPA</span>
                <button
                  onClick={closeDrawer}
                  className="min-w-11 min-h-11 flex items-center justify-center rounded-xl outline-none"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--card-border)',
                  }}
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex flex-col flex-1 px-4 py-4 gap-1" aria-label="Mobile navigation">
                {NAV_LINKS.map((link, i) => {
                  const isActive = pathname === link.href;
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + i * 0.05, duration: 0.22, ease: 'easeOut' }}
                    >
                      <Link
                        href={link.href}
                        onClick={closeDrawer}
                        aria-current={isActive ? 'page' : undefined}
                        className="flex items-center justify-between px-4 py-3.5 rounded-2xl font-semibold text-base outline-none transition-all min-h-11"
                        style={{
                          background: isActive ? 'var(--color-coral-500)' + '14' : 'transparent',
                          color: isActive ? 'var(--color-coral-500)' : 'var(--fg)',
                          fontWeight: isActive ? 700 : 500,
                          border: isActive ? '1.5px solid ' + 'var(--color-coral-500)' + '30' : '1.5px solid transparent',
                        }}
                      >
                        {link.label}
                        {isActive && (
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: 'var(--color-coral-500)' }}
                          />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Theme toggle at bottom */}
              <div
                className="px-6 py-4"
                style={{ borderTop: '1px solid var(--card-border)' }}
              >
                <button
                  onClick={() => { toggleTheme(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm outline-none transition-colors min-h-11"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--fg)',
                  }}
                >
                  {theme === 'dark'
                    ? <><Sun className="w-4 h-4" /><span>Switch to Light Mode</span></>
                    : <><Moon className="w-4 h-4" /><span>Switch to Dark Mode</span></>
                  }
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
