"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, Pagination } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

type CouponForm = {
  code: string; discountType: "PERCENTAGE" | "FIXED";
  discountValue: number; maxDiscount: string;
  expiresAt: string; isActive: boolean; usageLimit: string;
};

const emptyForm: CouponForm = {
  code: "", discountType: "PERCENTAGE", discountValue: 0,
  maxDiscount: "", expiresAt: "", isActive: true, usageLimit: "",
};

export default function CouponsPage() {
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const { data, refetch } = trpc.coupon.list.useQuery({ page, limit: 20 });
  const createMutation = trpc.coupon.create.useMutation({ onSuccess: () => { refetch(); closeModal(); } });
  const updateMutation = trpc.coupon.update.useMutation({ onSuccess: () => { refetch(); closeModal(); } });
  const toggleMutation = trpc.coupon.toggle.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.coupon.delete.useMutation({ onSuccess: () => refetch() });

  const set = <K extends keyof CouponForm>(k: K, v: CouponForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => { setEditId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (c: NonNullable<typeof data>["data"][number]) => {
    setEditId(c.id);
    setForm({
      code: c.code, discountType: c.discountType,
      discountValue: Number(c.discountValue),
      maxDiscount: c.maxDiscount ? String(c.maxDiscount) : "",
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : "",
      isActive: c.isActive, usageLimit: c.usageLimit ? String(c.usageLimit) : "",
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditId(null); setForm(emptyForm); };

  const submit = () => {
    const payload = {
      ...form,
      code: form.code.toUpperCase(),
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  };

  type Row = NonNullable<typeof data>["data"][number];

  const columns = [
    { key: "code", header: "الكود", render: (r: Row) => <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-indigo-700">{r.code}</code> },
    { key: "discountType", header: "نوع الخصم", render: (r: Row) => r.discountType === "PERCENTAGE" ? "نسبة مئوية" : "مبلغ ثابت" },
    { key: "discountValue", header: "القيمة", render: (r: Row) => r.discountType === "PERCENTAGE" ? `${r.discountValue}%` : `${r.discountValue} ر.س` },
    { key: "usageCount", header: "الاستخدام", render: (r: Row) => `${r.usageCount}${r.usageLimit ? ` / ${r.usageLimit}` : ""}` },
    { key: "expiresAt", header: "الانتهاء", render: (r: Row) => r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("ar-SA") : "بلا تاريخ" },
    { key: "isActive", header: "الحالة", render: (r: Row) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "نشط" : "موقوف"}</Badge> },
    {
      key: "actions", header: "إجراءات",
      render: (r: Row) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>تعديل</Button>
          <Button size="sm" variant={r.isActive ? "danger" : "secondary"} onClick={() => toggleMutation.mutate({ id: r.id })} loading={toggleMutation.isPending}>
            {r.isActive ? "إيقاف" : "تفعيل"}
          </Button>
          <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate({ id: r.id })} loading={deleteMutation.isPending}>حذف</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="إدارة الكوبونات" subtitle={`${data?.total ?? 0} كوبون`} action={<Button onClick={openCreate}>+ إضافة كوبون</Button>} />

      <DataTable data={(data?.data ?? []) as Record<string, unknown>[]} columns={columns as never} emptyMessage="لا توجد كوبونات" />
      <Pagination page={page} total={data?.total ?? 0} limit={20} onChange={setPage} />

      <Modal open={modalOpen} onClose={closeModal} title={editId ? "تعديل الكوبون" : "إضافة كوبون جديد"}>
        <div className="space-y-4">
          <Input label="كود الكوبون" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} disabled={!!editId} />
          <Select label="نوع الخصم" value={form.discountType} onChange={(e) => set("discountType", e.target.value as "PERCENTAGE" | "FIXED")}
            options={[{ value: "PERCENTAGE", label: "نسبة مئوية (%)" }, { value: "FIXED", label: "مبلغ ثابت (ر.س)" }]} />
          <Input label={`قيمة الخصم (${form.discountType === "PERCENTAGE" ? "%" : "ر.س"})`} type="number" value={form.discountValue} onChange={(e) => set("discountValue", +e.target.value)} />
          {form.discountType === "PERCENTAGE" && (
            <Input label="الحد الأقصى للخصم (اختياري)" type="number" value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} />
          )}
          <Input label="تاريخ الانتهاء (اختياري)" type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
          <Input label="حد الاستخدام (اختياري)" type="number" value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal}>إلغاء</Button>
            <Button onClick={submit} loading={createMutation.isPending || updateMutation.isPending}>
              {editId ? "حفظ" : "إضافة"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
