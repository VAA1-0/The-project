import { cvatRequest } from "../middleware/cvatRequest";

export async function getCvatJobs (req: any, res: any) {
  try {
    const taskId = req.params.id;
    console.log(`📋 Fetching jobs for task ${taskId}`);

    const resp = await cvatRequest("get", `/jobs?task_id=${taskId}`);
    res.json(resp.data);

  } catch (err: any) {
    console.error("❌ List jobs error:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data || "Failed to list jobs"
    });
  }
};