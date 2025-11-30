// lib/video-service.ts

import { api } from "./api-client";
import { Library } from "./local-library";    // your current metadata storage
import { saveVideoBlob, getVideoBlob, deleteVideoBlob } from "./blob-store";

const USE_BACKEND = Boolean(process.env.NEXT_PUBLIC_API_URL); 
// If the backend URL is set → backend mode
// If not → automatic fallback to local mode

export const VideoService = {
  // -----------------------------
  // GET VIDEO METADATA
  // -----------------------------
  async get(id: string) {
    if (USE_BACKEND) {
      try {
        const res = await api.get(`/videos/${id}`);
        return res.data;
      } catch (err) {
        console.warn("Backend unavailable, using fallback local DB");
      }
    }
    return Library.getById(id);
  },

  // -----------------------------
  // GET VIDEO BLOB (actual file)
  // -----------------------------
  async getBlob(id: string) {
    if (USE_BACKEND) {
      try {
        const res = await api.get(`/videos/${id}/blob`, {
          responseType: "blob",
        });
        return res.data;
      } catch (err) {
        console.warn("Backend unavailable, using fallback blob");
      }
    }
    return getVideoBlob(id);
  },

  // -----------------------------
  // GET ANALYSIS
  // -----------------------------
  async getAnalysis(id: string) {
    if (USE_BACKEND) {
      try {
        return await api.get(`/videos/${id}/analysis`);
      } catch (err) {
        console.warn("Backend unavailable — using placeholder analysis");
      }
    }
    // richer fallback placeholder (used by AnalyzePage)
    return {
      summary: "This is a placeholder summary generated locally.",
      transcript: [
        { t: "00:00", speaker: "Speaker 1", text: "Placeholder intro text." },
        { t: "00:30", speaker: "Speaker 2", text: "More placeholder transcript." },
      ],
      detectedObjects: [
        { name: "Person", count: 5, firstSeen: "00:02", confidence: 0.98 },
        { name: "Laptop", count: 1, firstSeen: "00:20", confidence: 0.95 },
      ],
      quantityDetection: [
        { label: "People Count Over Time", data: [0,2,3,5] }
      ],
      annotations: [
        { note: "Interesting moment at 00:45", time: "00:45" }
      ],
      // small CSV preview used by AnalyzePage raw viewer
      rawCsv: "timestamp,object,confidence\n00:00,Person,0.98\n00:05,Laptop,0.95\n00:10,Person,0.97\n",
    };
  },

  // -----------------------------
  // UPLOAD - local or backend
  // -----------------------------
  // Accept optional length (seconds) computed by caller
  async upload(file: File, length: number | null = null) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (USE_BACKEND) {
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await api.post("/videos", form);
        return res.data;
      } catch (err) {
        console.warn("Backend upload failed. Using local fallback.");
      }
    }

    // Fallback local upload (your existing logic)
    await saveVideoBlob(id, file);
    // Add minimal VideoItem shape expected by local-library
    Library.addVideo({
      id,
      name: file.name,
      length: length ?? 0,
      tag: null,
      analysis: null,
    });

    return { success: true, id };
  },

  // -----------------------------
  // RENAME
  // -----------------------------
  async rename(id: string, newName: string) {
    if (USE_BACKEND) {
      try {
        const res = await api.patch(`/videos/${id}`, { name: newName });
        return res.data;
      } catch (err) {
        console.warn("Backend rename unavailable, local fallback.");
      }
    }

    Library.updateVideoName(id, { name: newName });
    return { success: true };
  },

  // Update video tag in local fallback or backend
  async updateTag(id: string, newTag: string | null) {
    if (USE_BACKEND) {
      try {
        return await api.patch(`/videos/${id}`, { tag: newTag });
      } catch (err) {
        console.warn("Backend tag update unavailable, local fallback.");
      }
    }

    Library.updateVideoTag(id, { tag: newTag });
    return { success: true };
  },

  // -----------------------------
  // DELETE VIDEO
  // -----------------------------
  async delete(id: string) {
    if (USE_BACKEND) {
      try {
        const res = await api.delete(`/videos/${id}`);
        return res.data;
      } catch (err) {
        console.warn("Backend delete unavailable, local fallback.");
      }
    }

    // local delete:
    await deleteVideoBlob(id);
    Library.deleteVideo(id);
    return { success: true };
  },

  // -----------------------------
  // LIST ALL VIDEOS
  // -----------------------------
  async list() {
    if (USE_BACKEND) {
      try {
        const res = await api.get("/videos");
        return res.data;
      } catch (err) {
        console.warn("Backend unavailable. Using local fallback.");
      }
    }

    return Library.getAll().videos;
  },
};
