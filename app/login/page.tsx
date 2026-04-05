'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, Eye, EyeOff, ArrowLeft, ArrowRight } from 'lucide-react';
import Galaxy from '@/components/Galaxy';

type PageMode = 'login' | 'register' | 'forgot' | 'reset';

const leftPanelContent: Record<PageMode, { tagline: string; detail: string }> = {
  login: {
    tagline: 'Design Your Future',
    detail: '用激情与目标设计未来，释放你的创造潜能。',
  },
  register: {
    tagline: 'Start Creating',
    detail: '开始你的 AI 创作之旅，从灵感到作品。',
  },
  forgot: {
    tagline: 'We\'ve Got You',
    detail: '别担心，我们帮你找回账户访问权限。',
  },
  reset: {
    tagline: 'Stay Secure',
    detail: '设置一个安全的新密码来保护你的账户。',
  },
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, updatePassword, resetPasswordEmail, isAuthenticated, isLoading: authLoading } = useAuthStore();

  const getInitialMode = (): PageMode => {
    const mode = searchParams.get('mode');
    if (mode === 'reset') return 'reset';
    return 'login';
  };

  const [mode, setMode] = useState<PageMode>(getInitialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated && mode !== 'reset') {
      router.push('/');
    }
  }, [isAuthenticated, router, mode]);

  const switchMode = useCallback((next: PageMode) => {
    setTransitioning(true);
    setTimeout(() => {
      setMode(next);
      setError('');
      setSuccess('');
      setTransitioning(false);
    }, 180);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (mode === 'login') {
      const { error: authError } = await signIn(email, password);
      if (authError) setError(authError);
    } else if (mode === 'register') {
      const { error: authError, needsConfirmation } = await signUp(email, password);
      if (authError) {
        setError(authError);
      } else if (needsConfirmation) {
        setSuccess('注册成功！请检查您的邮箱并点击验证链接完成注册。');
        setEmail('');
        setPassword('');
      }
    } else if (mode === 'forgot') {
      const { error: authError } = await resetPasswordEmail(email);
      if (authError) {
        setError(authError);
      } else {
        setSuccess('重置密码邮件已发送，请检查您的邮箱。');
      }
    } else if (mode === 'reset') {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
      } else if (password.length < 6) {
        setError('密码至少需要6个字符');
      } else {
        const { error: authError } = await updatePassword(password);
        if (authError) {
          setError(authError);
        } else {
          setSuccess('密码修改成功！正在跳转...');
          setTimeout(() => router.push('/'), 1500);
        }
      }
    }

    setIsLoading(false);
  };

  const titles: Record<PageMode, { heading: string; sub: string }> = {
    login: { heading: '欢迎回来', sub: '登录以继续您的创作旅程' },
    register: { heading: '创建账户', sub: '注册开始使用 MusesSystem' },
    forgot: { heading: '重置密码', sub: '输入邮箱，我们将发送重置链接' },
    reset: { heading: '修改密码', sub: '请输入您的新密码' },
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[1.5px] border-white/10 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const panel = leftPanelContent[mode];

  return (
    <div className="min-h-screen bg-[#060606] relative flex">
      {/* ── Left Panel: Galaxy + Branding ── */}
      <div className="hidden lg:flex lg:w-[44%] relative overflow-hidden">
        {/* Galaxy */}
        <div className="absolute inset-0">
          <Galaxy
            focal={[0.5, 0.5]}
            rotation={[1.0, 0.0]}
            starSpeed={0.5}
            density={1}
            hueShift={140}
            disableAnimation={false}
            speed={1.0}
            mouseInteraction={true}
            glowIntensity={0.3}
            saturation={0.0}
            mouseRepulsion={true}
            repulsionStrength={2}
            twinkleIntensity={0.3}
            rotationSpeed={0.1}
            autoCenterRepulsion={0}
            transparent={true}
          />
        </div>

        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#060606]" />
        <div className="absolute inset-0 bg-[#060606]/30" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <img src="/bs_logo.jpeg" alt="Logo" className="w-9 h-9 rounded-lg" />
            <span className="text-white/90 text-lg font-semibold tracking-tight">MusesSystem</span>
          </Link>

          <div className="max-w-[280px]">
            <div
              className={`transition-all duration-500 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              key={`left-${mode}`}
            >
              <p className="text-emerald-400/80 text-[11px] font-medium tracking-[0.25em] uppercase mb-3">
                {panel.tagline}
              </p>
              <p className="text-white/70 text-base leading-relaxed">
                {panel.detail}
              </p>
            </div>
          </div>

          <p className="text-white/20 text-xs">
            &copy; {new Date().getFullYear()} MusesSystem
          </p>
        </div>

        {/* Edge glow line */}
        <div className="absolute right-0 top-[20%] bottom-[20%] w-px bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent" />
      </div>

      {/* ── Right Panel: Form ── */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        {/* Mobile header */}
        <div className="lg:hidden absolute top-0 left-0 right-0 p-5 flex items-center justify-between z-20">
          <Link href="/" className="flex items-center gap-2">
            <img src="/bs_logo.jpeg" alt="Logo" className="w-7 h-7 rounded-md" />
            <span className="text-white/80 text-sm font-semibold">MusesSystem</span>
          </Link>
        </div>

        {/* Back link (desktop) */}
        <div className="hidden lg:block p-6 lg:p-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-300 transition-colors text-sm group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回首页</span>
          </Link>
        </div>

        {/* Form Area */}
        <div className="flex-1 flex items-center justify-center px-6 lg:px-16 xl:px-24">
          <div
            className={`w-full max-w-[340px] transition-all duration-300 ease-out ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
            } ${transitioning ? 'opacity-0 translate-y-2' : ''}`}
          >
            {/* Mode indicator */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-[3px] h-7 bg-emerald-400 rounded-full" />
              <span className="text-emerald-400/70 text-[10px] font-semibold tracking-[0.3em] uppercase">
                {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Sign Up' : mode === 'forgot' ? 'Recover' : 'Update'}
              </span>
            </div>

            {/* Title block */}
            <div className="mb-9">
              <h1 className="text-[28px] lg:text-[32px] font-bold text-white tracking-tight leading-tight mb-1.5">
                {titles[mode].heading}
              </h1>
              <p className="text-zinc-500 text-[13px] leading-relaxed">
                {titles[mode].sub}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 tracking-[0.2em] uppercase mb-1.5">
                    邮箱地址
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    autoComplete="email"
                    className="login-input w-full bg-transparent border-0 border-b border-zinc-800 focus:border-emerald-400/50 text-white placeholder-zinc-700 text-[15px] py-3 px-0 focus:outline-none transition-colors"
                  />
                </div>
              )}

              {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 tracking-[0.2em] uppercase mb-1.5">
                    {mode === 'reset' ? '新密码' : '密码'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      className="login-input w-full bg-transparent border-0 border-b border-zinc-800 focus:border-emerald-400/50 text-white placeholder-zinc-700 text-[15px] py-3 pr-10 px-0 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-zinc-700 hover:text-zinc-400 transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'reset' && (
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 tracking-[0.2em] uppercase mb-1.5">
                    确认新密码
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="login-input w-full bg-transparent border-0 border-b border-zinc-800 focus:border-emerald-400/50 text-white placeholder-zinc-700 text-[15px] py-3 px-0 focus:outline-none transition-colors"
                  />
                </div>
              )}

              {/* Messages */}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/[0.06] border-l-2 border-red-400/40 pl-3 pr-2 py-2.5 rounded-r-md">
                  <span className="text-red-400/90 text-[13px] leading-snug">{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2.5 bg-emerald-500/[0.06] border-l-2 border-emerald-400/40 pl-3 pr-2 py-2.5 rounded-r-md">
                  <span className="text-emerald-400/90 text-[13px] leading-snug">{success}</span>
                </div>
              )}

              {/* Submit */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-white text-[#060606] font-semibold text-[13px] tracking-[0.1em] uppercase hover:bg-zinc-200 active:scale-[0.985] transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-[1.5px] border-[#060606]/20 border-t-[#060606] rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === 'login' ? '登录' : mode === 'register' ? '创建账户' : mode === 'forgot' ? '发送重置邮件' : '修改密码'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Mode switch */}
            <div className="mt-7 pt-6 border-t border-zinc-800/50 space-y-2.5">
              {mode === 'login' && (
                <>
                  <button
                    onClick={() => switchMode('register')}
                    className="w-full text-left text-[13px] text-zinc-500 hover:text-white transition-colors group flex items-center justify-between py-1"
                  >
                    <span>还没有账户？<span className="text-zinc-300 group-hover:text-emerald-400 transition-colors">创建一个</span></span>
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </button>
                  <button
                    onClick={() => switchMode('forgot')}
                    className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors py-1"
                  >
                    忘记密码？
                  </button>
                </>
              )}
              {mode === 'register' && (
                <button
                  onClick={() => switchMode('login')}
                  className="w-full text-left text-[13px] text-zinc-500 hover:text-white transition-colors group flex items-center justify-between py-1"
                >
                  <span>已有账户？<span className="text-zinc-300 group-hover:text-emerald-400 transition-colors">去登录</span></span>
                  <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </button>
              )}
              {mode === 'forgot' && (
                <button
                  onClick={() => switchMode('login')}
                  className="w-full text-left text-[13px] text-zinc-500 hover:text-white transition-colors group flex items-center justify-between py-1"
                >
                  <span>返回<span className="text-zinc-300 group-hover:text-emerald-400 transition-colors">登录</span></span>
                  <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </button>
              )}
              {mode === 'reset' && (
                <Link
                  href="/canvas"
                  className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors py-1 block"
                >
                  跳过，直接进入画布 &rarr;
                </Link>
              )}
            </div>

            {/* Footer */}
            <p className="mt-10 text-zinc-700 text-[11px]">
              登录即表示您同意我们的服务条款和隐私政策
            </p>
          </div>
        </div>
      </div>

      {/* ── Mobile Galaxy Background ── */}
      <div className="lg:hidden fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.15]">
          <Galaxy
            focal={[0.5, 0.5]}
            rotation={[1.0, 0.0]}
            starSpeed={0.3}
            density={0.4}
            hueShift={140}
            disableAnimation={false}
            speed={0.5}
            mouseInteraction={false}
            glowIntensity={0.2}
            saturation={0.0}
            mouseRepulsion={false}
            repulsionStrength={0}
            twinkleIntensity={0.2}
            rotationSpeed={0.05}
            autoCenterRepulsion={0}
            transparent={true}
          />
        </div>
        <div className="absolute inset-0 bg-[#060606]/80" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060606] flex items-center justify-center">
          <div className="w-8 h-8 border-[1.5px] border-white/10 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
