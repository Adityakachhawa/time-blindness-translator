'use client';

import Header from '@/components/hyperdopa/Header';
import Footer from '@/components/hyperdopa/Footer';
import { LifeBuoy } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      <Header />

      <main className="flex-1 w-full relative z-10 max-w-2xl mx-auto px-4 pt-16 pb-24 text-center">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
            <LifeBuoy className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Support</h1>
          <p className="text-lg opacity-80 font-medium">
            Need help with HyperDopa tools?
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8 mb-8 text-left">
          <h2 className="text-xl font-bold mb-3">Reporting Issues</h2>
          <p className="opacity-80 mb-4">
            Since HyperDopa and Time Translator are currently in active development, we don't have a dedicated support email just yet. 
          </p>
          <p className="opacity-80">
            If you encounter a bug, the fastest way to resolve local issues is to clear your browser data for this site (note: this will reset your task history and trophies). 
            We are working on a more robust way to gather feedback and bug reports from the community.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
