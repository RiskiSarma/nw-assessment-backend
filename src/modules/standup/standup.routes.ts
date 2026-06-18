import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import { getDailyStandup } from "./standup.service";
import type { AppEnv } from "../../types";

const standup = new Hono<AppEnv>();

standup.use("*", authMiddleware);

// GET /standup?projectId=xxx — PM only
standup.get("/", requireRole("PM"), async (c) => {
  const projectId = c.req.query("projectId");
  if (!projectId) return c.json({ message: "projectId is required" }, 400);
  const data = await getDailyStandup(projectId);
  return c.json({ data });
});

export default standup;