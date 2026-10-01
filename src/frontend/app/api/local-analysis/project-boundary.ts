import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export type GovernedAnalysisContext = {
  project_id: string;
  analysis_id: string;
  authority: "explicit" | "dashboard" | "catalogue";
};

export class ProjectBoundaryViolation extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "PROJECT_CONTEXT_REQUIRED" | "ANALYSIS_CONTEXT_MISMATCH" | "PROJECT_MEMBERSHIP_MISMATCH" | "ANALYSIS_NOT_CATALOGUED",
  ) {
    super(message);
    this.name = "ProjectBoundaryViolation";
  }
}

function projectRoot() {
  let current = process.cwd();
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "api_server.py"))) return current;
    current = path.dirname(current);
  }
  return path.resolve(process.cwd(), "../..");
}

async function cataloguedProjectId(analysisId: string): Promise<string | undefined> {
  try {
    const index = JSON.parse(
      await fs.readFile(path.join(projectRoot(), "outputs/api_results/catalogue_index.json"), "utf8"),
    );
    const value = index?.analyses?.[analysisId]?.project_id;
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

function requestedContext(request: NextRequest, analysisId: string) {
  const explicitProject =
    request.headers.get("x-datascene-project-id")?.trim() ||
    request.nextUrl.searchParams.get("project_id")?.trim() ||
    "";
  const explicitAnalysis =
    request.headers.get("x-datascene-analysis-id")?.trim() ||
    request.nextUrl.searchParams.get("context_analysis_id")?.trim() ||
    "";
  if (explicitAnalysis && explicitAnalysis !== analysisId) {
    throw new ProjectBoundaryViolation(
      `Context analysis ${explicitAnalysis} does not match requested analysis ${analysisId}.`,
      409,
      "ANALYSIS_CONTEXT_MISMATCH",
    );
  }
  if (explicitProject) return { projectId: explicitProject, authority: "explicit" as const };

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      const projectId = url.searchParams.get("activeProject")?.trim();
      if (projectId) return { projectId, authority: "dashboard" as const };
      if (url.searchParams.has("catalogue")) return { projectId: "", authority: "catalogue" as const };
      if (url.pathname.startsWith("/dashboard")) {
        return { projectId: "bond-cop30-helsinki", authority: "dashboard" as const };
      }
    } catch {
      // An invalid referrer is not authority.
    }
  }
  throw new ProjectBoundaryViolation(
    "A governed project context is required for analysis access.",
    428,
    "PROJECT_CONTEXT_REQUIRED",
  );
}

export async function assertLocalAnalysisBoundary(
  request: NextRequest,
  analysisId: string,
): Promise<GovernedAnalysisContext> {
  const requestContext = requestedContext(request, analysisId);
  const actualProjectId = await cataloguedProjectId(analysisId);
  if (!actualProjectId) {
    throw new ProjectBoundaryViolation(
      `Analysis ${analysisId} has no governed project membership.`,
      404,
      "ANALYSIS_NOT_CATALOGUED",
    );
  }
  if (requestContext.authority !== "catalogue" && requestContext.projectId !== actualProjectId) {
    throw new ProjectBoundaryViolation(
      `Analysis ${analysisId} belongs to ${actualProjectId}, not ${requestContext.projectId}.`,
      403,
      "PROJECT_MEMBERSHIP_MISMATCH",
    );
  }
  return {
    project_id: actualProjectId,
    analysis_id: analysisId,
    authority: requestContext.authority,
  };
}

export function projectBoundaryErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ProjectBoundaryViolation)) return null;
  return NextResponse.json(
    {
      detail: error.message,
      code: error.code,
      boundary: "project_analysis_entity",
    },
    { status: error.status, headers: { "cache-control": "no-store" } },
  );
}

export function bindContextToLocalUrl(url: string, context: GovernedAnalysisContext): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}project_id=${encodeURIComponent(context.project_id)}&context_analysis_id=${encodeURIComponent(context.analysis_id)}`;
}
