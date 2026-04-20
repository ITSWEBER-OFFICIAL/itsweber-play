import { notFound } from "next/navigation";
import { StaticPageView } from "@/components/static-page-view";
import { fetchStaticPage } from "@/lib/static-page-ssr";

export const metadata = { title: "Impressum — ITSWEBER Play" };
export const revalidate = 3600;

export default async function ImpressumPage() {
  const page = await fetchStaticPage("impressum");
  if (!page) notFound();
  return <StaticPageView page={page} />;
}
