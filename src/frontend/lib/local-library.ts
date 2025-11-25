// Key used in localStorage
const LIB_KEY = "local_video_library";

// ---- Data structures ----
export interface VideoItem {
  id: string;
  name: string;
  length: number; // in seconds
  folderId: string | null;
  analysis: any; // placeholder now
}

export interface FolderItem {
  id: string;
  name: string;
}

export interface LibraryState {
  videos: VideoItem[];
  folders: FolderItem[];
}

// ---- Load/save from localStorage ----

function load(): LibraryState {
  if (typeof window === "undefined") return { videos: [], folders: [] };

  const raw = localStorage.getItem(LIB_KEY);
  return raw ? JSON.parse(raw) : { videos: [], folders: [] };
}

function save(state: LibraryState) {
  localStorage.setItem(LIB_KEY, JSON.stringify(state));
}

// ---- CRUD operations (backend-like) ----

export const Library = {
  getAll() {
    return load();
  },

  getById(id: string) {
  return this.getAll().videos.find(v => v.id === id);
  },

  addVideo(video: VideoItem) {
    const state = load();
    state.videos.push(video);
    save(state);
  },

  updateVideo(id: string, updates: Partial<VideoItem>) {
    const state = load();
    state.videos = state.videos.map(v => v.id === id ? { ...v, ...updates } : v);
    save(state);
  },

  deleteVideo(id: string) {
    const state = load();
    state.videos = state.videos.filter(v => v.id !== id);
    save(state);
  },

  addFolder(folder: FolderItem) {
    const state = load();
    state.folders.push(folder);
    save(state);
  },

  updateFolder(id: string, updates: Partial<FolderItem>) {
    const state = load();
    state.folders = state.folders.map(f => f.id === id ? { ...f, ...updates } : f);
    save(state);
  },

  deleteFolder(id: string) {
    const state = load();
    state.folders = state.folders.filter(f => f.id !== id);
    save(state);
  },
};