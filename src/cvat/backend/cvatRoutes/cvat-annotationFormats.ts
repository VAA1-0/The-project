import { cvatRequest } from "../middleware/cvatRequest";

export async function getAnnotationFormats(req: any, res: any) {
  try {
    const resp = await cvatRequest("get", "/server/annotation/formats");
    res.json(resp.data);
  } catch (err: any) {
    console.error("❌ Get formats error:", err.message);
    res.status(500).json({ error: "Failed to fetch export formats" });
  }
}

