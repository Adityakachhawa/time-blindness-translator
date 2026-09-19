'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  X, HelpCircle, ArrowRight, Zap, Target, Brain, Timer, Clock, 
  ChevronDown, CalendarClock, Play, PauseCircle, Plus, RefreshCcw, 
  Bell, CheckCircle2, TrendingUp, History, BarChart, Award, Shield, Sparkles, Calculator
} from 'lucide-react';

interface ProductGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Reusable Accordion Component
function AccordionGroup({ title, items }: { title: string, items: {name: string, desc: string, icon: any}[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="w-full rounded-2xl overflow-hidden mb-3" style={{ background: 'var(--card)', border: '1.5px solid var(--card-border)' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 font-bold text-left transition-colors"
        style={{ color: 'var(--fg)' }}
      >
        <span>{title}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        >
          <ChevronDown className="w-5 h-5 opacity-60" />
        </motion.div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 flex flex-col gap-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="shrink-0 mt-0.5 p-1.5 rounded-lg" style={{ background: 'rgba(125,175,156,0.1)', color: 'var(--color-sage-500)' }}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{item.name}</h4>
                    <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProductGuideModal({ isOpen, onClose }: ProductGuideModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    if (modalRef.current) modalRef.current.focus();
    
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const coreLoop = [
    "Estimate", "Translate", "Start a Mission", 
    "Do the task", "Reality Check", "Learn", "Estimate better next time"
  ];

  const featuresBefore = [
    { name: 'Time Translation', desc: 'Applies your personal ADHD tax to your raw estimate.', icon: Calculator }, // wait Calculator isn't imported, let me use Zap
    { name: 'Exact Time Mode', desc: 'Bypass time translation entirely for strict deadlines.', icon: Zap },
    { name: 'Fit Check', desc: 'See if you have enough time before an upcoming hard stop.', icon: Clock },
    { name: 'Deadline', desc: 'Calculate exactly when you need to start to finish on time.', icon: CalendarClock },
    { name: 'Make It Tiny', desc: 'Instantly launch a 5m or 15m starter mission.', icon: Sparkles },
  ];

  const featuresDuring = [
    { name: 'Mission Timer', desc: 'Your visual countdown. Colors shift as time passes.', icon: Timer },
    { name: 'Pause', desc: 'Stop the clock. We still track total elapsed real-world time.', icon: PauseCircle },
    { name: 'Overtime', desc: 'If time runs out, keep working—we track the extra minutes.', icon: Play },
    { name: 'Recalculate', desc: 'Realized you need way more time? Instantly resize the budget.', icon: RefreshCcw },
    { name: '+5m / +10m', desc: 'Quickly bump the timer up without breaking flow.', icon: Plus },
    { name: 'Background Alarms', desc: 'Get a push notification when your time is up.', icon: Bell },
  ];

  const featuresAfter = [
    { name: 'Reality Check', desc: 'See how your original estimate compared to reality.', icon: CheckCircle2 },
    { name: 'Your Time Model', desc: 'The app learns your patterns and updates its multiplier.', icon: TrendingUp },
    { name: 'Keep Momentum', desc: 'Start a new mission immediately without returning to setup.', icon: ArrowRight },
    { name: 'History', desc: 'Review every completed mission and its accuracy.', icon: History },
    { name: 'Weekly Report', desc: 'A summary of your translated time over the past 7 days.', icon: BarChart },
    { name: 'Certificate', desc: 'Shareable proof of your epic time-management victory.', icon: Award },
  ];

  return (
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-0">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="guide-title"
        aria-modal="true"
        initial={!prefersReducedMotion ? { opacity: 0, y: 100 } : { opacity: 0 }}
        animate={!prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 1 }}
        exit={!prefersReducedMotion ? { opacity: 0, y: 100 } : { opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-2xl bg-(--card) rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] outline-none"
        style={{ border: '1.5px solid var(--card-border)' }}
      >
        {/* Header */}
        <div className="shrink-0 p-5 sm:p-6 border-b flex justify-between items-start bg-[rgba(0,0,0,0.02)] rounded-t-3xl" style={{ borderColor: 'var(--card-border)' }}>
          <div>
            <h2 id="guide-title" className="text-2xl font-black leading-tight" style={{ color: 'var(--fg)' }}>
              How it works
            </h2>
            <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-coral-500)' }}>
              Your estimate is only the beginning.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-[rgba(0,0,0,0.05)] transition-colors"
            aria-label="Close guide"
          >
            <X className="w-6 h-6 opacity-60" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 pb-24 sm:pb-6 space-y-10 custom-scrollbar">
          
          {/* Section 1: Core Loop */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
              <RefreshCcw className="w-4 h-4" /> The Core Loop
            </h3>
            <div className="flex flex-wrap gap-2 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
              {coreLoop.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-lg" style={{ background: 'var(--card-border)' }}>{i + 1}. {step}</span>
                  {i < coreLoop.length - 1 && <ArrowRight className="w-3 h-3 opacity-40" />}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm font-medium leading-relaxed" style={{ color: 'var(--muted)' }}>
              Tell us what you're doing and how long you think it will take. We translate that estimate using your current time model. 
              Start a Mission and work against a real working deadline. When you're finished, we compare your prediction with reality. 
              Your completed missions help build a more personal time model.
            </p>
          </section>

          {/* Section 2: Time Translation */}
          <section>
            <div className="p-5 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(242,129,90,0.1), rgba(245,166,35,0.05))', border: '1.5px solid var(--color-coral-400)' }}>
              <h3 className="text-lg font-black mb-2" style={{ color: 'var(--fg)' }}>Your brain's estimate ≠ your working estimate</h3>
              <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                We use your raw estimate and your accumulated calibration to create a realistic working duration. 
                <br/><br/>
                <span className="opacity-70 italic text-xs">Note: "ADHD tax" is our app's terminology for this time adjustment, not a clinical diagnosis or medical measurement.</span>
              </p>
            </div>
          </section>

          {/* Section 3: Main Features Accordions */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
              <Target className="w-4 h-4" /> Feature Directory
            </h3>
            <AccordionGroup title="Before the mission" items={featuresBefore} />
            <AccordionGroup title="During the mission" items={featuresDuring} />
            <AccordionGroup title="After the mission" items={featuresAfter} />
          </section>

          {/* Section 4 & 5: Timer & Reality Check */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                <Timer className="w-4 h-4" /> The Timer
              </h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <strong style={{ color: 'var(--color-sage-600)' }}>ON TIME:</strong> <span style={{ color: 'var(--muted)' }}>You're still within your current working budget.</span>
                </li>
                <li>
                  <strong style={{ color: 'var(--color-coral-600)' }}>OVER BUDGET:</strong> <span style={{ color: 'var(--muted)' }}>You've used the estimated time. Keep going, extend, or recalculate.</span>
                </li>
                <li>
                  <strong style={{ color: 'var(--color-amber-600)' }}>PAUSED:</strong> <span style={{ color: 'var(--muted)' }}>The timer is temporarily stopped. Elapsed real time is still tracked.</span>
                </li>
              </ul>
            </section>
            
            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                <CheckCircle2 className="w-4 h-4" /> Reality Check
              </h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <strong>ORIGINAL:</strong> <span style={{ color: 'var(--muted)' }}>What you initially thought it would take.</span>
                </li>
                <li>
                  <strong>CALIBRATED:</strong> <span style={{ color: 'var(--muted)' }}>What your current time model suggested.</span>
                </li>
                <li>
                  <strong>REALITY:</strong> <span style={{ color: 'var(--muted)' }}>How long the task actually took.</span>
                </li>
              </ul>
            </section>
          </div>

          {/* Section 6 & 7: Time Model & Momentum */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                <Brain className="w-4 h-4" /> Your Time Model
              </h3>
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--muted)' }}>
                You said 10 minutes. Reality was usually longer. Over time, the tool learns that pattern to better support you. (Not a medical assessment).
              </p>
            </section>
            
            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                <ArrowRight className="w-4 h-4" /> Keep the Momentum
              </h3>
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--muted)' }}>
                Finish one mission and immediately start another suggested task without returning to the beginning. Built to reduce friction.
              </p>
            </section>
          </div>

          {/* Section 8 & 9: Alarms & Privacy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                <Bell className="w-4 h-4" /> Background Alarms
              </h3>
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--muted)' }}>
                Enable optional notifications to receive mission reminders when the app isn't actively in front of you. 
              </p>
            </section>
            
            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                <Shield className="w-4 h-4" /> Privacy
              </h3>
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--muted)' }}>
                Local-first. No account required. Your mission history and personal time model stay on your device (push alarms use an anonymous remote service).
              </p>
            </section>
          </div>

          {/* Section 10: Walkthrough */}
          <section className="pt-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <h3 className="text-lg font-black mb-4 flex items-center gap-2" style={{ color: 'var(--fg)' }}>
              Your first mission
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {['Name the task', 'Enter your estimate', 'Start the mission', 'Do the task', 'Tap "I Did It!" when finished', 'See your Reality Check', 'Come back and let your time model learn'].map((step, i) => (
                <div key={i} className="flex items-center gap-3 bg-[rgba(0,0,0,0.03)] p-3 rounded-xl">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--color-sage-500)', color: 'white' }}>{i + 1}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{step}</span>
                </div>
              ))}
            </div>
            
            {/* Primary CTA */}
            <button
              onClick={onClose}
              className="w-full py-5 rounded-2xl text-xl font-black text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--color-coral-500) 0%, var(--color-coral-600) 100%)',
              }}
            >
              Start my first mission
            </button>
          </section>

        </div>
      </motion.div>
    </div>
  );
}
