import type { Context } from "hono";

export interface AppContext {
  Variables: {
    user: {
      userId: string;
      role: "PM" | "INTERNAL" | "CLIENT_GUEST";
      department?: string;
      clientId?: string;
    };
  };
}

export type AppEnv = AppContext;