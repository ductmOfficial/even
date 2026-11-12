import type { CategoryBucket, CategoryNature } from "@even/domain";
import { asc, eq, sql } from "drizzle-orm";

import { newId, type DbOrTx } from "./client";
import { categories, type Category } from "./schema";

export async function listCategories(db: DbOrTx, options: { includeArchived?: boolean } = {}) {
  return db
    .select()
    .from(categories)
    .where(options.includeArchived ? undefined : eq(categories.archived, false))
    .orderBy(asc(categories.sort), asc(categories.name));
}

export interface CategoryInput {
  name: string;
  parentId: string | null;
  kind?: Category["kind"];
  nature?: CategoryNature | null;
  bucket?: CategoryBucket | null;
  icon?: string | null;
}

/** Creates a category; children inherit kind, nature and bucket from the parent by default. */
export async function createCategory(db: DbOrTx, input: CategoryInput): Promise<string> {
  let parent: Category | undefined;
  if (input.parentId) {
    [parent] = await db.select().from(categories).where(eq(categories.id, input.parentId));
    if (!parent) throw new Error(`Parent category ${input.parentId} not found`);
  }
  const [{ maxSort } = { maxSort: 0 }] = await db
    .select({ maxSort: sql<number>`coalesce(max(${categories.sort}), -1)::int`.mapWith(Number) })
    .from(categories)
    .where(
      input.parentId
        ? eq(categories.parentId, input.parentId)
        : sql`${categories.parentId} is null`,
    );
  const id = newId();
  await db.insert(categories).values({
    id,
    parentId: input.parentId,
    name: input.name.trim(),
    kind: input.kind ?? parent?.kind ?? "expense",
    nature: input.nature === undefined ? (parent?.nature ?? null) : input.nature,
    bucket: input.bucket === undefined ? (parent?.bucket ?? null) : input.bucket,
    icon: input.icon ?? null,
    sort: maxSort + 1,
  });
  return id;
}

export async function updateCategory(
  db: DbOrTx,
  id: string,
  patch: Partial<Omit<CategoryInput, "kind">> & { archived?: boolean },
): Promise<void> {
  const [current] = await db.select().from(categories).where(eq(categories.id, id));
  if (!current) throw new Error(`Category ${id} not found`);
  if (current.system && patch.archived) throw new Error("System categories cannot be archived");
  if (patch.parentId === id) throw new Error("A category cannot be its own parent");
  await db
    .update(categories)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(categories.id, id));
}
