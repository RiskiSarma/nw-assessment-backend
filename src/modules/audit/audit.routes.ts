import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import { getAuditLogs } from "./audit.service";
import type { AppEnv } from "../../types";

const audit = new Hono<AppEnv>();

audit.use("*", authMiddleware);

// GET /audit?taskId=xxx — PM & INTERNAL only
audit.get(
  "/",
  requireRole("PM", "INTERNAL"),
  async (c) => {
    const taskId = c.req.query("taskId");
    if (!taskId) return c.json({ message: "taskId is required" }, 400);
    const data = await getAuditLogs(taskId);
    return c.json({ data });
  }
);

export default audit;