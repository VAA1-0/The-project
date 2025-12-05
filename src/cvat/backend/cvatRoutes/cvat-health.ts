import axios from "axios";
import { GlobalConstants, GlobalState, setGlobalState } from "../data/GlobalVariables";
import fs from "fs";

export async function getCvatHealth (req: any, res: any) {
  try {
    if (!GlobalState.token) {
      return res.json({ ok: true, tokenValid: false });    }

    // Verify token is still valid
    await axios.get(`${GlobalConstants.CVAT_BASE}/server/about`, {
      headers: { Authorization: `Token ${GlobalState.token}` },
    });

    await axios.get(`${GlobalConstants.CVAT_BASE}/users/self`, {
        headers: { Authorization: `Token ${GlobalState.token}` },
    });

    return res.json({ ok: true, tokenValid: true });
  } catch (err) {
    // Token expired or invalid
    setGlobalState({token : null});
    if (fs.existsSync(GlobalConstants.AUTH_FILE)) {
      fs.unlinkSync(GlobalConstants.AUTH_FILE);
    }
    return res.json({ ok: false, tokenValid: false });
  }
};