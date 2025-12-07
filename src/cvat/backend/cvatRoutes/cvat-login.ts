import axios from "axios";
import { getCookies, GlobalConstants, saveAuthToDisk, setGlobalState } from "../data/GlobalVariables";



export async function postCvatLogin(req: any, res: any) {
    const { username, password } = req.body;

    try {
        const loginResp = await axios.post(
            `${GlobalConstants.CVAT_BASE}/auth/login`,
            { username, password },
            { withCredentials: true }
        );
        // <-------Setting up Token and Cookies -------->
        if (loginResp != null) {
            setGlobalState({ token: loginResp.data.key })

            const setCookieHeaders = loginResp.headers["set-cookie"] || [];
            const cookies: Array<{ name: string; value: string }> = [];

            setCookieHeaders.forEach((cookieStr: string) => {
                const parts = cookieStr.split(";")[0];
                const [name, value] = parts.split("=");

                if (name === "sessionid") {
                    setGlobalState({sessionCookie : `sessionid=${value}` });
                    cookies.push({ name, value });
                }
                if (name === "csrftoken") {
                    setGlobalState({csrfCookie : `csrftoken=${value}` });
                    cookies.push({ name, value });
                }
            });
        }
        //<==========================================================>

        // Save token to file
        saveAuthToDisk()
        
        console.log("🔐 CVAT authenticated successfully");

        // Storing cookies to browser
        let sessionCookie = getCookies().session;
        let csrfCookie = getCookies().csrf;
        res
            .setHeader("Set-Cookie", [
                sessionCookie,
                csrfCookie
            ])
            .json({ ok: true });

    } catch (err: any) {
        console.error("❌ Login error:", err.response?.data || err.message);
        res.status(401).json({
            ok: false,
            error: err.response?.data?.detail || "Invalid credentials"
        });
    }
};