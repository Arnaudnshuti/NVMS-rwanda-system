import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
export async function hashPassword(plain) {
    return bcrypt.hash(plain, 12);
}
export async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}
export function signAccessToken(payload) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}
export function verifyAccessToken(token) {
    return jwt.verify(token, config.jwtSecret);
}
