import { cvatRequest } from "../middleware/cvatRequest";

export async function getAnnotations (req: any, res: any) {
  try {
    const jobId = req.params.id;
    const resp = await cvatRequest("get", `/jobs/${jobId}/annotations`);
    res.json(resp.data);
  } catch (err: any) {
    console.error("❌ Get annotations error:", err.message);
    res.status(500).json({ error: "Failed to fetch annotations" });
  }
};