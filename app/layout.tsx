import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });
const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins"
});

export const metadata: Metadata = {
  title: "InterviewAI - AI-Powered Interview Assistant",
  description: "Transform your technical interviews with real-time AI assistance, intelligent transcription, and context-aware responses powered by cutting-edge LLMs and RAG technology.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${poppins.variable}`}>
        <div className="min-h-screen bg-white">
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
