import { notFound } from "next/navigation";
import { StaticPageView } from "@/components/static-page-view";
import { fetchStaticPage } from "@/lib/static-page-ssr";

export const metadata = { title: "Datenschutzerklärung — ITSWEBER Play" };
export const revalidate = 3600;

export default async function DatenschutzPage() {
  const page = await fetchStaticPage("datenschutz");
  if (!page) notFound();
  return <StaticPageView page={page} />;
}
