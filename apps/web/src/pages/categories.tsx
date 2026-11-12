import {
  applyRules,
  createCategory,
  createRule,
  deleteRule,
  updateCategory,
  updateRule,
  type Category,
} from "@even/db";
import {
  buildCategoryTree,
  isValidRulePattern,
  type CategoryBucket,
  type CategoryNature,
  type CategoryTreeNode,
} from "@even/domain";
import {
  Button,
  DialogActions,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
} from "@ductmofficial/sen-ui";
import { Badge, buttonClass, Card, Skeleton, Switch } from "@even/ui";
import { getRouteApi } from "@tanstack/react-router";
import {
  ArchiveIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { useState } from "react";

import { FormDialog } from "../components/dialogs";
import { SelectField, TreeField } from "../components/fields";
import { PageHeader } from "../components/page";
import { useLedgerMutation } from "../data/mutate";
import { categoryOptions, useLookups, useRules, type Lookups } from "../data/queries";

const route = getRouteApi("/categories");

const NATURE: Record<CategoryNature, string> = { fixed: "Cố định", variable: "Biến đổi" };
const BUCKET: Record<CategoryBucket, string> = {
  need: "Thiết yếu",
  want: "Mong muốn",
  save: "Tiết kiệm",
};
const NONE = "__none__";

export function CategoriesPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <>
      <PageHeader
        title="Danh mục & luật"
        description="Cây danh mục dựa trên Plaid Personal Finance Categories, Việt hoá. Thêm được nhiều cấp."
      />
      <Tabs
        selectedKey={search.tab ?? "tree"}
        onSelectionChange={(tab) => {
          void navigate({ search: { tab: tab === "rules" ? "rules" : undefined } });
        }}
      >
        <TabList aria-label="Danh mục và luật">
          <Tab id="tree">Danh mục</Tab>
          <Tab id="rules">Luật tự phân loại</Tab>
        </TabList>
        <TabPanel id="tree" className="mt-4">
          <CategoryTree />
        </TabPanel>
        <TabPanel id="rules" className="mt-4">
          <RulesTable />
        </TabPanel>
      </Tabs>
    </>
  );
}

type EditState =
  | { mode: "create"; parentId: string | null; kind: Category["kind"] }
  | { mode: "edit"; category: Category };

