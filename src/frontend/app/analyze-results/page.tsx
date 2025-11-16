import type { Metadata } from "next";
import "../../styles/globals.css";
import AnalyzePage from "@/components/AnalyzePage";

export const metadata: Metadata = {
  title: "VAA1 Platform - Analyze Results",
  description: "Prototype frontend for the VAA1 project",
};

export default function AnalyzeResultsPage() {
  return <AnalyzePage />;
}