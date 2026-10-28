import { PageTransition } from "@/components/motion/PageTransition";

export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
