'use client';

import Header from '@/components/hyperdopa/Header';
import Footer from '@/components/hyperdopa/Footer';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      <Header />

      <main className="flex-1 w-full relative z-10 max-w-3xl mx-auto px-4 pt-16 pb-24">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-sage-500/10 text-sage-500 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Privacy & Data</h1>
        </div>

        <div className="prose dark:prose-invert max-w-none">
          <p className="text-lg opacity-80 mb-8 font-medium">
            HyperDopa tools are designed to respect your focus and your privacy. Here is exactly how your data is handled.
          </p>

          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4">1. Local-First Architecture</h2>
            <p className="mb-3 opacity-80">
              The vast majority of your data never leaves your device. The Time Translator uses a local-first architecture, meaning:
            </p>
            <ul className="list-disc pl-5 opacity-80 space-y-2">
              <li>Your task history, time estimates, and performance data are stored in your browser's local storage.</li>
              <li>Your trophies, milestones, and personal settings (like themes and audio preferences) remain strictly on your device.</li>
              <li>We do not have access to your tasks or history. If you clear your browser data or switch devices, this data will be lost.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4">2. What Is Transmitted (And Why)</h2>
            <p className="mb-3 opacity-80">
              There are only two specific features that require communication with our servers:
            </p>
            <div className="glass-card rounded-2xl p-6 mb-4">
              <h3 className="font-bold mb-2">A. Global Mission Counter</h3>
              <p className="opacity-80 text-sm">
                When you successfully complete a mission in Time Translator, the app sends a completely anonymous "ping" to our server to increment a global counter. This allows us to show the total number of missions completed today by all users. No task details, times, or identifying information are sent.
              </p>
            </div>
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold mb-2">B. Push Notifications (Optional)</h3>
              <p className="opacity-80 text-sm">
                If you choose to enable background notifications, your browser generates a "Push Subscription" token. We store this token securely alongside a randomly generated, anonymous Device ID. This allows our backend infrastructure (Upstash / QStash) to securely deliver the "Time is up!" alert to your device even if the app is closed. This subscription does not identify who you are, and you can revoke permission directly in your browser settings at any time.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4">3. No Accounts or Tracking</h2>
            <ul className="list-disc pl-5 opacity-80 space-y-2">
              <li><strong>No Accounts:</strong> You do not need to create an account, provide an email, or set a password to use our tools.</li>
              <li><strong>No Analytics Tracking:</strong> We do not currently use third-party product analytics tools like Google Analytics or Mixpanel to track your clicks or behavior within the app.</li>
              <li><strong>No Ads:</strong> We do not show advertisements or sell your data to brokers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4">4. Transparency</h2>
            <p className="opacity-80">
              Because this project is built for the neurodivergent community, transparency is paramount. We only claim privacy where the code guarantees it. We will always update this page if our technical infrastructure changes.
            </p>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
