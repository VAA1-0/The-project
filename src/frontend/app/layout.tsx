import type { Metadata } from "next";
import "../styles/globals.css";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
  title: "VAA1 Platform",
  description: "Prototype frontend for the VAA1 project",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex flex-col flex-1 min-h-screen">
          <Navbar />
          <main className="p-6 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
