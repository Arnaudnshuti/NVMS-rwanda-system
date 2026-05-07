import express from "express";
import "express-async-errors";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.route.js";
import { authRouter } from "./routes/auth.js";
import { programsRouter } from "./routes/programs.js";
import { applicationsRouter } from "./routes/applications.js";
import { meRouter } from "./routes/me.js";
import { coordinatorRouter } from "./routes/coordinator.js";
import { adminRouter } from "./routes/admin.js";
import { metaRouter } from "./routes/meta.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import path from "node:path";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const origin = config.corsOrigin.split(",").map((s) => s.trim());

  app.use(
    cors({
      origin,
      credentials: true,
    }),
  );

  app.use(healthRouter);
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/programs", programsRouter);
  app.use("/api/applications", applicationsRouter);
  app.use("/api/me", meRouter);
  app.use("/api/coordinator", coordinatorRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/meta", metaRouter);

  // Static uploads (dev). In production, use object storage + signed URLs.
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