function CategoryTree() {
  const lookups = useLookups();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const archive = useLedgerMutation(
    async (db, c: Category) => updateCategory(db, c.id, { archived: !c.archived }),
    {
      success: "Đã cập nhật",
    },
  );
  if (!lookups) return <Skeleton className="h-96" />;
  const tree = buildCategoryTree(lookups.categories.filter((c) => showArchived || !c.archived));

  const renderNode = (node: CategoryTreeNode<Category>) => {
    const c = node.category;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(c.id);
    return (
      <li key={c.id}>
        <div
          className="group flex items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-accent/60"
          style={{ paddingLeft: `${String(node.depth * 1.5 + 0.25)}rem` }}
        >
          {hasChildren ? (
            <Button
              variant="secondary"
              className={buttonClass({ tone: "ghost", size: "icon-sm" }, "size-6")}
              aria-label={isCollapsed ? `Mở ${c.name}` : `Thu gọn ${c.name}`}
              aria-expanded={!isCollapsed}
              onClick={() => {
                setCollapsed((s) => {
                  const next = new Set(s);
                  if (next.has(c.id)) next.delete(c.id);
                  else next.add(c.id);
                  return next;
                });
              }}
            >
              <ChevronRightIcon className={isCollapsed ? "" : "rotate-90 transition-transform"} />
            </Button>
          ) : (
            <span className="size-6" />
          )}
          <span className={node.depth === 0 ? "font-medium" : ""}>{c.name}</span>
          {c.archived ? <Badge tone="warning">Lưu trữ</Badge> : null}
          {node.depth === 0 && c.nature ? <Badge>{NATURE[c.nature]}</Badge> : null}
          {node.depth === 0 && c.bucket ? <Badge tone="primary">{BUCKET[c.bucket]}</Badge> : null}
          <span className="ml-auto flex gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
            <Button
              variant="secondary"
              className={buttonClass({ tone: "ghost", size: "icon-sm" })}
              aria-label={`Thêm mục con trong ${c.name}`}
              onClick={() => {
                setEditing({ mode: "create", parentId: c.id, kind: c.kind });
              }}
            >
              <PlusIcon />
            </Button>
            <Button
              variant="secondary"
              className={buttonClass({ tone: "ghost", size: "icon-sm" })}
              aria-label={`Sửa ${c.name}`}
              onClick={() => {
                setEditing({ mode: "edit", category: c });
              }}
            >
              <PencilIcon />
            </Button>
            {!c.system ? (
              <Button
                variant="secondary"
                className={buttonClass({ tone: "ghost", size: "icon-sm" })}
                aria-label={c.archived ? `Bỏ lưu trữ ${c.name}` : `Lưu trữ ${c.name}`}
                onClick={() => {
                  archive.mutate(c);
                }}
              >
                <ArchiveIcon />
              </Button>
            ) : null}
          </span>
        </div>
        {hasChildren && !isCollapsed ? <ul>{node.children.map(renderNode)}</ul> : null}
      </li>
    );
  };

  return (
    <Card className="p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button
          className={buttonClass({ size: "sm" })}
          onClick={() => {
            setEditing({ mode: "create", parentId: null, kind: "expense" });
          }}
        >
          <PlusIcon /> Danh mục chi
        </Button>
        <Button
          variant="secondary"
          className={buttonClass({ size: "sm" })}
          onClick={() => {
            setEditing({ mode: "create", parentId: null, kind: "income" });
          }}
        >
          <PlusIcon /> Danh mục thu
        </Button>
        <Button
          variant="secondary"
          className={buttonClass({ tone: "ghost", size: "sm" })}
          onClick={() => {
            setCollapsed(new Set(tree.map((n) => n.category.id)));
          }}
        >
          Thu gọn tất cả
        </Button>
        <Button
          variant="secondary"
          className={buttonClass({ tone: "ghost", size: "sm" })}
          onClick={() => {
            setCollapsed(new Set());
          }}
        >
          Mở tất cả
        </Button>
        <Switch className="ml-auto" isSelected={showArchived} onChange={setShowArchived}>
          Hiện mục đã lưu trữ
        </Switch>
      </div>
      <ul aria-label="Cây danh mục">{tree.map(renderNode)}</ul>
      {editing ? (
        <CategoryDialog
          state={editing}
          lookups={lookups}
          onClose={() => {
            setEditing(null);
          }}
        />
      ) : null}
    </Card>
  );
}

function CategoryDialog({
  state,
  lookups,
  onClose,
}: {
  state: EditState;
  lookups: Lookups;
  onClose: () => void;
}) {
  const current = state.mode === "edit" ? state.category : undefined;
  const [name, setName] = useState(current?.name ?? "");
  const [nature, setNature] = useState<string>(current?.nature ?? NONE);
  const [bucket, setBucket] = useState<string>(current?.bucket ?? NONE);
  const parentId = state.mode === "create" ? state.parentId : (current?.parentId ?? null);
  const save = useLedgerMutation(
    async (db) => {
      const attrs = {
        nature: nature === NONE ? null : (nature as CategoryNature),
        bucket: bucket === NONE ? null : (bucket as CategoryBucket),
      };
      if (current) await updateCategory(db, current.id, { name, ...attrs });
      else if (state.mode === "create")
        await createCategory(db, { name, parentId, kind: state.kind, ...(parentId ? {} : attrs) });
    },
    { success: "Đã lưu danh mục" },
  );
  const parent = parentId ? lookups.categoryLabel(parentId) : null;
  return (
    <FormDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={current ? "Sửa danh mục" : "Thêm danh mục"}
      description={parent ? `Trong: ${parent}` : undefined}
    >
      <div className="grid gap-4">
        <TextField
          label="Tên"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        {!parentId || current ? (
          <>
            <SelectField
              label="Tính chất"
              description="Mục con mặc định thừa hưởng từ mục cha"
              value={nature}
              onChange={setNature}
              options={[
                { value: NONE, label: "Không đặt" },
                { value: "fixed", label: NATURE.fixed },
                { value: "variable", label: NATURE.variable },
              ]}
            />
            <SelectField
              label="Nhóm 50/30/20"
              value={bucket}
              onChange={setBucket}
              options={[
                { value: NONE, label: "Không đặt" },
                ...Object.entries(BUCKET).map(([value, label]) => ({ value, label })),
              ]}
            />
          </>
        ) : null}
      </div>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          Huỷ
        </Button>
        <Button
          disabled={!name.trim() || save.isPending}
          onClick={() => {
            save.mutate(undefined, { onSuccess: onClose });
          }}
        >
          Lưu
        </Button>
      </DialogActions>
    </FormDialog>
  );
}

