export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { startSourceIndexBackfillLoop } = await import('@/lib/server/source-index-queue');
  startSourceIndexBackfillLoop();
}
