import type { Metadata } from "next";
import "../../styles/globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "VAA1 Platform",
  description: "Prototype frontend for the VAA1 project",
};

// Root layout component wrapping the application
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nested layouts must not render <html> or <body> — only the root layout does.
  return (
    <>
      <Header />
      {children}
    </>
  );
}
