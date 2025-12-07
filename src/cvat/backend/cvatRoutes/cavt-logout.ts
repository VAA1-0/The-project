import { GlobalConstants, resetSession } from "../data/GlobalVariables";
import fs from 'fs';

export async function postCvatLogout(req: any, res: any) {
    //Global variables reset to null
    resetSession();

    if (fs.existsSync(GlobalConstants.AUTH_FILE)) {
        fs.unlinkSync(GlobalConstants.AUTH_FILE);
    }

    console.log("🚪 Logged out");
    res.json({ ok: true });
};