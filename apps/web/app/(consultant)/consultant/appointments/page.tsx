"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, Pagination } from "@/components/ui/data-table";
import { appointmentStatusBadge } from "@/components/ui/badge";
import { Button, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

const STATUS_OPTIONS = [
  { value: "", label: "كل الحالات" },
  { value: "PENDING", label: "معلّق" },
  { value: "CONFIRMED", label: "مؤكد" },
  { value: "COMPLETED", label: "مكتمل" },
  { value: "CANCELLED", label: "ملغي" },
  { value: "NO_SHOW", label: "لم يحضر" },
];

export default function ConsultantAppointmentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [actionModal, setActionModal] = useState<{ id: string; action: string } | null>(null);

  const { data, refetch } = trpc.appointment.myAppointments.useQuery({
    status: (status || undefined) as never,
    page,
    limit: 15,
  });

  const updateStatus = trpc.appointment.updateStatus.useMutation({
    onSuccess: () => { refetch(); setActionModal(null); },
  });

  type Row = NonNullable<typeof data>["data"][number];

  const columns = [
    {
      key: "client",
      header: "العميل",
      render: (r: Row) => (
        <div>
          <p className="font-medium text-sm text-gray-800">{r.client.user.name}</p>
          <p className="text-xs text-gray-400">{r.client.user.email}</p>
        </div>
      ),
    },
    { key: "scheduledAt", header: "الموعد", render: (r: Row) => new Date(r.scheduledAt).toLocaleString("ar-SA") },
    { key: "duration", header: "المدة", render: (r: Row) => `${r.duration} دقيقة` },
    { key: "finalPrice", header: "السعر", render: (r: Row) => `${Number(r.finalPrice)} ر.س` },
    { key: "status", header: "الحالة", render: (r: Row) => appointmentStatusBadge(r.status) },
    {
      key: "actions",
      header: "إجراءات",
      render: (r: Row) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {r.status === "PENDING" && (
            <Button size="sm" variant="secondary" onClick={() => setActionModal({ id: r.id, action: "CONFIRMED" })}>تأكيد</Button>
          )}
          {r.status === "CONFIRMED" && (
            <Button size="sm" onClick={() => setActionModal({ id: r.id, action: "COMPLETED" })}>اكتمل ✅</Button>
          )}
          {["PENDING", "CONFIRMED"].includes(r.status) && (
            <Button size="sm" variant="danger" onClick={() => setActionModal({ id: r.id, action: "CANCELLED" })}>إلغاء</Button>
          )}
          {r.status === "CONFIRMED" && (
            <Button size="sm" variant="secondary" onClick={() => setActionModal({ id: r.id, action: "NO_SHOW" })}>لم يحضر</Button>
          )}
        </div>
      ),
    },
  ];

  const actionLabels: Record<string, string> = {
    CONFIRMED: "تأكيد الموعد",
    COMPLETED: "تأكيد اكتمال الجلسة",
    CANCELLED: "إلغاء الموعد",
    NO_SHOW: "تسجيل غياب",
  };

  return (
    <div>
      <PageHeader title="المواعيد" subtitle={`${data?.total ?? 0} موعد`} />

      <div className="mb-4 w-48">
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUS_OPTIONS} />
      </div>

      <DataTable data={(data?.data ?? []) as Record<string, unknown>[]} columns={columns as never} emptyMessage="لا توجد مواعيد" />
      <Pagination page={page} total={data?.total ?? 0} limit={15} onChange={setPage} />

      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title={actionModal ? actionLabels[actionModal.action] : ""} size="sm">
        <p className="text-gray-600 mb-6">
          هل تريد {actionModal ? actionLabels[actionModal.action] : ""}؟
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setActionModal(null)}>إلغاء</Button>
          <Button
            variant={actionModal?.action === "CANCELLED" ? "danger" : "primary"}
            loading={updateStatus.isPending}
            onClick={() => actionModal && updateStatus.mutate({ id: actionModal.id, status: actionModal.action as never })}
          >
            تأكيد
          </Button>
        </div>
      </Modal>
    </div>
  );
}
