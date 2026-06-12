import { z } from "zod";

export const createConsultantSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8),
  avatar: z.string().optional(), // base64 data URL
  bio: z.string().optional(),
  sessionPrice: z.number().min(0),
  city: z.string().optional(),
  yearsOfExperience: z.number().int().min(0).default(0),
  academicQualification: z.string().optional(),
  certifications: z.array(z.string()).default([]),
  commissionRate: z.number().min(0).max(1).default(0.2),
  specializationIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const updateConsultantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().optional(),
  sessionPrice: z.number().min(0).optional(),
  city: z.string().optional(),
  yearsOfExperience: z.number().int().min(0).optional(),
  academicQualification: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  specializationIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const consultantFilterSchema = z.object({
  search: z.string().optional(),
  specializationId: z.string().optional(),
  city: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minExperience: z.number().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "sessionPrice", "rating", "yearsOfExperience"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateConsultantInput = z.infer<typeof createConsultantSchema>;
export type UpdateConsultantInput = z.infer<typeof updateConsultantSchema>;
export type ConsultantFilterInput = z.infer<typeof consultantFilterSchema>;
