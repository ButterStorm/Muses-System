'use client';

import React, { useEffect, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

const FlowCanvas = dynamic(() => import('@/components/FlowCanvas'), {
  ssr: false,
});

function CanvasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      setIsChecking(false);
    };
    init();
  }, [checkAuth]);

  useEffect(() => {
    if (!isChecking && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isChecking, isLoading, isAuthenticated, router]);

  if (isChecking || isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <FlowCanvas projectId={projectId} />;
}

export default function CanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      }
    >
      <CanvasContent />
    </Suspense>
  );
}
