import type { Metadata } from "next";
import "../../styles/globals.css";
import { Dashboard } from "@/components/Dashboard";
import AnalyzePageV2 from "@/app/V2components/AnalyzePageV2";

export const metadata: Metadata = {
  title: "VAA1 Platform - Dashboard",
  description: "Prototype frontend for the VAA1 project",
};

export default function DashboardPage() {
  // return <Dashboard />;
  return <AnalyzePageV2 />;
}
