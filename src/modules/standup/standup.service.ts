import prisma from "../../lib/prisma";

export const getDailyStandup = async (projectId: string) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  const logs = await prisma.auditLog.findMany({
    where: {
      task: { projectId },
      createdAt: { gte: yesterday, lte: endOfYesterday },
    },
    include: {
      user: { select: { name: true, department: true } },
      task: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by department
  const byDepartment: Record<string, { completed: any[]; blocked: any[] }> = {};

  for (const log of logs) {
    const dept = log.user.department ?? "UNKNOWN";
    if (!byDepartment[dept]) byDepartment[dept] = { completed: [], blocked: [] };

    if (log.changedColumn === "status" && log.newValue === "DONE") {
      byDepartment[dept].completed.push({
        taskId: log.task.id,
        taskTitle: log.task.title,
        completedBy: log.user.name,
        at: log.createdAt,
      });
    }

    if (log.changedColumn === "status" && log.newValue === "BLOCKED") {
      byDepartment[dept].blocked.push({
        taskId: log.task.id,
        taskTitle: log.task.title,
        blockedSince: log.createdAt,
      });
    }
  }

  return {
    projectId,
    date: yesterday.toISOString().split("T")[0],
    summary: byDepartment,
  };
};