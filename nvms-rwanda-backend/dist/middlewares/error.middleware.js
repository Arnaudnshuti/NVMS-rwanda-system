import { asError } from "../utils/response.js";
export function notFoundHandler(_req, res) {
    res.status(404).json({ error: "Not found" });
}
export function errorHandler(err, _req, res, _next) {
    console.error("[API ERROR]", err);
    res.status(500).json(asError(err));
}
