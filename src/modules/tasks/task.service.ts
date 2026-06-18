import prisma from "../../lib/prisma";
import { HTTPException } from "hono/http-exception";
import { createAuditLog } from "../audit/audit.service";
import type { z } from "zod";
import type { createTaskSchema, updateStatusSchema, updateTaskSchema } from "./task.schema";

// Helper: cek apakah semua prerequisite task sudah DONE
const checkDependenciesDone = async (taskId: string): Promise<boolean> => {
  const deps = await prisma.taskDependency.findMany({
    where: { dependentId: taskId },
    include: { prerequisite: true },
  });
  return deps.every((d) => d.prerequisite.status === "DONE");
};

// Helper: auto-update status task yang bergantung pada task ini
const propagateStatusChange = async (taskId: string) => {
  // Cari semua task yang dependsOn task ini
  const dependents = await prisma.taskDependency.findMany({
    where: { prerequisiteId: taskId },
    include: { dependent: true },
  });

  for (const dep of dependents) {
    const allDone = await checkDependenciesDone(dep.dependentId);
    if (!allDone && dep.dependent.status === "TODO") {
      await prisma.task.update({
        where: { id: dep.dependentId },
        data: { status: "BLOCKED" },
      });
    } else if (allDone && dep.dependent.status === "BLOCKED") {
      await prisma.task.update({
        where: { id: dep.dependentId },
        data: { status: "TODO" },
      });
    }
  }
};

export const createTask = async (
  data: z.infer<typeof createTaskSchema>,
  createdById: string
) => {
  const task = await prisma.task.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      isClientVisible: data.isClientVisible,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      createdById,
    },
  });

  // Set dependencies jika ada
  if (data.dependsOn?.length) {
    await prisma.taskDependency.createMany({
      data: data.dependsOn.map((prereqId) => ({
        dependentId: task.id,
        prerequisiteId: prereqId,
      })),
    });

    // Cek apakah task langsung perlu di-BLOCK
    const allDone = await checkDependenciesDone(task.id);
    if (!allDone) {
      await prisma.task.update({ where: { id: task.id }, data: { status: "BLOCKED" } });
    }
  }

  return task;
};

export const updateTask = async (
  taskId: string,
  data: z.infer<typeof updateTaskSchema>,
  userId: string,
  userRole: string
) => {
  // RBAC: hanya PM yang bisa update deskripsi
  if (userRole !== "PM" && data.description !== undefined) {
    throw new HTTPException(403, { message: "Only PM can change task description" });
  }

  // OPTIMISTIC LOCKING: ambil task dan cek version
  const task = await prisma.task.findUnique({ where: { id: taskId, deletedAt: null } });
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  if (task.version !== data.version) {
    throw new HTTPException(409, {
      message: "Conflict: Task was modified by someone else. Please refresh and try again.",
    });
  }

  const { version: _, ...updateData } = data;
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { ...updateData, version: { increment: 1 } },
  });

  // Audit log untuk setiap field yang berubah
  for (const key of Object.keys(updateData) as (keyof typeof updateData)[]) {
    if (updateData[key] !== undefined && String(task[key as keyof typeof task]) !== String(updateData[key])) {
      await createAuditLog({
        taskId,
        userId,
        changedColumn: key,
        oldValue: String(task[key as keyof typeof task] ?? ""),
        newValue: String(updateData[key]),
      });
    }
  }

  return updated;
};

export const updateTaskStatus = async (
  taskId: string,
  data: z.infer<typeof updateStatusSchema>,
  userId: string,
  userRole: string,
  userDepartment?: string
) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
    include: { dependsOn: { include: { prerequisite: true } } },
  });
  if (!task) throw new HTTPException(404, { message: "Task not found" });

  // OPTIMISTIC LOCKING
  if (task.version !== data.version) {
    throw new HTTPException(409, {
      message: "Conflict: Task was modified. Please refresh and try again.",
    });
  }

  // STATE-BASED PERMISSION: PM tidak bisa set ke DONE
  if (userRole === "PM" && data.status === "DONE") {
    throw new HTTPException(403, { message: "Only the assignee can mark a task as Done" });
  }

  // DEPENDENCY CHECK: tidak bisa IN_PROGRESS jika ada prerequisite belum DONE
  if (data.status === "IN_PROGRESS") {
    const allDone = await checkDependenciesDone(taskId);
    if (!allDone) {
      throw new HTTPException(403, {
        message: "Cannot start task: prerequisite tasks are not yet Done",
      });
    }
  }

  const oldStatus = task.status;
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: data.status, version: { increment: 1 } },
  });

  // Audit log
  await createAuditLog({
    taskId,
    userId,
    changedColumn: "status",
    oldValue: oldStatus,
    newValue: data.status,
  });

  // Propagate: jika task ini jadi DONE, unlock dependent tasks
  if (data.status === "DONE") {
    await propagateStatusChange(taskId);
  }

  return updated;
};

export const getTasksByProject = async (
  projectId: string,
  userId: string,
  userRole: string,
  clientId?: string
) => {
  // CLIENT GUEST: hanya lihat task yang isClientVisible = true
  if (userRole === "CLIENT_GUEST") {
    const project = await prisma.project.findFirst({
      where: { id: projectId, clientId: clientId!, deletedAt: null },
    });
    if (!project) throw new HTTPException(403, { message: "Access denied" });

    const tasks = await prisma.task.findMany({
      where: { projectId, isClientVisible: true, deletedAt: null },
      select: {
        id: true, title: true, status: true, dueDate: true,
        isClientVisible: true,
        // DATA MASKING: tidak expose assignee/internal info
      },
    });
    return tasks;
  }

  // INTERNAL: hanya project yang mereka terdaftar sebagai member
  if (userRole === "INTERNAL") {
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId },
    });
    if (!member) throw new HTTPException(403, { message: "Not a member of this project" });
  }

  return prisma.task.findMany({
    where: { projectId, deletedAt: null },
    include: {
      assignee: { select: { id: true, name: true, department: true, avatar: true } },
      dependsOn: { include: { prerequisite: { select: { id: true, title: true, status: true } } } },
      dependedOnBy: { include: { dependent: { select: { id: true, title: true, status: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
};

export const softDeleteTask = async (taskId: string) => {
  return prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });
};