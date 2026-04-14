import { palette } from '@motovault/design-system';

export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: palette.neutral950 }}
    >
      <span className="text-lg font-bold text-neutral-50">
        Moto<span style={{ color: palette.signature400 }}>Vault</span>
      </span>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-800 border-t-neutral-400" />
    </div>
  );
}
