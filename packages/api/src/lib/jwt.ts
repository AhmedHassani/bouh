import { SignJWT, jwtVerify } from "jose";

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET ?? "misahuh_access_secret_change_in_prod_2026"
);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET ?? "misahuh_refresh_secret_change_in_prod_2026"
);
const GUEST_SECRET = new TextEncoder().encode(
  process.env.JWT_GUEST_SECRET ?? "misahuh_guest_secret_change_in_prod_2026"
);

export type TokenPayload = {
  sub: string;       // userId
  role: string;      // SUPER_ADMIN | ADMIN | CONSULTANT
  type: "access";
};

export type RefreshPayload = {
  sub: string;
  jti: string;       // RefreshToken.id for revocation
  type: "refresh";
};

export type GuestPayload = {
  sub: string;       // anonUserId
  type: "guest";
};

// ─── Access Token (15 min) ────────────────────────────────────────────────────

export async function signAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(ACCESS_SECRET);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// ─── Refresh Token (20 days) ──────────────────────────────────────────────────

export async function signRefreshToken(userId: string, jti: string): Promise<string> {
  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("20d")
    .sign(REFRESH_SECRET);
}

export async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    return payload as unknown as RefreshPayload;
  } catch {
    return null;
  }
}

// ─── Guest Token (30 days) ────────────────────────────────────────────────────

export async function signGuestToken(anonUserId: string): Promise<string> {
  return new SignJWT({ type: "guest" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(anonUserId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(GUEST_SECRET);
}

export async function verifyGuestToken(token: string): Promise<GuestPayload | null> {
  try {
    const { payload } = await jwtVerify(token, GUEST_SECRET);
    return payload as unknown as GuestPayload;
  } catch {
    return null;
  }
}
