import { PrismaClient } from "@prisma/client";
export const prisma = global.__nvmsPrisma__ ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
if (process.env.NODE_ENV !== "production") {
    global.__nvmsPrisma__ = prisma;
}
