export default function SharedTripNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#0a1540] to-[#3366e6]" />
        <h1 className="text-2xl font-bold text-neutral-900">This trip isn't available</h1>
        <p className="mt-3 text-sm text-neutral-500">
          The rider may have made it private or the link has been revoked.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="https://apps.apple.com/app/motovault/id6745417382"
            className="inline-flex items-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Get MotoVault
          </a>
          <a
            href="https://motovault.app"
            className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  );
}
