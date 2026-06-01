"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Input, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export default function ConsultantsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const { data: specializations } = trpc.specialization.list.useQuery({ isActive: true });
  const { data, isLoading } = trpc.consultant.list.useQuery({
    page, limit: 12,
    search: search || undefined,
    specializationId: specializationId || undefined,
    city: city || undefined,
    minPrice: minPrice ? +minPrice : undefined,
    maxPrice: maxPrice ? +maxPrice : undefined,
    isActive: true,
  });

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600">مساحة بوح</Link>
          <div className="flex gap-3">
            <Link href="/appointments" className="text-sm text-gray-600 hover:text-indigo-600">مواعيدي</Link>
            <Link href="/assessment" className="text-sm text-gray-600 hover:text-indigo-600">التقييم النفسي</Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">المستشارون النفسيون</h1>
        <p className="text-gray-500 mb-8">اختر المستشار المناسب لك وابدأ رحلتك نحو الصحة النفسية</p>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Input placeholder="بحث..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="col-span-2 md:col-span-1" />
            <Select
              value={specializationId}
              onChange={(e) => { setSpecializationId(e.target.value); setPage(1); }}
              options={[{ value: "", label: "كل التخصصات" }, ...(specializations?.map((s) => ({ value: s.id, label: s.nameAr })) ?? [])]}
            />
            <Input placeholder="المدينة" value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} />
            <Input type="number" placeholder="سعر من" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} />
            <Input type="number" placeholder="سعر إلى" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} />
          </div>
        </div>

        {/* Results count */}
        {data && <p className="text-sm text-gray-500 mb-4">{data.total} مستشار متاح</p>}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="flex gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-12 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data?.data.map((c) => (
              <Link key={c.id} href={`/consultants/${c.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all block">
                {/* Avatar + name */}
                <div className="flex gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-2xl font-bold text-indigo-600 flex-shrink-0">
                    {c.user.name?.[0] ?? "؟"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{c.user.name}</h3>
                    <p className="text-xs text-gray-400">{c.city}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-amber-400 text-xs">⭐</span>
                      <span className="text-xs font-medium text-gray-700">{Number(c.rating).toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({c._count.reviews})</span>
                    </div>
                  </div>
                </div>

                {/* Specializations */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.specializations.slice(0, 3).map((s) => (
                    <Badge key={s.specializationId} variant="info">{s.specialization.nameAr}</Badge>
                  ))}
                  {c.specializations.length > 3 && <Badge variant="neutral">+{c.specializations.length - 3}</Badge>}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div>
                    <p className="text-xs text-gray-400">سعر الجلسة</p>
                    <p className="font-bold text-indigo-600">{Number(c.sessionPrice)} ر.س</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-400">الخبرة</p>
                    <p className="text-sm font-medium text-gray-700">{c.yearsOfExperience} سنة</p>
                  </div>
                </div>
              </Link>
            ))}

            {data?.data.length === 0 && (
              <div className="col-span-3 py-16 text-center text-gray-400">
                <p className="text-5xl mb-3">🔍</p>
                <p>لم يتم العثور على مستشارين</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <Pagination page={page} total={data?.total ?? 0} limit={12} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
