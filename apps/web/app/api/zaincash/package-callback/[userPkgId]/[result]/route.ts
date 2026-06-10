import { NextRequest, NextResponse } from "next/server";
import { db } from "@repo/db";
import { verifyZainCashCallbackJWT, verifyZainCashTransaction } from "@repo/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userPkgId: string; result: string }> },
) {
  const appUrl = process.env.APP_URL?.startsWith("http") ? process.env.APP_URL : "http://localhost:3000";
  const { userPkgId, result } = await params;
  const token = req.nextUrl.searchParams.get("token");

  // 1) JWT
  if (token) {
    const decoded = verifyZainCashCallbackJWT(token);
    if (decoded?.data) {
      const { orderId, currentStatus, transactionId } = decoded.data;
      const id = orderId ?? userPkgId;
      const status = currentStatus?.toUpperCase();

      if (status === "SUCCESS" || status === "COMPLETED" || status === "PAID") {
        await db.userPackage.update({
          where: { id },
          data:  {
            paymentStatus: "PAID",
            ...(transactionId && { paymentRef: transactionId }),
          },
        });
        return NextResponse.redirect(`${appUrl}/consultants?packagePayment=success&pkgId=${id}`);
      }

      await db.userPackage.update({
        where: { id },
        data:  { paymentStatus: "FAILED" },
      });
      return NextResponse.redirect(`${appUrl}/consultants?packageError=${encodeURIComponent(status ?? "failed")}`);
    }
  }

  // 2) Fallback
  if (result === "success") {
    try {
      const pkg = await db.userPackage.findUnique({
        where: { id: userPkgId },
        select: { paymentRef: true },
      });
      if (pkg?.paymentRef) {
        const v = await verifyZainCashTransaction(pkg.paymentRef);
        if (v.success) {
          await db.userPackage.update({
            where: { id: userPkgId },
            data:  { paymentStatus: "PAID" },
          });
          return NextResponse.redirect(`${appUrl}/consultants?packagePayment=success&pkgId=${userPkgId}`);
        }
      }
    } catch (err) {
      console.error("[Package callback] verification failed:", err);
    }
  }

  return NextResponse.redirect(`${appUrl}/consultants?packageError=failed&pkgId=${userPkgId}`);
}
