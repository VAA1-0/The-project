import { cvatRequest } from "../middleware/cvatRequest";

export async function putAnnotation (req: any, res: any) {
  try {
    const jobId = req.params.id;
    const resp = await cvatRequest("put", `/jobs/${jobId}/annotations`, req.body);
    res.json(resp.data);
  } catch (err: any) {
    console.error("❌ Save annotations error:", err.message);
    res.status(500).json({ error: "Failed to save annotations" });
  }
};