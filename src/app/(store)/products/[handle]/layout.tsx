import { notFound } from "next/navigation";
import { getProduct } from "@/lib/data/storefront";

/** Resolves existence above the loading boundary so missing products return a real 404. */
export default async function ProductLayout({ children, params }: { children: React.ReactNode; params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!(await getProduct(handle))) notFound();
  return children;
}
