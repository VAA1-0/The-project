// backend/server.ts
import express from 'express';
import cors from 'cors';
import multer from "multer";
import { postCvatLogin } from './cvatRoutes/cvat-login';
import { GlobalConstants, loadAuthFromDisk } from './data/GlobalVariables';
import { postCvatLogout } from './cvatRoutes/cavt-logout';
import { getCvatHealth } from './cvatRoutes/cvat-health';
import { postCvatTask } from './cvatRoutes/cvat-postTask';
import { getCvatTasks } from './cvatRoutes/cvat-getTask';
import { postCvatData } from './cvatRoutes/cvat-uploadData';
import { getCvatJobs } from './cvatRoutes/cvat-jobs';
import { getAnnotations } from './cvatRoutes/cvat-getAnnotation';
import { putAnnotation } from './cvatRoutes/cvat-postAnnotation';
import { getAnnotationFormats } from './cvatRoutes/cvat-annotationFormats';

const upload = multer({ storage: multer.memoryStorage() });

const app = express();

// Load saved token on startup
loadAuthFromDisk();

// Middleware
app.use(cors({
  origin: "*",
  methods: "*",
  allowedHeaders: "*",
}));
app.use(express.json());

// <------------- CVAT ROUTES ------------------------->
// Login 
app.post("/api/login", postCvatLogin);

// Logout
app.post("/api/logout", postCvatLogout);

// Health check
app.get("/health/cvat", getCvatHealth);

// Create CVAT task
app.post("/api/tasks", postCvatTask);

// List tasks
app.get("/api/tasks", getCvatTasks);

// Upload data
app.post("/api/tasks/:id/data", upload.single("video"), postCvatData);

// List jobs for a task
app.get("/api/tasks/:id/jobs", getCvatJobs);

// Get job annotations
app.get("/api/jobs/:id/annotations", getAnnotations);

// Save/update annotations
app.put("/api/jobs/:id/annotations", putAnnotation);

// Get Annotation Formats
app.get("/api/formats", getAnnotationFormats);


// Start server
const port = Number(process.env.PORT || 3001);

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Backend server running on http://localhost:${port}`);
  console.log(`🎯 CVAT API target: ${GlobalConstants.CVAT_BASE}`);
});