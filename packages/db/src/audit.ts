import { desc } from "drizzle-orm";

import { newId, type DbOrTx } from "./client";
import { auditLog } from "./schema";

export type AuditAction =
  | "statement.import"
  | "statement.delete"
  | "period.lock"
  | "period.unlock"
  | "reconcile.adjust"
  | "reconcile.opening";

export async function logAudit(
  db: DbOrTx,
  action: AuditAction,
  entity: string,
  entityId: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(auditLog)
    .values({ id: newId(), action, entity, entityId, detail: detail ?? null });
}

export async function listAudit(db: DbOrTx, limit = 200) {
  return db.select().from(auditLog).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(limit);
}
