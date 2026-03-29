'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/canvas');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (isLogin) {
      const { error: authError } = await signIn(email, password);
      if (authError) {
        setError(authError);
      }
    } else {
      const { error: authError, needsConfirmation } = await signUp(email, password);
      if (authError) {
        setError(authError);
      } else if (needsConfirmation) {
        setSuccess('注册成功！请检查您的邮箱并点击验证链接完成注册。');
        setEmail('');
        setPassword('');
      }
    }

    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* 雾化背景效果 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-20 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-yellow-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/2 w-64 h-64 bg-amber-100/40 rounded-full blur-3xl" />
      </div>

      <Link href="/" className="absolute top-6 left-6 text-amber-700/70 hover:text-amber-800 transition-colors z-10">
        ← 返回首页
      </Link>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-900 mb-2">
            {isLogin ? '欢迎回来' : '创建账户'}
          </h1>
          <p className="text-amber-700/70">
            {isLogin ? '登录以继续您的创作' : '注册开始使用 MusesSystem'}
          </p>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-8 border border-white/50 shadow-xl shadow-amber-100/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-amber-800 mb-2">
                邮箱地址
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 bg-white/70 border border-amber-200 rounded-xl text-amber-900 placeholder-amber-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-amber-800 mb-2">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 bg-white/70 border border-amber-200 rounded-xl text-amber-900 placeholder-amber-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-amber-500 hover:text-amber-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-100/80 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-100/80 border border-green-200 rounded-xl p-3 text-green-600 text-sm">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? '登录' : '注册'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }}
              className="text-amber-600/80 hover:text-amber-800 text-sm transition-colors"
            >
              {isLogin ? '还没有账户？点击注册' : '已有账户？点击登录'}
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-amber-600/50 text-sm">
          登录即表示您同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
