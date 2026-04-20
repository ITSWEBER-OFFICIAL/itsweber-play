import { notFound } from "next/navigation";
import { StaticPageView } from "@/components/static-page-view";
import { fetchStaticPage } from "@/lib/static-page-ssr";

export const metadata = { title: "AGB — ITSWEBER Play" };
export const revalidate = 3600;

export default async function AgbPage() {
  const page = await fetchStaticPage("agb");
  if (!page) notFound();
  return <StaticPageView page={page} />;
}
