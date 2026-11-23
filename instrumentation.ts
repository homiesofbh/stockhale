export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    !process.env.VERCEL &&
    process.env.RESEND_API_KEY &&
    process.env.RESEND_FROM
  ) {
    const { deliverEmails } = await import("./lib/stockwell/server");
    // Serverless deployments drain the durable outbox through API activity.
    const timer = setInterval(() => {
      void deliverEmails().catch(() => {});
    }, 30000);
    timer.unref();
  }
}
