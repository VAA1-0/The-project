import path from 'path';
import fs from 'fs';

export const GlobalConstants = {
    CVAT_BASE: 'http://localhost:8080/api',
    AUTH_FILE: path.join(process.cwd(), "cvat_token.json"),
} as const

export const GlobalState = {
    token: null as string | null,
    sessionCookie: null as string | null,
    csrfCookie: null as string | null,
}

export const setGlobalState = (data: Partial<typeof GlobalState>) => {
    Object.assign(GlobalState, data);
};

/* USAGE
setGlobalState({ token: "abc123" });
setGlobalState({ sessionCookie: "session=xyz" });
*/

export const resetSession = () => {
    GlobalState.token = null;
    GlobalState.sessionCookie = null;
    GlobalState.csrfCookie = null;
};

export const getSessionToken = () => GlobalState.token;

export const getCookies = () => ({
    session: GlobalState.sessionCookie,
    csrf: GlobalState.csrfCookie,
});

export const saveAuthToDisk = () => {
    fs.writeFileSync(GlobalConstants.AUTH_FILE, JSON.stringify({
        token: GlobalState.token,
        sessionCookie: GlobalState.sessionCookie,
        csrfCookie: GlobalState.csrfCookie,
    }, null, 2),
    );
};

export const loadAuthFromDisk = () => {
    if (!fs.existsSync(GlobalConstants.AUTH_FILE)) return
    try {
        const data = JSON.parse(fs.readFileSync(GlobalConstants.AUTH_FILE, "utf8"));
        setGlobalState({
            token: data.token ?? null,
            sessionCookie: data.sessionCookie ?? null,
            csrfCookie: data.csrfCookie ?? null,
        });

        if (data.token) {
            console.log("🔐 Loaded saved CVAT authentication!");
        } else {
            console.log("⚠️ CVAT auth file loaded but no token present.");
        }
    } catch (err) {
        console.warn("⚠️ Could not parse CVAT auth file:", err);
    }
};

