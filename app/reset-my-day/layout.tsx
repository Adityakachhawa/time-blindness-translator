/**
 * app/reset-my-day/layout.tsx
 *
 * Layout for the Reset My Day route.
 * Uses standard HyperDopa Header and Footer.
 * TimerProvider is NOT moved here — TBT handles its own context.
 */
import type { Metadata } from 'next';
import Header from '@/components/hyperdopa/Header';
import Footer from '@/components/hyperdopa/Footer';

export const metadata: Metadata = {
  title: 'Reset My Day | HyperDopa',
  description:
    'Things got off track. Figure out what still matters and make a plan for the rest of your day.',
  keywords: [
    'ADHD productivity',
    'reset my day',
    'executive dysfunction',
    'task planning',
    'neurodivergent tools',
  ],
};

export default function ResetMyDayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      <Header />
      <main className="flex-1 w-full relative z-10">{children}</main>
      <Footer />
    </div>
  );
}
