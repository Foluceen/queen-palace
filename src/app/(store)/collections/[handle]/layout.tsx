import { notFound } from "next/navigation";
import { getCollectionHead } from "@/lib/data/storefront";

/** Resolves existence above the loading boundary so missing collections return a real 404. */
export default async function CollectionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!(await getCollectionHead(handle))) notFound();
  return children;
}
