import "dotenv/config";
export const config = {
    port: Number(process.env.PORT) || 4000,
    nodeEnv: process.env.NODE_ENV ?? "development",
    jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000,http://localhost:5173",
};
