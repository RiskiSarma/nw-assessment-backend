import { z } from "zod";

export const createTaskSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  isClientVisible: z.boolean().default(false),
  dueDate: z.string().datetime().optional(),
  dependsOn: z.array(z.string()).optional(), // array of prerequisite task IDs
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  isClientVisible: z.boolean().optional(),
  dueDate: z.string().datetime().optional(),
  version: z.number().int(), // WAJIB untuk optimistic locking
});

export const updateStatusSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]),
  version: z.number().int(), // WAJIB untuk optimistic locking
});