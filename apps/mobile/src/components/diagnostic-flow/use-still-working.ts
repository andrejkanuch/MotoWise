import { useEffect, useState } from 'react';
import { DIAGNOSIS_STILL_WORKING_MS } from '@/config/diagnosis-submit';

/** Issue 365 T17: true once a submit has been in flight `DIAGNOSIS_STILL_WORKING_MS`. */
export function useStillWorking(isSubmitting: boolean): boolean {
  const [stillWorking, setStillWorking] = useState(false);
  useEffect(() => {
    setStillWorking(false);
    if (!isSubmitting) return;
    const timer = setTimeout(() => setStillWorking(true), DIAGNOSIS_STILL_WORKING_MS);
    return () => clearTimeout(timer);
  }, [isSubmitting]);
  return stillWorking;
}
