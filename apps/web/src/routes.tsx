import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { z } from "zod";

import { Layout } from "./components/layout";
import { DashboardPage } from "./pages/dashboard";
import { NotFoundPage } from "./pages/not-found";
import { TransactionsPage } from "./pages/transactions";

// The two daily screens load eagerly; the rest are split into their own chunks.
const AccountsPage = lazyRouteComponent(() => import("./pages/accounts"), "AccountsPage");
const AccountDetailPage = lazyRouteComponent(
  () => import("./pages/account-detail"),
  "AccountDetailPage",
);
const PeoplePage = lazyRouteComponent(() => import("./pages/people"), "PeoplePage");
const CategoriesPage = lazyRouteComponent(() => import("./pages/categories"), "CategoriesPage");
const SettingsPage = lazyRouteComponent(() => import("./pages/settings"), "SettingsPage");

const month = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .optional()
  .catch(undefined);

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFoundPage });

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: z.object({ month }),
  component: DashboardPage,
});

const transactionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/transactions",
  validateSearch: z.object({
    month,
    account: z.string().optional().catch(undefined),
    category: z.string().optional().catch(undefined),
    q: z.string().optional().catch(undefined),
    review: z.boolean().optional().catch(undefined),
  }),
  component: TransactionsPage,
});

const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accounts",
  component: AccountsPage,
});
const accountDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accounts/$accountId",
  component: AccountDetailPage,
});
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  component: PeoplePage,
});
const categoriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/categories",
  validateSearch: z.object({ tab: z.enum(["tree", "rules"]).optional().catch(undefined) }),
  component: CategoriesPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  transactionsRoute,
  accountsRoute,
  accountDetailRoute,
  peopleRoute,
  categoriesRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
