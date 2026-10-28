/**
 * Storefront repository used by server components. Pages depend on this interface,
 * never on the mock or the HTTP client directly, so switching NEXT_PUBLIC_DATA_MODE
 * swaps the implementation without touching any component.
 */
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
  Paginated,
  ProductDetail,
  ProductListing,
  ProductQuery,
  PublicPaymentOptions,
  Review,
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
  reviews(productId: string, page?: number): Promise<Paginated<Review>>;
  search(q: string, page?: number): Promise<SearchResult>;
  page(slug: string): Promise<ContentPage | null>;
  paymentOptions(): Promise<PublicPaymentOptions>;
}

type Caller = <K extends EndpointName>(name: K, req: RequestOf<K>) => Promise<ResponseOf<K>>;

function repositoryFrom(call: Caller): StorefrontRepository {
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
    collection: (handle, { options, ...query }) => orNull(call("getCollection", { params: { handle }, query: { ...query, options: encodeOptions(options) } })),
    products: ({ options, ...query }) => call("listProducts", { query: { ...query, options: encodeOptions(options) } }),
    product: (handle) => orNull(call("getProduct", { params: { handle } })),
    reviews: (productId, page = 1) => call("listProductReviews", { params: { productId }, query: { page } }),
    search: (q, page = 1) => call("search", { query: { q, page } }),
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

function liveCaller(): Caller {
  const client = createApiClient(serverApiBase(), { init: { next: { revalidate, tags: ["catalog"] } } });
  return (name, req) => client.call(name, req);
}

const getRepository = cache((): StorefrontRepository => repositoryFrom(dataMode === "mock" ? mockCaller : liveCaller()));

export const storefront = (): StorefrontRepository => getRepository();

/** Per-request memoised reads used by layouts and pages together. */
export const getSettings = cache(() => storefront().settings());
export const getNavigation = cache(() => storefront().navigation());
export const getProduct = cache((handle: string) => storefront().product(handle));
/** Collection header data (one product), shared by the layout existence check and metadata. */
export const getCollectionHead = cache((handle: string) => storefront().collection(handle, { pageSize: 1 }));
