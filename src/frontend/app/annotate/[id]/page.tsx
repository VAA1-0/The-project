import type { Metadata } from "next";
import "../../../styles/globals.css";
import AnnotatePage from "@/components/AnnotatePage";

export const metadata: Metadata = {
  title: "VAA1 Platform - Annotate Video",
  description: "CVAT annotation interface for video analysis",
};

export const dynamic = "force-dynamic";

export default function AnnotatePageRoute() {
  return <AnnotatePage />;
}
