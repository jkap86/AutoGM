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
  metadataBase: new URL(process.env.SITE_URL || "https://autogm-8d8d424e3286.herokuapp.com"),
  title: "AutoGM - Fantasy Football Automation",
  description:
    "Batch trades, waivers, polls, DMs, and opponent scouting across all your Sleeper.com leagues from one desktop app.",
  openGraph: {
    title: "AutoGM - Fantasy Football Automation",
    description:
      "Batch trades, waivers, polls, DMs, and opponent scouting across all your Sleeper.com leagues from one desktop app.",
    images: [{ url: "/images/logo.png", width: 256, height: 256, alt: "AutoGM logo" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AutoGM - Fantasy Football Automation",
    description:
      "Batch trades, waivers, polls, DMs, and opponent scouting across all your Sleeper.com leagues from one desktop app.",
    images: ["/images/logo.png"],
  },
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
