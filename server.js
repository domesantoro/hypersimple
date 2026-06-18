const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 8123;
const HOST = "0.0.0.0";
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const USERS_FILE = path.join(ROOT_DIR, "users.json");
const SESSION_COOKIE = "hys_session";

const sessions = new Map();

function ensureDirectory(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}

function sendResponse(res, statusCode, contentType, content) {
    res.writeHead(statusCode, {
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    });
    res.end(content);
}

function sendJson(res, statusCode, payload) {
    sendResponse(res, statusCode, "application/json; charset=utf-8", JSON.stringify(payload));
}

function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
}

function parseCookies(req) {
    const cookies = {};
    const header = req.headers.cookie;

    if (!header) {
        return cookies;
    }

    header.split(";").forEach(function (cookiePart) {
        const parts = cookiePart.trim().split("=");
        const name = parts.shift();
        const value = parts.join("=");

        if (name) {
            cookies[name] = decodeURIComponent(value || "");
        }
    });

    return cookies;
}

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return [];
    }

    const parsedUsers = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));

    if (!Array.isArray(parsedUsers)) {
        return [];
    }

    return parsedUsers.filter(function (user) {
        return user && user.email && user.password;
    });
}

function authenticate(email, password) {
    return readUsers().some(function (user) {
        return user.email === email && user.password === password;
    });
}

function createSession(email) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, email);
    return token;
}

function getSessionEmail(req) {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];

    if (!token) {
        return null;
    }

    return sessions.get(token) || null;
}

function userSlug(email) {
    return email
        .toLowerCase()
        .replace(/@/g, "_at_")
        .replace(/[^a-z0-9._-]+/g, "_");
}

function getUserDirectory(email) {
    return path.join(DATA_DIR, userSlug(email));
}

function getUserBoardFile(email) {
    return path.join(getUserDirectory(email), "board.json");
}

function getUserSettingsFile(email) {
    return path.join(getUserDirectory(email), "settings.json");
}

function ensureUserFiles(email) {
    const directoryPath = getUserDirectory(email);
    const settingsFile = getUserSettingsFile(email);

    ensureDirectory(directoryPath);

    if (!fs.existsSync(settingsFile)) {
        fs.writeFileSync(settingsFile, JSON.stringify({ lan: "en" }, null, 4));
    }
}

function readUserBoard(email) {
    ensureUserFiles(email);

    const boardFile = getUserBoardFile(email);

    if (!fs.existsSync(boardFile)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(boardFile, "utf8"));
}

function writeUserBoard(email, boardData) {
    ensureUserFiles(email);
    fs.writeFileSync(getUserBoardFile(email), JSON.stringify(boardData, null, 4));
}

function readUserSettings(email) {
    ensureUserFiles(email);
    return JSON.parse(fs.readFileSync(getUserSettingsFile(email), "utf8"));
}

function writeUserSettings(email, settings) {
    ensureUserFiles(email);
    fs.writeFileSync(getUserSettingsFile(email), JSON.stringify(settings, null, 4));
}

function readRequestBody(req) {
    return new Promise(function (resolve, reject) {
        let body = "";

        req.on("data", function (chunk) {
            body += chunk.toString();

            if (body.length > 1024 * 1024) {
                reject(new Error("Request body too large"));
                req.destroy();
            }
        });

        req.on("end", function () {
            resolve(body);
        });

        req.on("error", reject);
    });
}

function parseRequestPayload(req, rawBody) {
    const contentType = req.headers["content-type"] || "";

    if (contentType.includes("application/json")) {
        return JSON.parse(rawBody || "{}");
    }

    const params = new URLSearchParams(rawBody);
    const payload = {};
    params.forEach(function (value, key) {
        payload[key] = value;
    });
    return payload;
}

function contentTypeFor(filePath) {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
        case ".html": return "text/html; charset=utf-8";
        case ".css": return "text/css; charset=utf-8";
        case ".js": return "text/javascript; charset=utf-8";
        case ".json": return "application/json; charset=utf-8";
        case ".png": return "image/png";
        case ".jpg":
        case ".jpeg": return "image/jpeg";
        case ".svg": return "image/svg+xml";
        default: return "application/octet-stream";
    }
}

