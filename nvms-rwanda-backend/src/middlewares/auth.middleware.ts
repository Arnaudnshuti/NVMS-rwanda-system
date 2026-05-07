import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAccessToken } from "../services/auth.service.js";
import { prisma } from "../services/prisma.service.js";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  try {
    const { sub, role } = verifyAccessToken(header.slice(7).trim());
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, role: true, isActive: true, govStatus: true },
    });
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.isActive || user.govStatus !== "active") {
      return res.status(403).json({ error: "Account is inactive" });
    }
    req.userId = user.id;
    req.userRole = user.role ?? role;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.userRole)) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}

export function requireRole(role: UserRole | "ADMIN" | "COORDINATOR" | "VOLUNTEER") {
  const normalized =
    role === "ADMIN"
      ? "admin"
      : role === "COORDINATOR"
        ? "coordinator"
        : role === "VOLUNTEER"
          ? "volunteer"
          : role;
  return requireRoles(normalized);
}

export const requireAdmin = requireRole("ADMIN");
export const requireCoordinator = requireRole("COORDINATOR");
export const requireVolunteer = requireRole("VOLUNTEER");
