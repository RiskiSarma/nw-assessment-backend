import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";

import authRoutes from "./modules/auth/auth.routes";
import projectRoutes from "./modules/projects/project.routes";
import taskRoutes from "./modules/tasks/task.routes";
import auditRoutes from "./modules/audit/audit.routes";
import standupRoutes from "./modules/standup/standup.routes";

const app = new Hono();

app.use("*", cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use("*", logger());
app.get("/", (c) => c.json({ status: "ok", service: "NodeWave PM API" }));

app.route("/api/auth", authRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/tasks", taskRoutes);
app.route("/api/audit", auditRoutes);
app.route("/api/standup", standupRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  console.error(err);
  return c.json({ message: "Internal Server Error" }, 500);
});

export default {
  port: process.env.PORT || 3001,
  fetch: app.fetch,
};