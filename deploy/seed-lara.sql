-- Legacy import: المستشارة هدى + العميلة lara + موعدها
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) المستشار
INSERT INTO "User" (id, "clerkId", email, name, password, role, "isActive", "createdAt", "updatedAt")
VALUES (
  'huda-' || gen_random_uuid()::text,
  'manual-huda-' || extract(epoch from now())::text,
  'hudamohammadmajed92@gmail.com',
  'هدى محمد',
  crypt('TempPass!23', gen_salt('bf')),
  'CONSULTANT', true, now(), now()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "ConsultantProfile" (id, "userId", bio, city, "yearsOfExperience", "sessionPrice", commission, rating, "isActive", "createdAt", "updatedAt")
SELECT 'cp-' || gen_random_uuid()::text, u.id, NULL, 'بغداد', 0, 31499, 0.10, 0, true, now(), now()
FROM "User" u WHERE u.email = 'hudamohammadmajed92@gmail.com'
ON CONFLICT ("userId") DO NOTHING;

-- 2) العميلة المجهولة lara
INSERT INTO "AnonymousUser" (id, "deviceId", nickname, "createdAt", "updatedAt")
VALUES (
  'anon-lara-1781007485707',
  'legacy-booking_1781007485707',
  'lara',
  now(), now()
)
ON CONFLICT ("deviceId") DO NOTHING;

-- 3) الحجز
INSERT INTO "Appointment" (
  id, "anonUserId", "consultantId", "scheduledAt", duration, status,
  "originalPrice", "discountAmount", "finalPrice",
  "paymentMethod", "paymentStatus",
  "adminApproved", "adminApprovedAt",
  "clientAddress", "clientPhone",
  "createdAt", "updatedAt"
)
SELECT
  'appt-legacy-1781007485707',
  'anon-lara-1781007485707',
  cp.id,
  TIMESTAMPTZ '2026-06-13 22:00:00+03',
  60, 'CONFIRMED',
  31499, 0, 31499,
  'REPRESENTATIVE', 'PAID',
  true, now(),
  'الغزالية', '07774661147',
  now(), now()
FROM "ConsultantProfile" cp
JOIN "User" u ON u.id = cp."userId"
WHERE u.email = 'hudamohammadmajed92@gmail.com'
ON CONFLICT (id) DO NOTHING;

COMMIT;
