import type { Metadata } from "next";
import "../../../../styles/globals.css";
import AnalyzePage from "@/components/AnalyzePage";
import AnalyzePageV2 from "@/app/V2components/AnalyzePageV2";

export const metadata: Metadata = {
  title: "VAA1 Platform - Analyze Results",
  description: "Prototype frontend for the VAA1 project",
};

export const dynamic = "force-dynamic";

export default function AnalyzeResultsPage() {
  // return <AnalyzePage />;
  return <AnalyzePageV2 />;
}
