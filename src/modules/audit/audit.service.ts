import prisma from "../../lib/prisma";

interface AuditLogInput {
  taskId: string;
  userId: string;
  changedColumn: string;
  oldValue?: string;
  newValue?: string;
}

export const createAuditLog = async (data: AuditLogInput) => {
  return prisma.auditLog.create({ data });
};

export const getAuditLogs = async (taskId: string) => {
  return prisma.auditLog.findMany({
    where: { taskId },
    include: {
      user: { select: { id: true, name: true, role: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};