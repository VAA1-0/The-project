# Frontend Architecture Overview

This document explains how the frontend of our application works, including Next.js folder structure, page component loading, navigation, and the purpose of key files such as `layout.tsx` and `page.tsx`.

---

## 1. Next.js Folder Structure

The frontend follows the standard **Next.js 13+ App Router** conventions. For example:

```bash
├─ layout.tsx # Root layout shared across pages
├─ page.tsx # Entry point for the main page
├─ dashboard/
│ ├─ page.tsx # Dashboard page component
│ └─ components/ # Optional subcomponents specific to dashboard
├─ components/ # Shared UI components
└─ styles/ # Global and module-specific CSS/SCSS
```

### Key points:

- **`page.tsx`**: Every route must have a `page.tsx`. This is the entry point for that route. For example, `app/dashboard/page.tsx` renders the `/dashboard` route.
- **`layout.tsx`**: Provides shared layout (e.g., headers, footers, wrappers) for all pages in the folder. Nested layouts allow you to have shared components at different route levels.
- **`components/`**: Reusable UI components such as buttons, cards, inputs, separators, and logos. Also page designs.

---

## 2. Page Component Loading

Next.js automatically handles **server-side rendering (SSR)**, **static site generation (SSG)**, and **client-side rendering (CSR)** depending on how you define your components:

- By default, `page.tsx` is server-rendered.
- To enable client-side interactivity (e.g., using `useState` or `useEffect`), you must add `"use client";` at the top of the component.
- Components in `components/` can be either client or server components depending on whether they need React hooks or browser APIs.

---

## 3. Navigation

Next.js provides a built-in `useRouter` hook for navigation. For example:

```tsx
"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    // Perform sign out logic
    router.push("/login"); // Redirect to login
  };

  return <button onClick={handleLogout}>Sign Out</button>;
}
```
`Link` is also available. Usage could be considered.

```tsx
import Link from "next/link";

export default function Navbar() {
  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/profile">Profile</Link>
    </nav>
  );
}

```

---

## 4. Layouts

`layout.tsx` is a shared wrapper for pages. Can contain headers, footers, sidebars or theme providers. Supports nested layouts for per-section customization. For example:

```tsx
import "../styles/globals.css";
import { Header } from "@/components/Header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

---

## 5. Why files must be named page.tsx?

- Next.js routes are file-based, not component-based
- A `page.tsx` file defines a route endpoint
- Any other file in the folder will not automatically become a route; instead, it can be imported as a component

```bash
app/dashboard/page.tsx      -> /dashboard
app/dashboard/stats.tsx     -> NOT a route, only a component
```

---

## 6. Best practises

- Keep shared UI components in `components/` folder.
- Use layouts for repeated structures like headers, footers, and sidebars.
- Use `page.tsx` only for routes; keep logic and reusable UI in separate components.
- Use client components selectively to avoid unnecessary client bundle size.
- Leverage TypeScript for props and state type safety.

