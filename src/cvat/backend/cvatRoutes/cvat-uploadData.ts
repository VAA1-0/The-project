import FormData from "form-data";
import { GlobalConstants, GlobalState } from "../data/GlobalVariables";
import axios from "axios";

export async function postCvatData (req: any, res: any) {
  try {
    const taskId = req.params.id;
    console.log("MULTER RECEIVED:", req.file);
    if (!req.file) {
      return res.status(400).json({ error: "No video file received" });
    }

    const form = new FormData();
    form.append("client_files[0]", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    form.append("image_quality", "70");
    form.append("use_cache", "false");
    form.append("type", "video");       // 🔥 REQUIRED FOR VIDEO upload
    form.append("copy_data", "false");

    const headers = {
      ...form.getHeaders(),
      Authorization: `Token ${GlobalState.token}`,
    };

    const response = await axios.post(
      `${GlobalConstants.CVAT_BASE}/tasks/${taskId}/data`,
      form,
      { headers }
    );

    res.json({ ok: true });
  } catch (err: any) {
    console.error("❌ Upload error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
};