"use client";
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-56 h-screen border-r border-gray-200 dark:border-gray-800 p-4 hidden sm:block">
      <nav className="flex flex-col gap-3">
        <Link href="/" className="hover:underline">Home</Link>
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <Link href="/settings" className="hover:underline">Settings</Link>
      </nav>
    </aside>
  );
}