function RulesTable() {
  const lookups = useLookups();
  const rules = useRules();
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState<string>();
  const add = useLedgerMutation(
    async (db) => {
      if (!categoryId) throw new Error("Chọn danh mục");
      await createRule(db, { pattern, matchType: "contains", categoryId, priority: 5 });
    },
    { success: "Đã thêm luật" },
  );
  const toggle = useLedgerMutation(async (db, input: { id: string; enabled: boolean }) =>
    updateRule(db, input.id, { enabled: input.enabled }),
  );
  const remove = useLedgerMutation(async (db, id: string) => deleteRule(db, id), {
    success: "Đã xoá luật",
  });
  const apply = useLedgerMutation(async (db) => applyRules(db), {
    success: (n) => `Đã phân loại lại ${String(n)} giao dịch đang chờ duyệt`,
  });
  if (!lookups || !rules.data) return <Skeleton className="h-64" />;
  const valid = isValidRulePattern(pattern, "contains") && Boolean(categoryId);

  return (
    <Card>
      <div className="grid items-end gap-3 border-b p-3 sm:grid-cols-[1fr_16rem_auto_auto]">
        <TextField
          label="Mô tả chứa"
          description="Dùng | để ghi nhiều từ: grab|be"
          value={pattern}
          onChange={(e) => {
            setPattern(e.target.value);
          }}
        />
        <TreeField
          label="Danh mục của luật"
          value={categoryId}
          onChange={setCategoryId}
          options={categoryOptions(lookups.categories)}
          placeholder="Gõ để tìm"
        />
        <Button
          className={buttonClass()}
          disabled={!valid || add.isPending}
          onClick={() => {
            add.mutate(undefined, {
              onSuccess: () => {
                setPattern("");
              },
            });
          }}
        >
          <PlusIcon /> Thêm luật
        </Button>
        <Button
          variant="secondary"
          className={buttonClass()}
          disabled={apply.isPending}
          onClick={() => {
            apply.mutate(undefined);
          }}
          title="Chạy luật cho các giao dịch đang chờ duyệt"
        >
          <WandSparklesIcon /> Áp dụng
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Luật tự phân loại, ưu tiên số nhỏ trước</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">
                Mô tả chứa
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Danh mục
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Ưu tiên
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Bật
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.data.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs break-all">{r.pattern}</td>
                <td className="px-3 py-2">{lookups.categoryLabel(r.categoryId)}</td>
                <td className="px-3 py-2 tabular-nums">{r.priority}</td>
                <td className="px-3 py-2">
                  <Switch
                    aria-label={`Bật luật ${r.pattern}`}
                    isSelected={r.enabled}
                    onChange={(enabled) => {
                      toggle.mutate({ id: r.id, enabled });
                    }}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="secondary"
                    className={buttonClass({ tone: "ghost", size: "icon-sm" })}
                    aria-label={`Xoá luật ${r.pattern}`}
                    onClick={() => {
                      remove.mutate(r.id);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
