import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdf6ec' },
    { media: '(prefers-color-scheme: dark)', color: '#1e293b' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://time-blindness-translator.vercel.app"),
  title: "HyperDopa | Tools for when your brain gets stuck",
  description:
    "Practical tools for time estimation, productivity friction, and task initiation when your brain gets stuck.",
  keywords: [
    "ADHD tools",
    "neurodivergent productivity",
    "executive dysfunction",
    "task initiation",
    "time estimation",
  ],
  openGraph: {
    title: "HyperDopa | Tools for when your brain gets stuck",
    description:
      "Practical tools for time estimation, productivity friction, and task initiation when your brain gets stuck.",
    url: "https://time-blindness-translator.vercel.app",
    siteName: "HyperDopa",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HyperDopa | Tools for when your brain gets stuck",
    description:
      "Practical tools for time estimation, productivity friction, and task initiation when your brain gets stuck.",
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
        <link rel="manifest" href="/manifest.json" />
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
