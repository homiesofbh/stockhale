export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    const {deliverEmails}=await import('./lib/stockwell/server');
    // A persistent Node server drains the outbox even while every client is closed.
    const timer=setInterval(()=>{void deliverEmails().catch(()=>{});},30000);
    timer.unref();
  }
}
