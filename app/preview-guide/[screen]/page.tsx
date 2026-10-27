import { notFound } from "next/navigation";
import { GuideCapturePreview } from "@/components/stockwell/guide-capture-preview";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { screen } = await params;
  if (!["opening-stock", "stock-history", "customer-accounts", "daily-closing", "low-stock", "returns"].includes(screen)) notFound();
  return <GuideCapturePreview screen={screen} />;
}
