import prisma from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { loginSchema, registerSchema } from "./auth.schema";

export const register = async (data: z.infer<typeof registerSchema>) => {
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new HTTPException(409, { message: "Email already registered" });

  const hashed = await Bun.password.hash(data.password);
  const user = await prisma.user.create({
    data: { ...data, password: hashed },
  });

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const login = async (data: z.infer<typeof loginSchema>) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email, deletedAt: null },
  });
  if (!user) throw new HTTPException(401, { message: "Invalid credentials" });

  const valid = await Bun.password.verify(data.password, user.password);
  if (!valid) throw new HTTPException(401, { message: "Invalid credentials" });

  const token = signToken({
    userId: user.id,
    role: user.role,
    department: user.department ?? undefined,
  });

  const { password: _, ...userWithoutPassword } = user;
  return { token, user: userWithoutPassword };
};