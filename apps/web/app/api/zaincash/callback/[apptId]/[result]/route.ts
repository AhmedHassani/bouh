import { NextRequest, NextResponse } from "next/server";
import { db } from "@repo/db";
import { verifyZainCashCallbackJWT, verifyZainCashTransaction } from "@repo/api";

/**
 * ZainCash redirects user to:
 *   /api/zaincash/callback/<appointmentId>/<success|failure>?token=<JWT>
 *
 * 3-layer verification:
 *   1) JWT signed payload (most authoritative)
 *   2) Server-side API verification (fallback)
 *   3) Polling in myAppointments (self-healing)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ apptId: string; result: string }> },
) {
  const appUrl = process.env.APP_URL?.startsWith("http") ? process.env.APP_URL : "http://localhost:3000";
  const { apptId, result } = await params;
  const token = req.nextUrl.searchParams.get("token");

  // 1) JWT verification
  if (token) {
    const decoded = verifyZainCashCallbackJWT(token);
    if (decoded?.data) {
      const { orderId, currentStatus, transactionId } = decoded.data;
      const finalApptId = orderId ?? apptId;
      const status = currentStatus?.toUpperCase();

      if (status === "SUCCESS" || status === "COMPLETED" || status === "PAID") {
        await db.appointment.update({
          where: { id: finalApptId },
          data:  {
            paymentStatus: "PAID",
            ...(transactionId && { paymentRef: transactionId }),
          },
        });
        return NextResponse.redirect(`${appUrl}/consultants?payment=success&apptId=${finalApptId}`);
      }

      await db.appointment.update({
        where: { id: finalApptId },
        data:  { paymentStatus: "FAILED" },
      });
      return NextResponse.redirect(`${appUrl}/consultants?paymentError=${encodeURIComponent(status ?? "failed")}&apptId=${finalApptId}`);
    }
  }

  // 2) Fallback — API verification on success URL
  if (result === "success") {
    try {
      const appt = await db.appointment.findUnique({
        where: { id: apptId },
        select: { paymentRef: true },
      });
      if (appt?.paymentRef) {
        const verification = await verifyZainCashTransaction(appt.paymentRef);
        if (verification.success) {
          await db.appointment.update({
            where: { id: apptId },
            data:  { paymentStatus: "PAID" },
          });
          return NextResponse.redirect(`${appUrl}/consultants?payment=success&apptId=${apptId}`);
        }
      }
    } catch (err) {
      console.error("[ZainCash callback] Fallback verification failed:", err);
    }
    return NextResponse.redirect(`${appUrl}/consultants?paymentError=unverified&apptId=${apptId}`);
  }

  return NextResponse.redirect(`${appUrl}/consultants?paymentError=failed&apptId=${apptId}`);
}
