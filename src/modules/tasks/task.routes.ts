import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import * as taskService from "./task.service";
import { createTaskSchema, updateTaskSchema, updateStatusSchema } from "./task.schema";
import type { AppEnv } from "../../types";

const tasks = new Hono<AppEnv>();

tasks.use("*", authMiddleware);

// GET /tasks?projectId=xxx
tasks.get("/", async (c) => {
  const { userId, role, clientId } = c.get("user");
  const projectId = c.req.query("projectId");
  if (!projectId) return c.json({ message: "projectId is required" }, 400);

  const data = await taskService.getTasksByProject(projectId, userId, role, clientId);
  return c.json({ data });
});

// POST /tasks — PM only
tasks.post(
  "/",
  requireRole("PM"),
  zValidator("json", createTaskSchema),
  async (c) => {
    const body = c.req.valid("json");
    const { userId } = c.get("user");
    const task = await taskService.createTask(body, userId);
    return c.json({ data: task }, 201);
  }
);

// PATCH /tasks/:id — PM only (update description/title/assignee)
tasks.patch(
  "/:id",
  requireRole("PM"),
  zValidator("json", updateTaskSchema),
  async (c) => {
    const taskId = c.req.param("id");
    const body = c.req.valid("json");
    const { userId, role } = c.get("user");
    const task = await taskService.updateTask(taskId, body, userId, role);
    return c.json({ data: task });
  }
);

// PATCH /tasks/:id/status — semua role bisa, dengan state-based restrictions
tasks.patch(
  "/:id/status",
  zValidator("json", updateStatusSchema),
  async (c) => {
    const taskId = c.req.param("id");
    const body = c.req.valid("json");
    const { userId, role, department } = c.get("user");
    const task = await taskService.updateTaskStatus(taskId, body, userId, role, department);
    return c.json({ data: task });
  }
);

// DELETE /tasks/:id — soft delete, PM only
tasks.delete("/:id", requireRole("PM"), async (c) => {
  const taskId = c.req.param("id");
  await taskService.softDeleteTask(taskId);
  return c.json({ message: "Task deleted" });
});

export default tasks;