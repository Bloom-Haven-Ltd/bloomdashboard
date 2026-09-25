'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — pharmacies now live in the unified People directory. */
export default function PharmaciesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/users?role=pharmacy');
  }, [router]);
  return null;
}
