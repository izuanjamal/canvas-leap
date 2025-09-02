import { secret } from "encore.dev/config";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const jwtSecret = secret("JWTSecret");

export interface JWTClaims {
  sub: string; // user id
  email: string;
  display_name: string;
  avatar_url?: string;
}

function getKey(): Uint8Array {
  return new TextEncoder().encode(jwtSecret());
}

export async function signJWT(claims: JWTClaims, ttlSeconds = 60 * 60 * 24 * 7): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    email: claims.email,
    display_name: claims.display_name,
    avatar_url: claims.avatar_url ?? "",
  } as JWTPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(getKey());
  return token;
}

export async function verifyJWT(token: string): Promise<{ sub: string; payload: JWTPayload }> {
  const { payload } = await jwtVerify(token, getKey(), {
    algorithms: ["HS256"],
  });
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("invalid token subject");
  }
  return { sub: payload.sub, payload };
}
