"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CvatCanvas } from "@/cvat-api/components/CvatCanvas";
import { listJobs } from "@/cvat-api/client";
import { VideoService } from "@/lib/video-service";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export default function AnnotatePage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  
  const [metadata, setMetadata] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobData() {
      if (!id) return;
      
      setIsLoading(true);
      setError(null);

      try {
        // Load video metadata to get CVAT ID
        const videoMeta = await VideoService.get(id);
        setMetadata(videoMeta);

        const cvatID = videoMeta?.cvatID;
        
        if (!cvatID) {
          setError("No CVAT task ID found for this video. Please upload the video again.");
          setIsLoading(false);
          return;
        }

        // Fetch jobs for this CVAT task
        console.log(`📂 Loading jobs for CVAT task ${cvatID}...`);
        const result = await listJobs(cvatID);
        const jobList = Array.isArray(result) ? result : result.results || [];
        
        setJobs(jobList);
        
        // Auto-select first job if available
        if (jobList.length > 0) {
          setSelectedJob(jobList[0]);
          console.log(`✅ Loaded ${jobList.length} job(s), selected job ${jobList[0].id}`);
        } else {
          setError("No annotation jobs found for this task. The task may still be processing.");
        }
        
      } catch (err) {
        console.error("Failed to load annotation data:", err);
        setError("Failed to load annotation jobs. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadJobData();
  }, [id]);

  // Handle going back to analysis page
  const handleBack = () => {
    router.push(`/dashboard/analyze-results/${id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="text-lg font-semibold mb-2">Loading Annotation Canvas...</div>
              <div className="text-sm text-slate-400">Please wait while we load your CVAT workspace</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle className="text-red-400">Error Loading Annotation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">{error}</p>
            <Button onClick={handleBack} className="w-full">
              Back to Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedJob) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardHeader>
            <CardTitle>No Jobs Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">
              No annotation jobs were found for this video. The task may still be processing.
            </p>
            <Button onClick={handleBack} className="w-full">
              Back to Analysis
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Top navigation bar */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-6 py-3 flex items-center justify-between">

        
        {jobs.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Job:</span>
            <select
              value={selectedJob.id}
              onChange={(e) => {
                const job = jobs.find(j => j.id === parseInt(e.target.value));
                if (job) setSelectedJob(job);
              }}
              className="bg-slate-700 border border-slate-600 text-white rounded px-3 py-1 text-sm"
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  Job {job.id} ({job.status || 'unknown'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* CVAT Canvas - takes full remaining height */}
      <div className="flex-1 overflow-hidden">
        <CvatCanvas 
          jobId={selectedJob.id} 
          taskId={metadata?.cvatID}
        />
      </div>
    </div>
  );
}
