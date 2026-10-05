import { serial, pgEnum, pgTable, timestamp, varchar, boolean, index, uniqueIndex, text } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const languageEnum = pgEnum("language", ["en", "ar"]);

/**
 * Manus OAuth users. The starter assigns the project owner the admin role and
 * the adminProcedure guard is used for every staff-only operation.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * One durable registration per attendee email by default. emailKey permits an
 * explicit administrator override while keeping the ordinary registration
 * path unique. printToken authorizes only the freshly-created attendee's
 * public print confirmation and is never returned from admin queries.
 */
export const registrations = pgTable(
  "registrations",
  {
    id: serial("id").primaryKey(),
    registrationId: varchar("registrationId", { length: 32 }).notNull(),
    name: varchar("name", { length: 140 }).notNull(),
    company: varchar("company", { length: 180 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    emailKey: varchar("emailKey", { length: 360 }).notNull(),
    language: languageEnum("language").default("en").notNull(),
    printToken: varchar("printToken", { length: 64 }).notNull(),
    registeredAt: timestamp("registeredAt").defaultNow().notNull(),
    badgePrinted: boolean("badgePrinted").default(false).notNull(),
    badgePrintedAt: timestamp("badgePrintedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => ({
    registrationCodeUnique: uniqueIndex("registrations_registration_id_unique").on(table.registrationId),
    emailKeyUnique: uniqueIndex("registrations_email_key_unique").on(table.emailKey),
    registeredAtIndex: index("registrations_registered_at_idx").on(table.registeredAt),
    nameIndex: index("registrations_name_idx").on(table.name),
    companyIndex: index("registrations_company_idx").on(table.company),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = typeof registrations.$inferInsert;
