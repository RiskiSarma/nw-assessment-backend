import { createMiddleware } from "hono/factory";
import { verifyToken } from "../lib/jwt";
import type { AppEnv } from "../types";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyToken(token);
    c.set("user", payload as any);
    await next();
  } catch {
    return c.json({ message: "Invalid or expired token" }, 401);
  }
});

export const requireRole = (...roles: string[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      return c.json({ message: "Forbidden" }, 403);
    }
    await next();
  });