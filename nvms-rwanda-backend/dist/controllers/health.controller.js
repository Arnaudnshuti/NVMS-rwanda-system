export function healthController(_req, res) {
    res.json({ status: "ok", service: "nvms-rwanda-backend", ts: new Date().toISOString() });
}
