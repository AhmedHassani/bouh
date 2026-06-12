"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, Pagination } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

export default function ConsultantsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.consultant.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    city: city || undefined,
  });

  const toggleActive = trpc.consultant.toggleActive.useMutation({ onSuccess: () => refetch() });
  const deleteConsultant = trpc.consultant.delete.useMutation({
    onSuccess: () => { setDeleteId(null); refetch(); },
  });

  type Row = NonNullable<typeof data>["data"][number];

  const columns = [
    {
      key: "name",
      header: "الاسم",
      render: (row: Row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
            {row.user.name?.[0] ?? "؟"}
          </div>
          <div>
            <p className="font-medium text-gray-800">{row.user.name}</p>
            <p className="text-xs text-gray-400">{row.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "specializations",
      header: "التخصصات",
      render: (row: Row) => (
        <div className="flex flex-wrap gap-1">
          {row.specializations.slice(0, 2).map((s) => (
            <Badge key={s.specializationId} variant="info">
              {s.specialization.nameAr}
            </Badge>
          ))}
          {row.specializations.length > 2 && (
            <Badge variant="neutral">+{row.specializations.length - 2}</Badge>
          )}
        </div>
      ),
    },
    { key: "city", header: "المدينة", render: (row: Row) => row.city ?? "-" },
    {
      key: "sessionPrice",
      header: "سعر الجلسة",
      sortable: true,
      render: (row: Row) => `${Number(row.sessionPrice).toLocaleString("ar")} د.ع`,
    },
    {
      key: "rating",
      header: "التقييم",
      sortable: true,
      render: (row: Row) => Number(row.rating).toFixed(1),
    },
    {
      key: "status",
      header: "الحالة",
      render: (row: Row) => (
        <Badge variant={row.user.isActive ? "success" : "danger"}>
          {row.user.isActive ? "نشط" : "موقوف"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "إجراءات",
      render: (row: Row) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Link href={`/admin/consultants/${row.id}`}>
            <Button size="sm" variant="secondary">تعديل</Button>
          </Link>
          <Button
            size="sm"
            variant={row.user.isActive ? "danger" : "secondary"}
            onClick={() => toggleActive.mutate({ id: row.id })}
            loading={toggleActive.isPending}
          >
            {row.user.isActive ? "إيقاف" : "تفعيل"}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteId(row.id)}>
            حذف
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="إدارة المستشارين"
        subtitle={`${data?.total ?? 0} مستشار`}
        action={
          <Link href="/admin/consultants/new">
            <Button>+ إضافة مستشار</Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <Input
          placeholder="بحث بالاسم أو البريد..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-64"
        />
        <Input
          placeholder="تصفية بالمدينة"
          value={city}
          onChange={(e) => { setCity(e.target.value); setPage(1); }}
          className="w-48"
        />
      </div>

      <DataTable
        data={(data?.data ?? []) as Record<string, unknown>[]}
        columns={columns as never}
        loading={isLoading}
        emptyMessage="لا يوجد مستشارون"
      />
      <Pagination page={page} total={data?.total ?? 0} limit={20} onChange={setPage} />

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="تأكيد الحذف" size="sm">
        <p className="text-gray-600 mb-6">هل أنت متأكد من حذف هذا المستشار؟ لا يمكن التراجع.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>إلغاء</Button>
          <Button
            variant="danger"
            loading={deleteConsultant.isPending}
            onClick={() => deleteId && deleteConsultant.mutate({ id: deleteId })}
          >
            حذف نهائياً
          </Button>
        </div>
      </Modal>
    </div>
  );
}
