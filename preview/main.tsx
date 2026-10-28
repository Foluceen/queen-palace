/**
 * Preview entry: renders the real storefront and admin page files in the browser,
 * with the mock backend running in the page. Build with `npm run preview:build`.
 */
import "@/app/globals.css";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PageTransition } from "@/components/motion/PageTransition";
import { ErrorState } from "@/components/ui/States";
import { useLoc } from "./router";
import { NotFoundError, ParamsContext } from "./shims/navigation";

/* Storefront */
import StoreLayout from "@/app/(store)/layout";
import StoreNotFound from "@/app/(store)/not-found";
import HomePage from "@/app/(store)/page";
import CollectionsPage from "@/app/(store)/collections/page";
import CollectionPage from "@/app/(store)/collections/[handle]/page";
import ProductPage from "@/app/(store)/products/[handle]/page";
import SearchPage from "@/app/(store)/search/page";
import CartPage from "@/app/(store)/cart/page";
import CheckoutPage from "@/app/(store)/checkout/page";
import OrderPage from "@/app/(store)/order/[number]/page";
import TrackPage from "@/app/(store)/track/page";
import AccountPage from "@/app/(store)/account/page";
import WishlistPage from "@/app/(store)/wishlist/page";
import ContactPage from "@/app/(store)/contact/page";
import ContentPage from "@/app/(store)/[slug]/page";
import ForgotPage from "@/app/(store)/account/forgot/page";
import ResetPage from "@/app/(store)/account/reset/page";

/* Admin */
import AdminRootLayout from "@/app/admin/layout";
import PanelLayout from "@/app/admin/(panel)/layout";
import AdminLogin from "@/app/admin/login/page";
import AdminDashboard from "@/app/admin/(panel)/page";
import AdminProducts from "@/app/admin/(panel)/products/page";
import AdminProduct from "@/app/admin/(panel)/products/[id]/page";
import AdminInventory from "@/app/admin/(panel)/inventory/page";
import AdminCollections from "@/app/admin/(panel)/collections/page";
import AdminMedia from "@/app/admin/(panel)/media/page";
import AdminOrders from "@/app/admin/(panel)/orders/page";
import AdminOrder from "@/app/admin/(panel)/orders/[id]/page";
import AdminStorefront from "@/app/admin/(panel)/storefront/page";
import AdminDiscounts from "@/app/admin/(panel)/discounts/page";
import AdminReviews from "@/app/admin/(panel)/reviews/page";
import AdminShipping from "@/app/admin/(panel)/settings/shipping-payments/page";
import AdminBranding from "@/app/admin/(panel)/settings/branding/page";
import AdminStaff from "@/app/admin/(panel)/staff/page";
import AdminAnalytics from "@/app/admin/(panel)/analytics/page";
import AdminCustomers from "@/app/admin/(panel)/customers/page";
import AdminInquiries from "@/app/admin/(panel)/inquiries/page";
import AdminProductTypes from "@/app/admin/(panel)/product-types/page";
import AdminNavigation from "@/app/admin/(panel)/navigation/page";
import AdminPages from "@/app/admin/(panel)/pages/page";

type Params = Record<string, string>;
type ServerPage = (props: { params: Promise<Params>; searchParams: Promise<Record<string, string>> }) => Promise<ReactNode> | ReactNode;
type Route = { pattern: string; store?: ServerPage; admin?: () => ReactNode; adminBare?: boolean };

