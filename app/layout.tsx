import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Time-Blindness Translator | ADHD-Friendly Timer",
  description:
    "A shame-free, neurodivergent-friendly timer that translates abstract minutes into relatable anchors like TV episodes and songs. Includes an ADHD Tax buffer and a visual countdown — no ticking clock.",
  keywords: [
    "ADHD timer",
    "time blindness",
    "neurodivergent productivity",
    "ADHD tools",
    "executive dysfunction",
    "focus timer",
    "adulting certificate",
  ],
  openGraph: {
    title: "Time-Blindness Translator",
    description:
      "Turn 'I'll do it in 15 minutes' into something your ADHD brain can actually believe.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Time-Blindness Translator",
    description:
      "A shame-free ADHD timer with real-world time anchors and dopamine rewards.",
    creator: "@Aditya_X_Writes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        {/* Google AdSense — replace YOUR_ADSENSE_ID with your publisher ID */}
        {/* <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR_ADSENSE_ID"
          crossOrigin="anonymous"
        /> */}
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
