import type { NextFunction, Request, Response } from "express";
import { asError } from "../utils/response.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error("[API ERROR]", err);
  res.status(500).json(asError(err));
}
