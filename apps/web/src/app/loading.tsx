export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[--color-surface] dark:bg-neutral-900">
      <p className="text-[--color-on-surface-muted] dark:text-neutral-300 animate-pulse">
        Loading...
      </p>
    </div>
  );
}
