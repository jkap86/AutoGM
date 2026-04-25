import type { Metadata } from "next";
import { Space_Grotesk, Rajdhani } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sleepier - Fantasy Football Automation",
  description:
    "Automate trades, polls, and roster management on Sleeper.com with the Sleepier desktop app.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${rajdhani.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
