// src/renderer/api/client.ts
import axios from 'axios';

const BASE = "http://localhost:3001";

/*const backend = axios.create({
  baseURL: 'http://localhost:3001',
});*/

// <---- CVAT Login ---->
// 🔹 Token login (backend CVAT API access)
export async function loginToCvat(username: string, password: string) {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    //credentials: "include"
  });
  
  const data = await res.json();

  // 🔥 Store token in browser (renderer) localStorage
  /*if (data.token) {
    window.localStorage.setItem("cvat_token", data.token);
    console.log("🔑 CVAT token stored:", data.token);
  }*/

  return data;
}

export async function getCvatHealth() {
  console.log("Function Accessed!")
  return fetch(`${BASE}/health/cvat`).then(r => r.json());
}

export async function listTasks() {
  const res = await fetch(`${BASE}/api/tasks`);
  if (!res.ok) {
    throw new Error(`Failed to list tasks: ${res.statusText}`);
  }
  return res.json();
}

export async function listJobs(taskId: number) {
  const res = await fetch(`${BASE}/api/tasks/${taskId}/jobs`);
  if (!res.ok) {
    throw new Error(`Failed to list jobs: ${res.statusText}`);
  }
  return res.json();
}

export async function getAnnotations(jobId: number) {
  const res = await fetch(`${BASE}/api/jobs/${jobId}/annotations`);
  if (!res.ok) {
    throw new Error(`Failed to get annotations: ${res.statusText}`);
  }
  return res.json();
}

export async function saveAnnotations(jobId: number, body: any) {
  const res = await fetch(`${BASE}/api/jobs/${jobId}/annotations`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Failed to save annotations: ${res.statusText}`);
  }

  return res.json();
}

// Create task (video only)
export async function createVideoTask(
  name: string,
  //labels: Array<{ name: string; color: string }>,
  file: File
) {
  try {
    // Step 1: Create task structure via backend
    console.log("📝 Creating task structure...");
    const taskRes = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name/*, labels */}),
      //credentials: "include", // 🔥 required for cookie-based auth
    });

    if (!taskRes.ok) {
      const err = await taskRes.json().catch(() => null);
      throw new Error(err?.error || "Failed to create task");
    }

    const { taskId } = await taskRes.json();
    console.log(`✅ Task ${taskId} created`);

    // Step 2: Upload video *directly* to CVAT (fastest)
    console.log("📤 Uploading video...");
    const formData = new FormData();
    formData.append("video", file);
    formData.append("image_quality", "70");

    const uploadRes = await fetch(
      `${BASE}/api/tasks/${taskId}/data`,
      {
        method: "POST",
        body: formData,
        //credentials: "include", // 🔥 sends sessionid + csrftoken to CVAT
      }
    );

    if (!uploadRes.ok) {
      const msg = await uploadRes.text();
      throw new Error(`Video upload failed: ${msg}`);
    }

    console.log("🚀 Upload completed successfully");
    return { taskId };

  } catch (error: any) {
    console.error("❌ Task creation failed:", error);
    throw error;
  }
}


// 🔹 Cookie login (CVAT iframe access)
/*export async function loginForIframe(username: string, password: string) {
  const resp = await backend.post('/api/cvat/login', { username, password }, {
    withCredentials: true   // <── IMPORTANT
  });

  return resp.data;
}*/

export async function listExportFormats() {
  const res = await fetch("http://localhost:8080/api/server/annotation/formats");
  const data = await res.json();
  return data.exporters.map((f: any) => f.name);
}

let pollingIntervals: NodeJS.Timeout[] = [];

export function registerInterval(id: NodeJS.Timeout) {
  pollingIntervals.push(id);
}

export function stopAllIntervals() {
  pollingIntervals.forEach(clearInterval);
  pollingIntervals = [];
}


