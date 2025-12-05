import { cvatRequest } from "../middleware/cvatRequest";

export async function postCvatTask (req: any, res: any) {
  try {
    const { name, labels } = req.body;

    console.log(`📝 Creating task: ${name}`);

    const taskResp = await cvatRequest("post", "/tasks", {
      name,
      labels,
    });

    const taskId = taskResp.data.id;
    console.log(`✅ Task created with ID: ${taskId}`);

    res.json({ taskId });

  } catch (err: any) {
    console.error("❌ Task creation error:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data || err.message || "Failed to create task"
    });
  }
};