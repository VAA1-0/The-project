import type { Metadata } from "next";
import "../../styles/globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "VAA1 Platform",
  description: "Prototype frontend for the VAA1 project",
};

// Root layout component wrapping the application
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
        <Header />
        {children}
      </body>
    </html>
  );
}
