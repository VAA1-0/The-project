export type ProjectScopeViolation = {
  active_project_id: string;
  rejected_analysis_id: string;
  source: "event" | "restored_panel_state";
  message: string;
};

let activeProjectId = "";
let catalogueMode = false;
let membershipReady = false;
let allowedAnalysisIds = new Set<string>();

export function configureActiveProjectScopeFromLocation(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  catalogueMode = params.has("catalogue");
  activeProjectId = params.get("activeProject")?.trim() || (catalogueMode ? "" : "bond-cop30-helsinki");
  if (catalogueMode) membershipReady = true;
}

export function setActiveProjectMembership(projectId: string | undefined, analysisIds: string[]): void {
  configureActiveProjectScopeFromLocation();
  if (catalogueMode) return;
  if (!projectId || projectId !== activeProjectId) return;
  allowedAnalysisIds = new Set(analysisIds.filter(Boolean));
  membershipReady = true;
}

export function activeProjectScopeId(): string {
  configureActiveProjectScopeFromLocation();
  return activeProjectId;
}

export function isAnalysisAllowedInActiveProject(analysisId: string): boolean {
  // The event bus is imported by server-side rendering and source-level unit
  // tests where no browser project workspace exists. The server route boundary
  // owns enforcement there; browser events are governed by the loaded allowlist.
  if (typeof window === "undefined") return true;
  configureActiveProjectScopeFromLocation();
  if (!analysisId || catalogueMode) return true;
  return membershipReady && allowedAnalysisIds.has(analysisId);
}

export function projectScopeViolation(analysisId: string, source: ProjectScopeViolation["source"]): ProjectScopeViolation {
  return {
    active_project_id: activeProjectId,
    rejected_analysis_id: analysisId,
    source,
    message: `Blocked analysis ${analysisId}: it is not a member of project ${activeProjectId || "catalogue"}.`,
  };
}

export function sanitizeProjectScopedProps<T extends Record<string, unknown>>(props: T): T {
  const candidates = [props.videoId, props.analysisId].filter((value): value is string => typeof value === "string" && Boolean(value));
  const rejected = candidates.find((id) => !isAnalysisAllowedInActiveProject(id));
  if (!rejected) return props;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vaa1-project-scope-violation", { detail: projectScopeViolation(rejected, "restored_panel_state") }));
  }
  const clean = { ...props };
  delete clean.videoId;
  delete clean.analysisId;
  return clean;
}
