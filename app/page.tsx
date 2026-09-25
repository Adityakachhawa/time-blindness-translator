'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Header from '@/components/hyperdopa/Header';
import Footer from '@/components/hyperdopa/Footer';
import { ArrowRight, Clock, Rocket, RotateCcw, BrainCircuit } from 'lucide-react';

export default function HyperDopaHome() {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      <Header />

      <main className="flex-1 w-full relative z-10">
        {/* Hero Section */}
        <section className="max-w-3xl mx-auto px-4 pt-24 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Tools for when your brain gets <span style={{ color: 'var(--color-coral-500)' }}>stuck.</span>
            </h1>
            <p className="text-lg md:text-xl opacity-80 mb-10 max-w-2xl mx-auto font-medium">
              You don't need another productivity system. You need help with the specific moment where you can't move forward.
            </p>
            
            <Link 
              href="/time-translator"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-bold text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg outline-none"
              style={{ backgroundColor: 'var(--color-coral-500)' }}
            >
              Try Time Translator <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </section>

        {/* Tools Grid Section */}
        <section id="tools" className="max-w-5xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Flagship Tool */}
            <Link href="/time-translator" className="block outline-none">
              <motion.div 
                whileHover={{ y: -4 }}
                className="glass-card rounded-3xl p-8 h-full flex flex-col relative overflow-hidden group cursor-pointer"
                style={{
                  border: '2px solid var(--color-coral-500)',
                }}
              >
                <div className="absolute top-6 right-6 px-3 py-1 bg-coral-500 text-white text-xs font-bold uppercase tracking-widest rounded-full">
                  Live
                </div>
                <div className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center bg-coral-500/10 text-coral-500">
                  <Clock className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
                  Time Translator
                </h2>
                <p className="text-sm font-semibold opacity-60 mb-2 italic">
                  "Can't tell how long something will actually take?"
                </p>
                <p className="opacity-80 font-medium mb-8">
                  Estimate it. Translate it. Run the mission. Learn from reality.
                </p>
                <div className="mt-auto flex items-center gap-2 text-coral-500 font-bold text-sm uppercase tracking-wider group-hover:gap-3 transition-all">
                  Open Time Translator <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            </Link>

            {/* Future Tools - Experiments */}
            <div className="glass-card rounded-3xl p-8 h-full flex flex-col relative opacity-80 cursor-default">
              <div className="absolute top-6 right-6 px-3 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-widest rounded-full">
                Experiment
              </div>
              <div className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center bg-amber-500/10 text-amber-500">
                <Rocket className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Start Me</h2>
              <p className="text-sm font-semibold opacity-60 mb-2 italic">
                "I know what I need to do. I just can't start."
              </p>
              <div className="mt-auto pt-8">
                <button 
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors w-full sm:w-auto outline-none"
                  onClick={(e) => { e.preventDefault(); alert("We're currently exploring how to build this. Check back later!"); }}
                >
                  Join Waitlist
                </button>
              </div>
            </div>

            <Link href="/reset-my-day" className="block outline-none">
              <motion.div
                whileHover={{ y: -4 }}
                className="glass-card rounded-3xl p-8 h-full flex flex-col relative overflow-hidden group cursor-pointer"
                style={{
                  border: '2px solid var(--color-coral-400)',
                }}
              >
                <div className="absolute top-6 right-6 px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full" style={{ background: 'var(--color-coral-500)', color: 'white' }}>
                  Beta
                </div>
                <div className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center bg-ink-500/10 text-ink-500 dark:text-ink-300">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Reset My Day</h2>
                <p className="text-sm font-semibold opacity-60 mb-2 italic">
                  "My plan fell apart. What can I realistically still do?"
                </p>
                <p className="opacity-80 font-medium mb-8">
                  Tell it what time you have left and what still needs doing. It makes a realistic plan.
                </p>
                <div className="mt-auto flex items-center gap-2 text-coral-500 font-bold text-sm uppercase tracking-wider group-hover:gap-3 transition-all">
                  Open Reset My Day <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            </Link>

            <div className="glass-card rounded-3xl p-8 h-full flex flex-col relative opacity-80 cursor-default">
              <div className="absolute top-6 right-6 px-3 py-1 bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-widest rounded-full">
                Experiment
              </div>
              <div className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center bg-purple-500/10 text-purple-500">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Brain Dump</h2>
              <p className="text-sm font-semibold opacity-60 mb-2 italic">
                "Too much in my head?"
              </p>
              <div className="mt-auto pt-8">
                <button 
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors w-full sm:w-auto outline-none"
                  onClick={(e) => { e.preventDefault(); alert("This concept is in early validation phase."); }}
                >
                  Express Interest
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* How It Works / Core Loop */}
        <section id="how-it-works" className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl font-bold mb-16">The Time Translator Philosophy</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-start relative">
            {/* Steps line for desktop */}
            <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-0.5 bg-ink-300/20 z-0"></div>

            <div className="flex flex-col items-center relative z-10">
              <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center font-bold mb-4 shadow-sm text-coral-500">1</div>
              <h3 className="font-bold text-sm uppercase tracking-wider mb-2">Estimate</h3>
              <p className="text-xs opacity-70">Guess how long a task takes.</p>
            </div>

            <div className="flex flex-col items-center relative z-10">
              <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center font-bold mb-4 shadow-sm text-amber-500">2</div>
              <h3 className="font-bold text-sm uppercase tracking-wider mb-2">Translate</h3>
              <p className="text-xs opacity-70">Convert abstract time to real anchors.</p>
            </div>

            <div className="flex flex-col items-center relative z-10">
              <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center font-bold mb-4 shadow-sm text-sage-500">3</div>
              <h3 className="font-bold text-sm uppercase tracking-wider mb-2">Mission</h3>
              <p className="text-xs opacity-70">Run the timer and do the work.</p>
            </div>

            <div className="flex flex-col items-center relative z-10">
              <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center font-bold mb-4 shadow-sm text-lavender-500">4</div>
              <h3 className="font-bold text-sm uppercase tracking-wider mb-2">Reality</h3>
              <p className="text-xs opacity-70">Log when you actually finish.</p>
            </div>
            
            <div className="flex flex-col items-center relative z-10">
              <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center font-bold mb-4 shadow-sm text-coral-500">5</div>
              <h3 className="font-bold text-sm uppercase tracking-wider mb-2">Learn</h3>
              <p className="text-xs opacity-70">See your personal time bias.</p>
            </div>
            
            <div className="flex flex-col items-center relative z-10">
              <div className="w-12 h-12 rounded-full glass-card flex items-center justify-center font-bold mb-4 shadow-sm text-sage-500">6</div>
              <h3 className="font-bold text-sm uppercase tracking-wider mb-2 text-balance">Estimate Better</h3>
              <p className="text-xs opacity-70">Future estimates adjust automatically.</p>
            </div>
          </div>
        </section>

        {/* Why it is different */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <div className="glass-card rounded-3xl p-8 md:p-12 text-center border-t-4" style={{ borderTopColor: 'var(--color-coral-500)' }}>
            <h2 className="text-2xl font-bold mb-6">Why It's Different</h2>
            <p className="opacity-80 font-medium mb-6 text-lg">
              Time Translator doesn't just start a ticking clock. It is a personal learning loop.
            </p>
            <p className="opacity-80 font-medium">
              By comparing what you expected, what your personal time model predicted, and what actually happened, it uses your completed missions to make your future estimates more realistic. It learns how your brain experiences time.
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
