import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, like, lt, or, sql, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { registrations, type Registration } from "../drizzle/schema";
import type { EadRegistration, RegistrationInput, RegistrationListInput, RegistrationUpdateInput } from "../shared/ead";
import { getDb } from "./db";

export class DuplicateEmailError extends Error {
  constructor() {
    super("This email is already registered.");
    this.name = "DuplicateEmailError";
  }
}

function publicRegistration(record: Registration): EadRegistration {
  const { emailKey: _emailKey, printToken: _printToken, ...safe } = record;
  return safe;
}

function dbOrThrow() {
  return getDb().then((db) => {
    if (!db) throw new Error("Registration storage is temporarily unavailable.");
    return db;
  });
}

async function findByEmail(email: string, excludeId?: number) {
  const db = await dbOrThrow();
  const clauses: SQL[] = [sql`LOWER(${registrations.email}) = ${email.toLowerCase()}`];
  if (excludeId !== undefined) clauses.push(sql`${registrations.id} <> ${excludeId}`);
  const [record] = await db.select().from(registrations).where(and(...clauses)).limit(1);
  return record;
}

export async function createRegistration(input: RegistrationInput) {
  const email = input.email.trim().toLowerCase();
  if (await findByEmail(email)) throw new DuplicateEmailError();

  const db = await dbOrThrow();
  const printToken = randomBytes(24).toString("hex");
  const registrationId = `EAD26-${nanoid(10).toUpperCase()}`;
  const inserted = await db
    .insert(registrations)
    .values({
      registrationId,
      name: input.name.trim(),
      company: input.company.trim(),
      title: input.title.trim(),
      email,
      emailKey: email,
      language: input.language,
      printToken,
      badgePrinted: false,
    })
    .returning({ id: registrations.id });
  const id = Number(inserted[0]?.id);
  if (!id) throw new Error("The registration could not be saved.");
  const [record] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
  if (!record) throw new Error("The registration could not be retrieved.");
  return { ...publicRegistration(record), printToken };
}

export async function getRegistrationById(id: number): Promise<EadRegistration | null> {
  const db = await dbOrThrow();
  const [record] = await db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
  return record ? publicRegistration(record) : null;
}

export async function updateRegistration(input: RegistrationUpdateInput): Promise<EadRegistration | null> {
  const db = await dbOrThrow();
  const email = input.email.trim().toLowerCase();
  const duplicate = await findByEmail(email, input.id);
  if (duplicate && !input.overrideDuplicate) throw new DuplicateEmailError();

  await db
    .update(registrations)
    .set({
      name: input.name.trim(),
      company: input.company.trim(),
      title: input.title.trim(),
      email,
      emailKey: duplicate ? `${email}#override-${nanoid(8)}` : email,
      language: input.language,
      updatedAt: new Date(),
    })
    .where(eq(registrations.id, input.id));
  return getRegistrationById(input.id);
}

export async function markPrintedByToken(id: number, printToken: string) {
  const db = await dbOrThrow();
  const result = await db
    .update(registrations)
    .set({ badgePrinted: true, badgePrintedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(registrations.id, id), eq(registrations.printToken, printToken)));
  return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
}

export async function markPrintedByStaff(id: number): Promise<EadRegistration | null> {
  const db = await dbOrThrow();
  await db
    .update(registrations)
    .set({ badgePrinted: true, badgePrintedAt: new Date(), updatedAt: new Date() })
    .where(eq(registrations.id, id));
  return getRegistrationById(id);
}

export async function getRegistrationStats() {
  const db = await dbOrThrow();
  const [totalRow] = await db.select({ total: sql<number>`COUNT(*)` }).from(registrations);
  const [printedRow] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(registrations)
    .where(eq(registrations.badgePrinted, true));

  const now = new Date();
  const cairoNow = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const cairoDayStart = new Date(cairoNow.getFullYear(), cairoNow.getMonth(), cairoNow.getDate());
  const utcOffset = cairoNow.getTime() - now.getTime();
  const dayStart = new Date(cairoDayStart.getTime() - utcOffset);
  const [todayRow] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(registrations)
    .where(gte(registrations.registeredAt, dayStart));

  const total = Number(totalRow?.total ?? 0);
  const printed = Number(printedRow?.total ?? 0);
  return { total, today: Number(todayRow?.total ?? 0), printed, pending: total - printed };
}

export async function listRegistrations(input: RegistrationListInput) {
  const db = await dbOrThrow();
  const terms: SQL[] = [];
  const query = input.search.trim();
  if (query) {
    const escaped = query.replace(/[\\%_]/g, "\\$&");
    const pattern = `${escaped}%`;
    const emailPattern = `${escaped.toLowerCase()}%`;
    terms.push(or(like(registrations.name, pattern), like(registrations.company, pattern), like(registrations.emailKey, emailPattern))!);
  }
  if (input.status === "printed") terms.push(eq(registrations.badgePrinted, true));
  if (input.status === "pending") terms.push(eq(registrations.badgePrinted, false));
  const where = terms.length ? and(...terms) : undefined;
  const sortColumn = {
    registeredAt: registrations.registeredAt,
    name: registrations.name,
    company: registrations.company,
    email: registrations.email,
    badgePrinted: registrations.badgePrinted,
  }[input.sortBy];
  const sortOrder = input.sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);
  const offset = (input.page - 1) * input.pageSize;

  const [rows, countRows] = await Promise.all([
    db.select().from(registrations).where(where).orderBy(sortOrder).limit(input.pageSize).offset(offset),
    db.select({ total: sql<number>`COUNT(*)` }).from(registrations).where(where),
  ]);
  return {
    items: rows.map(publicRegistration),
    total: Number(countRows[0]?.total ?? 0),
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getPendingRegistrations(limit = 100) {
  const db = await dbOrThrow();
  const rows = await db
    .select()
    .from(registrations)
    .where(eq(registrations.badgePrinted, false))
    .orderBy(asc(registrations.registeredAt))
    .limit(limit);
  return rows.map(publicRegistration);
}
