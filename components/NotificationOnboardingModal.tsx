'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { requestNotificationPermission } from '@/lib/notifications/notificationManager';
import { subscribeToPush } from '@/lib/notifications/pushManager';

interface NotificationOnboardingModalProps {
  isOpen: boolean;
  onClose: (markSeen: boolean) => void;
  onSuccess: () => void;
}

export default function NotificationOnboardingModal({
  isOpen,
  onClose,
  onSuccess,
}: NotificationOnboardingModalProps) {
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsEnabling(false);
      setError(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEnabling) {
        onClose(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    if (modalRef.current) {
      modalRef.current.focus();
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isEnabling, onClose]);

  const handleEnable = async () => {
    if (isEnabling) return;
    setIsEnabling(true);
    setError(false);

    try {
      const granted = await requestNotificationPermission();
      
      if (!granted) {
        setIsEnabling(false);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
          onClose(true);
        }
        return;
      }

      const success = await subscribeToPush();
      
      if (success) {
        onSuccess();
        onClose(true);
      } else {
        setError(true);
        setIsEnabling(false);
      }
    } catch (err) {
      console.error('Failed to enable notifications', err);
      setError(true);
      setIsEnabling(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isEnabling && onClose(true)}
          />

          <motion.div
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-modal-title"
            aria-describedby="notification-modal-desc"
            initial={!prefersReducedMotion ? { opacity: 0, scale: 0.95, y: 10 } : { opacity: 0 }}
            animate={!prefersReducedMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1 }}
            exit={!prefersReducedMotion ? { opacity: 0, scale: 0.95, y: 10 } : { opacity: 0 }}
            className="relative w-full max-w-sm rounded-3xl p-6 shadow-xl outline-none"
            style={{
              background: 'var(--card)',
              border: '1.5px solid var(--card-border)',
            }}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(125,175,156,0.2), rgba(125,175,156,0.1))',
                  border: '1.5px solid rgba(125,175,156,0.4)',
                }}
              >
                <Bell className="w-8 h-8" style={{ color: 'var(--color-sage-500)' }} strokeWidth={2} />
              </div>

              <div className="flex flex-col gap-2">
                <h2 id="notification-modal-title" className="text-xl font-black leading-tight" style={{ color: 'var(--fg)' }}>
                  Stay on track, even when you leave the app
                </h2>
                <p id="notification-modal-desc" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                  Time-Blindness Translator can remind you when your mission ends — even when the app is in the background.
                </p>
              </div>

              {error && (
                <div className="w-full text-sm font-medium rounded-xl p-3" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                  Couldn't enable notifications. You can try again.
                </div>
              )}

              <div className="flex flex-col gap-3 w-full mt-2">
                <button
                  onClick={handleEnable}
                  disabled={isEnabling}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-sage-500) 0%, var(--color-sage-600) 100%)',
                    opacity: isEnabling ? 0.7 : 1,
                    minHeight: '44px',
                  }}
                >
                  {isEnabling ? 'Enabling…' : 'Enable notifications'}
                </button>
                <button
                  onClick={() => onClose(true)}
                  disabled={isEnabling}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold transition-colors"
                  style={{ 
                    color: 'var(--muted)',
                    background: 'transparent',
                    border: '1.5px solid transparent',
                    minHeight: '44px',
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
