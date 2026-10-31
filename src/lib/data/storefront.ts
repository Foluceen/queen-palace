/**
 * Storefront repository used by server components. Pages depend on this interface,
 * never on the mock or the HTTP client directly, so switching NEXT_PUBLIC_DATA_MODE
 * swaps the implementation without touching any component.
 */
import { pageLocally } from "@/lib/listing";
import { connection } from "next/server";
import { cache } from "react";
import { encodeOptions, type EndpointName, type RequestOf, type ResponseOf } from "@/lib/api/contract";
import { ApiError, createApiClient } from "@/lib/api/client";
import { dataMode, serverApiBase } from "@/lib/api/config";
import type {
  Collection,
  CollectionWithProducts,
  ContentPage,
  Homepage,
  Navigation,
  ProductDetail,
  ProductListing,
  ProductQuery,
  PublicPaymentOptions,
  ReviewPage,
  SearchResult,
  StoreSettings,
} from "@/lib/types";

export interface StorefrontRepository {
  settings(): Promise<StoreSettings>;
  navigation(): Promise<Navigation>;
  homepage(): Promise<Homepage>;
  collections(): Promise<Collection[]>;
  collection(handle: string, query: Omit<ProductQuery, "collection">): Promise<CollectionWithProducts | null>;
  products(query: ProductQuery): Promise<ProductListing>;
  product(handle: string): Promise<ProductDetail | null>;
  reviews(productId: string, page?: number): Promise<ReviewPage>;
  search(q: string, page?: number): Promise<SearchResult>;
  page(slug: string): Promise<ContentPage | null>;
  paymentOptions(): Promise<PublicPaymentOptions>;
}

export type Caller = <K extends EndpointName>(name: K, req: RequestOf<K>) => Promise<ResponseOf<K>>;

export function repositoryFrom(call: Caller): StorefrontRepository {
  const orNull = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (err) {
      if (err instanceof ApiError && err.isNotFound) return null;
      throw err;
    }
  };
  return {
    settings: () => call("getStoreSettings", {}),
    navigation: () => call("getNavigation", {}),
    homepage: () => call("getHomepage", {}),
    collections: () => call("listCollections", {}),
    collection: async (handle, { options, ...query }) => {
      const data = await orNull(call("getCollection", { params: { handle }, query: { ...query, options: encodeOptions(options) } }));
      // The live API returns whole collections unsorted and unpaged: page them here when it does.
      return data ? { ...data, listing: pageLocally(data.listing, query) } : null;
    },
    products: ({ options, ...query }) => call("listProducts", { query: { ...query, options: encodeOptions(options) } }),
    product: (handle) => orNull(call("getProduct", { params: { handle } })),
    reviews: (productId, page = 1) => call("listProductReviews", { params: { productId }, query: { page } }),
    search: async (q, page = 1) => {
      const r = await call("search", { query: { q, page } });
      // The live API returns every match at once: show them 15 per page like everywhere else.
      return { ...r, products: pageLocally(r.products, { page, pageSize: 15 }) };
    },
    page: (slug) => orNull(call("getContentPage", { params: { slug } })),
    paymentOptions: () => call("getPaymentOptions", {}),
  };
}

async function mockCaller<K extends EndpointName>(name: K, req: RequestOf<K>): Promise<ResponseOf<K>> {
  const { callMock, MockHttpError } = await import("@/lib/mock/backend");
  try {
    // Query values travel as strings over HTTP; mirror that so mock and live parse identically.
    const r = req as { query?: Record<string, unknown> };
    const query = r.query ? Object.fromEntries(Object.entries(r.query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])) : undefined;
    return callMock(name, { ...req, query } as RequestOf<K>);
  } catch (err) {
    if (err instanceof MockHttpError) throw new ApiError(err.status, err.code, err.message, err.fields);
    throw err;
  }
}

const revalidate = Number(process.env.CATALOG_REVALIDATE_SECONDS ?? 60);

/**
 * Live mode: every server render reads the real API. `connection()` marks the route as
 * request-time rendered, so builds never call the API and never bake API failures (or data)
 * into static HTML. API responses are still cached in Next's data cache for
 * CATALOG_REVALIDATE_SECONDS (tag "catalog"); after that window the next request refetches.
 * There is no fallback to mock data: failures throw and the route's error boundary shows a
 * retry state.
 */
function liveCaller(): Caller {
  // Vercel functions time out at 10s by default; fail before that so the error page renders.
  const client = createApiClient(serverApiBase(), { timeoutMs: 8000, init: { next: { revalidate, tags: ["catalog"] } } });
  return async (name, req) => {
    await connection();
    return client.call(name, req);
  };
}

const getRepository = cache((): StorefrontRepository => repositoryFrom(dataMode === "mock" ? mockCaller : liveCaller()));

export const storefront = (): StorefrontRepository => getRepository();

/** Per-request memoised reads used by layouts and pages together. */
export const getSettings = cache(() => storefront().settings());
export const getNavigation = cache(() => storefront().navigation());
export const getProduct = cache((handle: string) => storefront().product(handle));
/** Collection header data (one product), shared by the layout existence check and metadata. */
export const getCollectionHead = cache((handle: string) => storefront().collection(handle, { pageSize: 1 }));
