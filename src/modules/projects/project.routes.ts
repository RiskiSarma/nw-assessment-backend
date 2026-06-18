import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, requireRole } from "../../middleware/auth.middleware";
import * as projectService from "./project.service";
import { createProjectSchema, updateProjectSchema } from "./project.schema";
import type { AppEnv } from "../../types";

const projects = new Hono<AppEnv>();

projects.use("*", authMiddleware);

projects.get("/", async (c) => {
  const { userId, role, clientId } = c.get("user");
  const data = await projectService.getProjects(userId, role, clientId);
  return c.json({ data });
});

projects.get("/:id", async (c) => {
  const { userId, role, clientId } = c.get("user");
  const data = await projectService.getProjectById(c.req.param("id"), userId, role, clientId);
  return c.json({ data });
});

projects.post(
  "/",
  requireRole("PM"),
  zValidator("json", createProjectSchema),
  async (c) => {
    const body = c.req.valid("json");
    const { userId } = c.get("user");
    const data = await projectService.createProject(body, userId);
    return c.json({ data }, 201);
  }
);

projects.patch(
  "/:id",
  requireRole("PM"),
  zValidator("json", updateProjectSchema),
  async (c) => {
    const data = await projectService.updateProject(c.req.param("id"), c.req.valid("json"));
    return c.json({ data });
  }
);

projects.delete("/:id", requireRole("PM"), async (c) => {
  await projectService.softDeleteProject(c.req.param("id"));
  return c.json({ message: "Project deleted" });
});

export default projects;