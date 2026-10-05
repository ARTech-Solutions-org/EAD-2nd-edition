import { COOKIE_NAME } from "../shared/const.js";
import { registrationInputSchema, registrationListSchema, registrationUpdateSchema } from "../shared/ead.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { adminProcedure, publicProcedure, router } from "./_core/trpc.js";
import {
  createRegistration,
  DuplicateEmailError,
  getPendingRegistrations,
  getRegistrationById,
  getRegistrationStats,
  listRegistrations,
  markPrintedByStaff,
  markPrintedByToken,
  updateRegistration,
} from "./eadDb.js";

import { ENV } from "./_core/env.js";
import { sdk } from "./_core/sdk.js";

function publicRegistrationError(error: unknown): never {
  if (error instanceof DuplicateEmailError) {
    throw new TRPCError({ code: "CONFLICT", message: "This email is already registered." });
  }
  const mysqlError = error as { code?: string; errno?: number };
  if (mysqlError?.code === "ER_DUP_ENTRY" || mysqlError?.errno === 1062 || mysqlError?.code === "23505") {
    throw new TRPCError({ code: "CONFLICT", message: "This email is already registered." });
  }
  console.error("[EAD Registration] Database operation failed", error instanceof Error ? error.message : "unknown error");
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Something went wrong. Please try again." });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    login: publicProcedure.input(z.object({ username: z.string(), password: z.string() })).mutation(async ({ input, ctx }) => {
      if (input.username !== ENV.adminUsername || input.password !== ENV.adminPassword) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
      }
      const token = await sdk.createSessionToken("admin", { name: "Admin" });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
      return { success: true };
    }),
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  registration: router({
    create: publicProcedure.input(registrationInputSchema).mutation(async ({ input }) => {
      try {
        return await createRegistration(input);
      } catch (error) {
        return publicRegistrationError(error);
      }
    }),
    markPrinted: publicProcedure
      .input(z.object({ id: z.number().int().positive(), printToken: z.string().length(48) }))
      .mutation(({ input }) => markPrintedByToken(input.id, input.printToken)),
    stats: adminProcedure.query(() => getRegistrationStats()),
    list: adminProcedure.input(registrationListSchema).query(({ input }) => listRegistrations(input)),
    pending: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(100) })).query(({ input }) => getPendingRegistrations(input.limit)),
    byId: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const registration = await getRegistrationById(input.id);
      if (!registration) throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      return registration;
    }),
    update: adminProcedure.input(registrationUpdateSchema).mutation(async ({ input }) => {
      try {
        const registration = await updateRegistration(input);
        if (!registration) throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
        return registration;
      } catch (error) {
        return publicRegistrationError(error);
      }
    }),
    adminPrint: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const registration = await markPrintedByStaff(input.id);
      if (!registration) throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      return registration;
    }),
  }),
});

export type AppRouter = typeof appRouter;
