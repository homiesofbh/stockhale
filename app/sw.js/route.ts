import {
  developmentWorker,
  productionWorker,
} from "@/lib/stockwell/service-worker";

export function GET() {
  return new Response(
    process.env.NODE_ENV === "production"
      ? productionWorker
      : developmentWorker,
    {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  );
}
