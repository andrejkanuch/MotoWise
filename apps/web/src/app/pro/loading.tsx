import { MvLoader } from '@/components/marketing/loader';

export default function ProLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <MvLoader label="Loading" />
    </div>
  );
}