const routes: Route[] = [
  { pattern: "/", store: HomePage as ServerPage },
  { pattern: "/collections", store: CollectionsPage as ServerPage },
  { pattern: "/collections/:handle", store: CollectionPage as ServerPage },
  { pattern: "/products/:handle", store: ProductPage as ServerPage },
  { pattern: "/search", store: SearchPage as ServerPage },
  { pattern: "/cart", store: CartPage as ServerPage },
  { pattern: "/checkout", store: CheckoutPage as ServerPage },
  { pattern: "/order/:number", store: OrderPage as ServerPage },
  { pattern: "/track", store: TrackPage as ServerPage },
  { pattern: "/account", store: AccountPage as ServerPage },
  { pattern: "/account/forgot", store: ForgotPage as ServerPage },
  { pattern: "/account/reset", store: ResetPage as ServerPage },
  { pattern: "/wishlist", store: WishlistPage as ServerPage },
  { pattern: "/contact", store: ContactPage as ServerPage },
  { pattern: "/admin/login", admin: AdminLogin, adminBare: true },
  { pattern: "/admin", admin: AdminDashboard },
  { pattern: "/admin/products", admin: AdminProducts },
  { pattern: "/admin/products/:id", admin: AdminProduct },
  { pattern: "/admin/inventory", admin: AdminInventory },
  { pattern: "/admin/collections", admin: AdminCollections },
  { pattern: "/admin/media", admin: AdminMedia },
  { pattern: "/admin/orders", admin: AdminOrders },
  { pattern: "/admin/orders/:id", admin: AdminOrder },
  { pattern: "/admin/storefront", admin: AdminStorefront },
  { pattern: "/admin/discounts", admin: AdminDiscounts },
  { pattern: "/admin/reviews", admin: AdminReviews },
  { pattern: "/admin/settings/shipping-payments", admin: AdminShipping },
  { pattern: "/admin/settings/branding", admin: AdminBranding },
  { pattern: "/admin/staff", admin: AdminStaff },
  { pattern: "/admin/analytics", admin: AdminAnalytics },
  { pattern: "/admin/customers", admin: AdminCustomers },
  { pattern: "/admin/inquiries", admin: AdminInquiries },
  { pattern: "/admin/product-types", admin: AdminProductTypes },
  { pattern: "/admin/navigation", admin: AdminNavigation },
  { pattern: "/admin/pages", admin: AdminPages },
  { pattern: "/:slug", store: ContentPage as unknown as ServerPage },
];

function match(path: string): { route: Route; params: Params } | null {
  const parts = path.split("/").filter(Boolean);
  for (const route of routes) {
    const pp = route.pattern.split("/").filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params: Params = {};
    if (pp.every((p, i) => (p.startsWith(":") ? ((params[p.slice(1)] = decodeURIComponent(parts[i]!)), true) : p === parts[i]))) return { route, params };
  }
  return null;
}

async function resolve(path: string, query: string): Promise<{ node: ReactNode; params: Params }> {
  const m = match(path);
  const sp = Object.fromEntries(new URLSearchParams(query).entries());
  if (m?.route.admin) {
    const Page = m.route.admin;
    const inner = m.route.adminBare ? <Page /> : <PanelLayout><Page /></PanelLayout>;
    return { node: <AdminRootLayout>{inner}</AdminRootLayout>, params: m.params };
  }
  let page: ReactNode;
  try {
    if (!m || !m.route.store) throw new NotFoundError("Not found");
    page = await m.route.store({ params: Promise.resolve(m.params), searchParams: Promise.resolve(sp) });
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err;
    page = <StoreNotFound />;
  }
  const node = await StoreLayout({ children: <PageTransition key={path}>{page}</PageTransition> });
  return { node, params: m?.params ?? {} };
}

class Boundary extends Component<{ children: ReactNode; resetKey: number }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: number }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <div className="container"><ErrorState message={this.state.error.message} onRetry={() => this.setState({ error: null })} /></div>;
    return this.props.children;
  }
}

function App() {
  const loc = useLoc();
  const [view, setView] = useState<{ node: ReactNode; params: Params; seq: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const seq = loc.seq;
    latest.current = seq;
    resolve(loc.path, loc.query)
      .then((v) => {
        if (latest.current !== seq) return;
        setError(null);
        setView({ ...v, seq });
        if (loc.scroll) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      })
      .catch((err: Error) => latest.current === seq && setError(err.message));
  }, [loc]);

  if (error) return <div className="container"><ErrorState message={error} onRetry={() => location.reload()} /></div>;
  if (!view) return <div className="admin-boot"><span className="spinner" aria-label="Loading the store" /></div>;
  return (
    <ParamsContext.Provider value={view.params}>
      <Boundary resetKey={view.seq}>{view.node}</Boundary>
    </ParamsContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
