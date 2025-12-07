import { cvatRequest } from "../middleware/cvatRequest";

export async function getCvatTasks (req: any, res: any) {
  try {
    const resp = await cvatRequest("get", "/tasks");
    res.json(resp.data);
  } catch (err: any) {
    console.error("❌ List tasks error:", err.message);
    res.status(500).json({ error: "Failed to list tasks" });
  }
};