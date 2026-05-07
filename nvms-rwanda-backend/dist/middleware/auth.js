import { verifyAccessToken } from "../lib/jwt.js";
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = header.slice("Bearer ".length).trim();
    try {
        const { sub, role } = verifyAccessToken(token);
        req.userId = sub;
        req.userRole = role;
        return next();
    }
    catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
export function requireRoles(...roles) {
    return (req, res, next) => {
        if (!req.userRole)
            return res.status(401).json({ error: "Unauthorized" });
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        return next();
    };
}
