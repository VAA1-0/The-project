import { getCookies, GlobalConstants, GlobalState } from "../data/GlobalVariables";
import axios from "axios";

const TUS_CHUNK_SIZE = 10 * 1024 * 1024;

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Token ${GlobalState.token}`,
  };

  const { session, csrf } = getCookies();
  if (session) {
    headers.Cookie = session;
  }
  if (csrf) {
    headers.Cookie = headers.Cookie ? `${headers.Cookie}; ${csrf}` : csrf;
    const csrfValue = csrf.split("=")[1]?.split(";")[0];
    if (csrfValue) {
      headers["X-CSRFToken"] = csrfValue;
    }
  }

  return headers;
}

async function uploadVideoWithTus(taskId: string, file: any): Promise<void> {
  const baseHeaders = buildAuthHeaders();
  const dataUrl = `${GlobalConstants.CVAT_BASE}/tasks/${taskId}/data`;
  const tusUrl = `${dataUrl}/`;

  await axios.post(dataUrl, null, {
    headers: {
      ...baseHeaders,
      "Upload-Start": "",
    },
  });

  const metadata = `filename ${Buffer.from(file.originalname).toString("base64")}`;
  const createResp = await axios.post(tusUrl, null, {
    headers: {
      ...baseHeaders,
      Origin: "http://localhost:8080",
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file.size),
      "Upload-Metadata": metadata,
    },
    validateStatus: () => true,
  });

  if (createResp.status < 200 || createResp.status >= 300) {
    throw new Error(`CVAT tus creation failed: ${createResp.status} ${createResp.statusText}`);
  }

  const uploadLocation = createResp.headers.location;
  if (!uploadLocation) {
    throw new Error("CVAT tus creation did not return an upload location");
  }

  const resolvedUploadUrl = new URL(uploadLocation, tusUrl).toString();
  let offset = 0;

  while (offset < file.buffer.length) {
    const nextOffset = Math.min(offset + TUS_CHUNK_SIZE, file.buffer.length);
    const chunk = file.buffer.subarray(offset, nextOffset);
    const patchResp = await axios.patch(resolvedUploadUrl, chunk, {
      headers: {
        ...baseHeaders,
        Origin: "http://localhost:8080",
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });

    if (patchResp.status < 200 || patchResp.status >= 300) {
      throw new Error(`CVAT tus chunk upload failed: ${patchResp.status} ${patchResp.statusText}`);
    }

    const returnedOffset = Number(patchResp.headers["upload-offset"]);
    offset = Number.isFinite(returnedOffset) ? returnedOffset : nextOffset;
  }

  const finishPayload = new URLSearchParams({
    image_quality: "70",
  });

  const finishResp = await axios.post(dataUrl, finishPayload.toString(), {
    headers: {
      ...baseHeaders,
      "Upload-Finish": "",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    validateStatus: () => true,
  });

  if (finishResp.status < 200 || finishResp.status >= 300) {
    throw new Error(`CVAT tus finish failed: ${finishResp.status} ${finishResp.statusText}`);
  }
}

export async function postCvatData (req: any, res: any) {
  try {
    const taskId = req.params.id;
    console.log("MULTER RECEIVED:", req.file);
    if (!req.file) {
      return res.status(400).json({ error: "No video file received" });
    }

    let response: any = { status: 202, data: null };
    await uploadVideoWithTus(taskId, req.file);

    let taskStatus: any = null;
    let finished = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await axios.get(
        `${GlobalConstants.CVAT_BASE}/tasks/${taskId}/status`,
        { headers: { Authorization: `Token ${GlobalState.token}` } },
      );

      taskStatus = statusResponse.data;
      const state = String(taskStatus?.state || "").toUpperCase();

      if (state === "FINISHED") {
        finished = true;
        break;
      }

      if (state === "FAILED") {
        throw new Error(taskStatus?.message || "CVAT task processing failed");
      }
    }

    if (!finished) {
      throw new Error("CVAT task processing did not finish before timeout");
    }

    res.status(response.status).json({
      ok: true,
      cvat: response.data ?? null,
      taskStatus,
    });
  } catch (err: any) {
    console.error("❌ Upload error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
};
