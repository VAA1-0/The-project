# Frontend Architecture Overview

This document explains how the frontend of our application works, including Next.js folder structure, page component loading, navigation, and the purpose of key files such as `layout.tsx` and `page.tsx`. It also includes thoughts and issues about `useState` usage.

ChatGPT was used with the generation of this document.

---

## 1. Next.js Folder Structure

The frontend follows the standard **Next.js 13+ App Router** conventions. For example:

```bash
├─ layout.tsx # Root layout shared across pages
├─ page.tsx # Entry point for the main page
├─ dashboard/
│ ├─ page.tsx # Dashboard page component
│ └─ components/ # For example optional subcomponents specific to dashboard
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
In this case, the `children` is the actual page's content.

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

---

## 7. 'useState' usage

### 7.1 Server vs Client components
- Next.js 13+ defaults to **server components** for `page.tsx` and `layout.tsx`
- `useState` **only works in client components** ("use client"; at the top)
- Overusing useState may force you to mark large parts of your UI as client components, which:
  - Increases bundle size
  - Moves logic from server to client unnecessarily
  - Can impact **performance** and **SEO**, because server-rendered content is faster to load and indexed better.
- ✅Simple components like stats cards or dashboard layout, that don't need interactivity, **should remain server components**
  - Only interactive parts (like file upload, toggles) should be client components

### 7.2 State management for shared data

If multiple components need the same state...

- Using `useState` locally in a component can lead to **prop drilling** or duplicated state
- Better alternatives:
  - **React context**: centralized state for the dashboard
  - **Server-side state**: fetching current videos or analysis results via `getServerSideProps` or `fetch` in server component
  - **Global state libraries**: e.g. Zustand or Redux if the app gets complex
- ✅ Upload video files could be managed in a central store rather than each upload component using its own `useState`

### 7.3 Persistence across navigation

- `useState` is **ephimeral**: it resets whenever a component is unmounted
- In a multi-page dashboard, if you navigate away and back:
  - All `useState` data in the previous page is **lost**
  - You might want to upload files, progress or results to **presist** which requires:
    - Centralized state
    - URL query params
    - Server state / API calls

### 7.4 Potential race conditions in async workflows

- Video analysis and file uploads are async and possibly long-running.
- Using `useState` to track progress directly in the UI can lead to:
  - Out-of-sync UI if multiple uploads happen quickly
  - Hard-to-manage state if multiple components update it
- A better approach is:
  - Server-managed state (API returns current upload/processing status)
  - Subscriptions / polling / WebSockets for live updates

### 7.5 ✅ Summary 
- Don’t use useState in large, non-interactive parts of your app.
- **Use client components** sparingly, only for:
  - File upload interactions
  - Toggle buttons / filters
  - Dynamic charts that need immediate updates
- **Consider central/global state** for:
  - Uploads
  - Video library
  - Analysis progress
