import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PATHS = ["/admin"];
const CONSULTANT_PATHS = ["/consultant/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isConsultantPath = CONSULTANT_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/consultant";

  if (isAdminPath || isConsultantPath) {
    // In development, skip auth check (tRPC context auto-creates SUPER_ADMIN)
    if (process.env.NODE_ENV === "development") return NextResponse.next();

    const token = req.cookies.get("misahuh_access_token")?.value;
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
