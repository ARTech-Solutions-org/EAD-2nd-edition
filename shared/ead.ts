import { z } from "zod";

export const languageSchema = z.enum(["en", "ar"]);
export type EadLanguage = z.infer<typeof languageSchema>;

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(320)
  .transform((value) => value.toLowerCase());

export const registrationInputSchema = z.object({
  name: z.string().trim().min(2).max(140),
  company: z.string().trim().min(2).max(180),
  title: z.string().trim().min(2).max(180),
  email: emailSchema,
  language: languageSchema,
});

export const registrationUpdateSchema = registrationInputSchema.extend({
  id: z.number().int().positive(),
  overrideDuplicate: z.boolean().default(false),
});

export const registrationListSchema = z.object({
  search: z.string().trim().max(160).default(""),
  status: z.enum(["any", "printed", "pending"]).default("any"),
  sortBy: z.enum(["registeredAt", "name", "company", "email", "badgePrinted"]).default("registeredAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

export type RegistrationInput = z.infer<typeof registrationInputSchema>;
export type RegistrationUpdateInput = z.infer<typeof registrationUpdateSchema>;
export type RegistrationListInput = z.infer<typeof registrationListSchema>;

export type EadRegistration = {
  id: number;
  registrationId: string;
  name: string;
  company: string;
  title: string;
  email: string;
  language: EadLanguage;
  registeredAt: Date;
  badgePrinted: boolean;
  badgePrintedAt: Date | null;
  updatedAt: Date;
};
