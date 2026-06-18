import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginSchema, registerSchema } from "./auth.schema";
import * as authService from "./auth.service";
import { authMiddleware } from "../../middleware/auth.middleware";
import prisma from "../../lib/prisma";
import type { AppEnv } from "../../types";

const auth = new Hono<AppEnv>();

auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");
  const user = await authService.register(body);
  return c.json({ data: user }, 201);
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await authService.login(body);
  return c.json({ data: result });
});

auth.get("/me", authMiddleware, async (c) => {
  const { userId } = c.get("user");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, department: true, avatar: true },
  });
  return c.json({ data: user });
});

export default auth;