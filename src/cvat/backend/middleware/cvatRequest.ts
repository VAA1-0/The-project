import axios from "axios";
import { getCookies, GlobalConstants, GlobalState, resetSession } from "../data/GlobalVariables";
import fs from "fs";

export async function cvatRequest(method: string, url: string, data?: any) {
    if (!GlobalState.token) {
        throw new Error("Not authenticated");
    }

    try {
        const headers: any = {
            Authorization: `Token ${GlobalState.token}`,
        };

        // Add session cookie if exists
        const { session, csrf } = getCookies();
        if (session) {
            headers.Cookie = session;
        }
        if (csrf) {
            headers.Cookie = headers.Cookie ? `${headers.Cookie}; ${csrf}` : csrf;

            // Extract CSRF and add header
            const csrfValue = csrf.split("=")[1]?.split(";")[0];
            if (csrfValue) headers["X-CSRFToken"] = csrfValue;
        }

        const response = await axios({
            method,
            url: GlobalConstants.CVAT_BASE + url,
            data,
            headers,
            timeout: 30000, // 30 second timeout
        });

        return response;

    } catch (err: any) {
        // Handle token expiration
        if (err.response?.status === 401 || err.response?.status === 403) {
            console.error("🔒 Authentication failed - token may be expired");
            resetSession();

            if (fs.existsSync(GlobalConstants.AUTH_FILE)) {
                fs.unlinkSync(GlobalConstants.AUTH_FILE);
            }

            throw new Error("Authentication expired. Please log in again.");
        }

        throw err;
    }
}