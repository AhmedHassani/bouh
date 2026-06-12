"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

type SpecForm = { nameAr: string; nameEn: string; description: string };
const emptyForm: SpecForm = { nameAr: "", nameEn: "", description: "" };

export default function SpecializationsPage() {
  const { data: specs, refetch } = trpc.specialization.list.useQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SpecForm>(emptyForm);

  const createMutation = trpc.specialization.create.useMutation({ onSuccess: () => { refetch(); close(); } });
  const updateMutation = trpc.specialization.update.useMutation({ onSuccess: () => { refetch(); close(); } });
  const deleteMutation = trpc.specialization.delete.useMutation({ onSuccess: () => refetch() });
  const toggleMutation = trpc.specialization.toggle.useMutation({ onSuccess: () => refetch() });

  const set = (k: keyof SpecForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const open = (spec?: typeof specs extends (infer T)[] | undefined ? T : never) => {
    if (spec) {
      setEditId(spec.id);
      setForm({ nameAr: spec.nameAr, nameEn: spec.nameEn, description: spec.description ?? "" });
    } else {
      setEditId(null);
      setForm(emptyForm);
    }
    setModalOpen(true);
  };

  const close = () => { setModalOpen(false); setEditId(null); setForm(emptyForm); };

  const submit = () => {
    if (editId) updateMutation.mutate({ id: editId, data: { ...form, icon: "" } });
    else createMutation.mutate({ ...form, icon: "" });
  };

  return (
    <div>
      <PageHeader
        title="إدارة التخصصات"
        subtitle={`${specs?.length ?? 0} تخصص`}
        action={<Button onClick={() => open()}>+ إضافة تخصص</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {specs?.map((spec) => (
          <div key={spec.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-800">{spec.nameAr}</h3>
                <p className="text-xs text-gray-400">{spec.nameEn}</p>
              </div>
              <Badge variant={spec.isActive ? "success" : "neutral"}>
                {spec.isActive ? "نشط" : "موقوف"}
              </Badge>
            </div>
            {spec.description && <p className="text-sm text-gray-500 mb-4">{spec.description}</p>}
            <div className="flex gap-2 pt-3 border-t border-gray-50">
              <Button size="sm" variant="secondary" onClick={() => open(spec)}>تعديل</Button>
              <Button size="sm" variant={spec.isActive ? "danger" : "secondary"}
                onClick={() => toggleMutation.mutate({ id: spec.id })} loading={toggleMutation.isPending}>
                {spec.isActive ? "إيقاف" : "تفعيل"}
              </Button>
              <Button size="sm" variant="danger"
                onClick={() => deleteMutation.mutate({ id: spec.id })} loading={deleteMutation.isPending}>
                حذف
              </Button>
            </div>
          </div>
        ))}

        {(!specs || specs.length === 0) && (
          <div className="col-span-3 py-16 text-center text-gray-400">
            <p>لا توجد تخصصات بعد</p>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={close} title={editId ? "تعديل التخصص" : "إضافة تخصص جديد"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="الاسم بالعربي" value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} />
            <Input label="الاسم بالإنجليزي" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
          </div>
          <Textarea label="الوصف" value={form.description} onChange={(e) => set("description", e.target.value)} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={close}>إلغاء</Button>
            <Button onClick={submit} loading={createMutation.isPending || updateMutation.isPending}>
              {editId ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
