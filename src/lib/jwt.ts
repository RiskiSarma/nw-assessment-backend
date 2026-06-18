import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "super-secret-key";

export interface JWTPayload {
  userId: string;
  role: string;
  department?: string;
  clientId?: string; // untuk Client Guest
}

export const signToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, SECRET) as JWTPayload;
};