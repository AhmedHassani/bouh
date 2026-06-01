import { z } from "zod";

export const questionOptionSchema = z.object({
  textAr: z.string().min(1),
  textEn: z.string().optional().default(""),
  score: z.number().int().min(0),
  order: z.number().int().min(0),
});

export const createQuestionSchema = z.object({
  assessmentId: z.string(),
  textAr: z.string().min(1),
  textEn: z.string().optional().default(""),
  order: z.number().int().min(0),
  options: z.array(questionOptionSchema).min(2),
});

export const resultCategorySchema = z.object({
  labelAr: z.string().min(1),
  labelEn: z.string().optional().default(""),
  minScore: z.number().int().min(0).optional().default(0),
  maxScore: z.number().int().min(0).optional().default(9999),
  description: z.string().optional(),
  recommendation: z.string().optional(),
});

export const createAssessmentSchema = z.object({
  titleAr: z.string().min(1),
  titleEn: z.string().optional().default(""),
  description: z.string().optional(),
  categories: z.array(resultCategorySchema).min(1),
});

export const submitAssessmentSchema = z.object({
  assessmentId: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      optionId: z.string(),
    }),
  ),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;
