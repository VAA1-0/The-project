"use client";

export default function Navbar() {
  return (
    <nav className="h-14 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
      <h1 className="text-lg font-semibold">VAA1 Dashboard</h1>
      <div className="flex gap-3">
        <button className="text-sm px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
          Profile
        </button>
        <button className="text-sm px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
          Logout
        </button>
      </div>
    </nav>
  );
}