function sendStaticFile(res, requestPath) {
    const safeRequestPath = requestPath === "/" ? "/index.html" : requestPath;
    const filePath = path.normalize(path.join(PUBLIC_DIR, safeRequestPath));

    if (!filePath.startsWith(PUBLIC_DIR)) {
        sendResponse(res, 403, "text/plain; charset=utf-8", "Forbidden");
        return;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        sendResponse(res, 404, "text/plain; charset=utf-8", "Not found");
        return;
    }

    sendResponse(res, 200, contentTypeFor(filePath), fs.readFileSync(filePath));
}

function isLoginAsset(pathname) {
    return pathname === "/login" ||
        pathname === "/login.html" ||
        pathname === "/style/login.css" ||
        pathname === "/script/login.js" ||
        pathname === "/script/l10n/hys_en.js" ||
        pathname === "/script/l10n/hys_it.js";
}

function isAuthenticated(req) {
    return getSessionEmail(req) !== null;
}

async function handleApi(req, res, pathname) {
    if (pathname === "/api/login" && req.method === "POST") {
        const rawBody = await readRequestBody(req);
        const payload = parseRequestPayload(req, rawBody);
        const email = payload.email || "";
        const password = payload.password || "";

        if (!authenticate(email, password)) {
            sendJson(res, 401, { success: false });
            return;
        }

        const token = createSession(email);
        res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": SESSION_COOKIE + "=" + encodeURIComponent(token) + "; HttpOnly; SameSite=Lax; Path=/"
        });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    const email = getSessionEmail(req);

    if (!email) {
        sendJson(res, 401, { success: false });
        return;
    }

    if (pathname === "/api/board" && req.method === "GET") {
        const boardData = readUserBoard(email);

        if (!boardData) {
            sendJson(res, 404, { success: false });
            return;
        }

        sendJson(res, 200, boardData);
        return;
    }

    if (pathname === "/api/board" && req.method === "POST") {
        const rawBody = await readRequestBody(req);
        const payload = parseRequestPayload(req, rawBody);

        if (!payload.sections || !Array.isArray(payload.sections)) {
            sendJson(res, 400, { success: false });
            return;
        }

        writeUserBoard(email, payload);
        sendJson(res, 200, { success: true });
        return;
    }

    if (pathname === "/api/settings" && req.method === "GET") {
        const settings = readUserSettings(email);
        sendJson(res, 200, { email: email, lan: settings.lan || "en" });
        return;
    }

    if (pathname === "/api/settings/lang" && req.method === "POST") {
        const rawBody = await readRequestBody(req);
        const payload = parseRequestPayload(req, rawBody);
        const lan = payload.lan === "it" ? "it" : "en";
        const settings = readUserSettings(email);

        settings.lan = lan;
        writeUserSettings(email, settings);
        sendJson(res, 200, { success: true, lan: lan });
        return;
    }

    sendJson(res, 404, { success: false });
}

async function handleRequest(req, res) {
    try {
        const url = new URL(req.url, "http://localhost");
        const pathname = url.pathname;

        if (pathname.startsWith("/api/")) {
            await handleApi(req, res, pathname);
            return;
        }

        if (pathname === "/login" || pathname === "/login.html") {
            if (isAuthenticated(req)) {
                redirect(res, "/");
                return;
            }

            sendStaticFile(res, "/login.html");
            return;
        }

        if (!isAuthenticated(req)) {
            if (isLoginAsset(pathname)) {
                sendStaticFile(res, pathname === "/login" ? "/login.html" : pathname);
                return;
            }

            redirect(res, "/login");
            return;
        }

        sendStaticFile(res, pathname);
    } catch (error) {
        sendJson(res, 500, { success: false });
    }
}

ensureDirectory(DATA_DIR);

http.createServer(handleRequest).listen(PORT, HOST, function () {
    console.log("Hypersimple Board server listening on http://" + HOST + ":" + PORT);
});
