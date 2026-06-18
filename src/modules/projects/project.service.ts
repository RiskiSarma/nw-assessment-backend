import prisma from "../../lib/prisma";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { createProjectSchema, updateProjectSchema } from "./project.schema";

export const createProject = async (
  data: z.infer<typeof createProjectSchema>,
  createdById: string
) => {
  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
      clientId: data.clientId,
      members: {
        create: [
          { userId: createdById },
          ...(data.memberIds ?? []).map((id) => ({ userId: id })),
        ],
      },
    },
    include: { members: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });
  return project;
};

export const getProjects = async (userId: string, role: string, clientId?: string) => {
  // CLIENT GUEST: hanya project milik client mereka
  if (role === "CLIENT_GUEST") {
    return prisma.project.findMany({
      where: { clientId: clientId!, deletedAt: null },
      select: {
        id: true, name: true, description: true,
        tasks: {
          where: { deletedAt: null },
          select: { id: true, status: true, isClientVisible: true },
        },
      },
    });
  }

  // PM: semua project
  if (role === "PM") {
    return prisma.project.findMany({
      where: { deletedAt: null },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
    });
  }

  // INTERNAL: hanya project yang mereka jadi member
  return prisma.project.findMany({
    where: {
      deletedAt: null,
      members: { some: { userId } },
    },
    include: { members: { include: { user: { select: { id: true, name: true } } } } },
  });
};

export const getProjectById = async (
  projectId: string,
  userId: string,
  role: string,
  clientId?: string
) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, department: true } } },
      },
      tasks: { where: { deletedAt: null } },
    },
  });

  if (!project) throw new HTTPException(404, { message: "Project not found" });

  if (role === "CLIENT_GUEST" && project.clientId !== clientId) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  if (role === "INTERNAL") {
    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember) throw new HTTPException(403, { message: "Not a member of this project" });
  }

  // Aggregate metrics untuk client
  if (role === "CLIENT_GUEST") {
    const visibleTasks = project.tasks.filter((t) => t.isClientVisible);
    const doneTasks = visibleTasks.filter((t) => t.status === "DONE");
    const completion = visibleTasks.length
      ? Math.round((doneTasks.length / visibleTasks.length) * 100)
      : 0;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      completion,
      totalTasks: visibleTasks.length,
      doneTasks: doneTasks.length,
    };
  }

  return project;
};

export const updateProject = async (
  projectId: string,
  data: z.infer<typeof updateProjectSchema>
) => {
  return prisma.project.update({
    where: { id: projectId },
    data,
  });
};

export const softDeleteProject = async (projectId: string) => {
  return prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });
};