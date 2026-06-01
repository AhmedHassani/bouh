# مساحة بوح

مونوريبو كامل يجمع تطبيق ويب (Next.js) وتطبيق موبايل (Expo) مع API مشترك (tRPC).

## Stack

| الطبقة | التقنية |
|--------|---------|
| Monorepo | Turborepo + pnpm workspaces |
| Web | Next.js 15 (App Router) + TypeScript |
| Mobile | Expo SDK 52 + React Native + TypeScript |
| API | tRPC v11 |
| Database | PostgreSQL + Prisma ORM |
| Auth | Clerk |
| Styling Web | Tailwind CSS v4 |
| Styling Mobile | NativeWind v4 |
| Validation | Zod |

## هيكل المشروع

```
misahuh-bawh/
├── apps/
│   ├── web/          # Next.js 15
│   └── mobile/       # Expo SDK 52
└── packages/
    ├── api/          # tRPC routers
    ├── db/           # Prisma + PostgreSQL
    ├── validators/   # Zod schemas (shared)
    └── ui/           # Shared React components
```

## البدء السريع

### 1. تثبيت الاعتماديات

```bash
pnpm install
```

### 2. إعداد المتغيرات البيئية

```bash
# للويب
cp apps/web/.env.example apps/web/.env.local

# للموبايل
cp apps/mobile/.env.example apps/mobile/.env.local
```

### 3. ملء المتغيرات البيئية

**`apps/web/.env.local`:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/misahuh_bawh
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**`apps/mobile/.env.local`:**
```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=http://localhost:3000
```

> احصل على مفاتيح Clerk من [clerk.com](https://clerk.com)

### 4. إعداد قاعدة البيانات

```bash
pnpm db:push
```

### 5. تشغيل المشروع

```bash
# تشغيل كل شيء
pnpm dev

# تشغيل الويب فقط
pnpm dev:web

# تشغيل الموبايل فقط
pnpm dev:mobile
```

## الأوامر المتاحة

```bash
pnpm dev          # تشغيل جميع التطبيقات
pnpm dev:web      # تشغيل الويب فقط (localhost:3000)
pnpm dev:mobile   # تشغيل الموبايل فقط
pnpm build        # بناء الإنتاج
pnpm db:push      # مزامنة schema مع قاعدة البيانات
pnpm db:studio    # فتح Prisma Studio
pnpm db:generate  # توليد Prisma Client
pnpm lint         # فحص الكود
```

## إضافة المستخدم تلقائياً بعد التسجيل

بعد تسجيل المستخدم عبر Clerk، يمكنك استخدام Clerk Webhooks لاستدعاء `user.create` في tRPC لحفظ المستخدم في قاعدة البيانات.
