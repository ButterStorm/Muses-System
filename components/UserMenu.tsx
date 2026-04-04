'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { User, LogOut, LayoutDashboard, Loader2, KeyRound } from 'lucide-react';

export default function UserMenu() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, signOut, checkAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
      >
        <User className="w-4 h-4" />
        登录
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
      >
        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-sm font-bold">
          {user?.email?.[0].toUpperCase() || 'U'}
        </div>
        <span className="max-w-[120px] truncate hidden sm:inline">
          {user?.email?.split('@')[0]}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email}
              </p>
            </div>

            <Link
              href="/projects"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors relative z-50"
              onClick={() => setIsOpen(false)}
            >
              <LayoutDashboard className="w-4 h-4" />
              我的作品
            </Link>

            <Link
              href="/login?mode=reset"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors relative z-50"
              onClick={() => setIsOpen(false)}
            >
              <KeyRound className="w-4 h-4" />
              修改密码
            </Link>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSignOut();
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors relative z-50"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  );
}
