import type { Metadata } from "next";
import "../../styles/globals.css";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "VAA1 Platform",
  description: "Prototype frontend for the VAA1 project",
};

export default function DashboardPage() {
  return <Dashboard />;
}
