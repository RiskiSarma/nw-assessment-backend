import { PrismaClient, Role, Department } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // PM
  const pm = await prisma.user.upsert({
    where: { email: "pm@nodewave.id" },
    update: {},
    create: {
      name: "Alex PM",
      email: "pm@nodewave.id",
      password: await Bun.password.hash("password123"),
      role: Role.PM,
      department: Department.PRODUCT,
    },
  });

  // Internal team
  const uiux = await prisma.user.upsert({
    where: { email: "uiux@nodewave.id" },
    update: {},
    create: {
      name: "Diana UI/UX",
      email: "uiux@nodewave.id",
      password: await Bun.password.hash("password123"),
      role: Role.INTERNAL,
      department: Department.UI_UX,
    },
  });

  const frontend = await prisma.user.upsert({
    where: { email: "frontend@nodewave.id" },
    update: {},
    create: {
      name: "Kevin Frontend",
      email: "frontend@nodewave.id",
      password: await Bun.password.hash("password123"),
      role: Role.INTERNAL,
      department: Department.FRONTEND,
    },
  });

  const backend = await prisma.user.upsert({
    where: { email: "backend@nodewave.id" },
    update: {},
    create: {
      name: "Ryan Backend",
      email: "backend@nodewave.id",
      password: await Bun.password.hash("password123"),
      role: Role.INTERNAL,
      department: Department.BACKEND,
    },
  });

  // Client
  const client = await prisma.client.upsert({
    where: { email: "client@acme.com" },
    update: {},
    create: {
      name: "Acme Corp",
      email: "client@acme.com",
      password: await Bun.password.hash("password123"),
    },
  });

  // Project
  const project = await prisma.project.upsert({
    where: { id: "project-seed-1" },
    update: {},
    create: {
      id: "project-seed-1",
      name: "E-Commerce Revamp",
      description: "Full redesign and rebuild of the Acme e-commerce platform",
      clientId: client.id,
    },
  });

  // Add members
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: pm.id },
      { projectId: project.id, userId: uiux.id },
      { projectId: project.id, userId: frontend.id },
      { projectId: project.id, userId: backend.id },
    ],
    skipDuplicates: true,
  });

  // Tasks dengan dependency chain
  const taskA = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "UI Design - Homepage",
      description: "Create Figma mockups for homepage",
      status: "TODO",
      assigneeId: uiux.id,
      createdById: pm.id,
      isClientVisible: true,
    },
  });

  const taskB = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Backend API - Product List",
      description: "Create REST endpoint for product listing",
      status: "TODO",
      assigneeId: backend.id,
      createdById: pm.id,
      isClientVisible: false,
    },
  });

  // Task C depends on A dan B
  const taskC = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Frontend Slicing - Homepage",
      description: "Implement homepage based on UI design and backend API",
      status: "BLOCKED",
      assigneeId: frontend.id,
      createdById: pm.id,
      isClientVisible: true,
    },
  });

  await prisma.taskDependency.createMany({
    data: [
      { dependentId: taskC.id, prerequisiteId: taskA.id },
      { dependentId: taskC.id, prerequisiteId: taskB.id },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Seed complete!");
  console.log("Accounts: pm@nodewave.id / uiux@nodewave.id / frontend@nodewave.id / backend@nodewave.id / client@acme.com");
  console.log("Password semua: password123");
}

main().catch(console.error).finally(() => prisma.$disconnect());