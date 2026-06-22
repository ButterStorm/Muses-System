'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Camera, Copy, CreditCard, Globe, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useAuthStore } from '@/stores/authStore';
import ColorBends from '@/components/ColorBends';
import Galaxy from '@/components/Galaxy';
import { getCreditBalance } from '@/services/CreditService';
import { getUserProfile, updateUserProfile } from '@/lib/profile';
import { useModalFocus } from '@/hooks/useModalFocus';

const translations = {
  en: {
    nav: { home: 'Home', canvas: 'Canvas', works: 'Works', timeline: 'Timeline', login: 'LOGIN' },
    hero: {
      badge: 'AI Agent Creation Platform',
      title: 'Build Concrete Beauty on a Visual AI Canvas',
      desc: 'Create text, images, video, audio, music, and agent tasks in one flow-based workspace. MusesAOS connects multiple models, sandbox execution, and project history so teams can turn ideas into production-ready assets faster.'
    },
    featured: {
      title: 'Core Creation Workflows',
      desc: 'A unified workspace for multimodal generation, visual orchestration, and agent-assisted production.'
    },
    project1: {
      title: 'Script Generation',
      desc: 'Experience the future of writing with AI-powered suggestions, real-time collaboration, and smart formatting that adapts to your style.'
    },
    project2: {
      title: 'Creative Design Canvas',
      desc: 'Unleash your creativity with an infinite canvas, advanced vector tools, and intuitive controls designed for digital artists.'
    },
    project3: {
      title: 'Cinematic Video Production',
      desc: 'Transform raw footage into cinematic masterpieces with our professional-grade video editing suite. Featuring intelligent scene recognition, automatic editing, real-time effects rendering, and multi-language subtitle generation to help you break creative boundaries and efficiently produce stunning visual works.'
    },
    common: { learnMore: 'Learn More' },
    cta: {
      kicker: 'Workspace Ready',
      title: 'Start Building with MusesAOS',
      desc: 'Open the canvas, connect generators, and let agents help execute complex creative workflows.',
      btn: 'OPEN CANVAS'
    }
  },
  zh: {
    nav: { home: '首页', canvas: '画布', works: '作品', timeline: '时间线', login: '登录' },
    hero: {
      badge: 'AI Agent 创作平台',
      title: '在可视化AI画布，构建具体的美',
      desc: '把文本、图像、视频、音频、音乐和 Agent 任务放进同一个流程画布。MusesSystem 连接多模型生成、沙箱执行和项目管理，帮助团队更快把想法通过 AI 变成具体的美。'
    },
    featured: {
      title: '核心创作',
      desc: '面向多模态生成、可视化编排和 Agent 辅助制作的一体化工作区。'
    },
    project1: {
      title: '长短剧本生成',
      desc: '体验AI驱动的未来写作方式，提供智能建议、实时协作和适应您风格的智能格式化。'
    },
    project2: {
      title: '创意设计画布',
      desc: '利用无限画布、高级矢量工具和专为数字艺术家设计的直观控件，释放您的创造力。'
    },
    project3: {
      title: '电影级视频制作',
      desc: '使用我们具有AI增强效果的专业级视频编辑套件，将原始素材转化为电影杰作。内置智能场景识别、自动剪辑、实时特效渲染及多语言字幕生成功能，助您突破创意边界，高效产出震撼人心的视觉作品。'
    },
    common: { learnMore: '了解更多' },
    cta: {
      kicker: '工作区就绪',
      title: '开始使用 MusesAOS 构建',
      desc: '打开画布，连接生成节点，让 Agent 协助执行复杂的创作流程。',
      btn: '开始创作'
    }
  }
};

const UserNav: React.FC<{ className?: string }> = ({ className }) => {
  const { user, isAuthenticated, isLoading, signOut, checkAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [availableCredits, setAvailableCredits] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [profileName, setProfileName] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [draftName, setDraftName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [openingPackId, setOpeningPackId] = useState<'starter' | 'value' | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const profileDialogRef = useModalFocus<HTMLFormElement>(isOpen, () => setIsOpen(false));

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      getUserProfile(user.id)
        .then((profile) => {
          const nextName = profile?.display_name || '';
          const nextAvatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || '';
          setProfileName(nextName);
          setDraftName(nextName);
          setProfileAvatarUrl(nextAvatarUrl);
        })
        .catch(() => {});

      getInviteAuthHeaders()
        .then((authHeaders) => fetch('/api/invite-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ code: '', userId: user.id, action: 'check' }),
        }))
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.expires_at) setExpiresAt(data.expires_at);
        })
        .catch(() => {});

      getCreditBalance()
        .then((balance) => setAvailableCredits(balance?.available_points ?? null))
        .catch(() => setAvailableCredits(null));
    } else {
      setProfileName('');
      setProfileAvatarUrl('');
      setDraftName('');
      setAvatarFile(null);
      setAvatarPreviewUrl('');
      setProfileMessage('');
    }
  }, [isAuthenticated, user?.id, user?.user_metadata?.avatar_url]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl('');
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  useEffect(() => {
    if (!profileMessage) return;

    const timeoutId = window.setTimeout(() => {
      setProfileMessage('');
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [profileMessage]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshCredits = () => {
      getCreditBalance()
        .then((balance) => setAvailableCredits(balance?.available_points ?? null))
        .catch(() => {});
    };
    window.addEventListener('focus', refreshCredits);
    return () => window.removeEventListener('focus', refreshCredits);
  }, [isAuthenticated]);

  const getRemainingDays = () => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return '已过期';
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return `${days}天`;
  };

  const copyUserId = async () => {
    if (!user?.id) {
      setCopyStatus('error');
      return;
    }

    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(user.id);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      const textArea = document.createElement('textarea');
      textArea.value = user.id;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();

      try {
        copied = document.execCommand?.('copy') ?? false;
      } catch {
        copied = false;
      } finally {
        document.body.removeChild(textArea);
      }
    }

    setCopyStatus(copied ? 'success' : 'error');
    window.setTimeout(() => setCopyStatus('idle'), 1800);
  };

  const avatarUrl = avatarPreviewUrl || profileAvatarUrl || user?.user_metadata?.avatar_url || '';
  const displayInitial = (profileName || user?.email || 'U').trim()[0]?.toUpperCase() || 'U';

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileMessage('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage('头像不能超过 5MB');
      return;
    }

    setAvatarFile(file);
    setProfileMessage('');
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id || isSavingProfile) return;

    setIsSavingProfile(true);
    setProfileMessage('');

    try {
      const savedProfile = await updateUserProfile({
        userId: user.id,
        displayName: draftName.trim(),
        currentAvatarUrl: profileAvatarUrl,
        avatarFile,
      });

      setProfileName(savedProfile.display_name || '');
      setDraftName(savedProfile.display_name || '');
      setProfileAvatarUrl(savedProfile.avatar_url || '');
      setAvatarFile(null);
      setProfileMessage('已保存');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const openCheckout = async (packId: 'starter' | 'value') => {
    if (openingPackId) return;
    const checkoutWindow = window.open('about:blank', '_blank');
    if (!checkoutWindow) {
      setPaymentMessage('浏览器阻止了付款窗口，请允许弹出窗口后重试');
      return;
    }
    checkoutWindow.opener = null;
    setOpeningPackId(packId);
    setPaymentMessage('');

    try {
      const authHeaders = await getInviteAuthHeaders();
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ packId }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || '付款页面创建失败');
      }

      checkoutWindow.location.replace(data.checkoutUrl);
      setPaymentMessage('付款页面已在新标签页打开，支付成功后积分会自动到账');
    } catch (error) {
      checkoutWindow.close();
      setPaymentMessage(error instanceof Error ? error.message : '付款服务暂不可用');
    } finally {
      setOpeningPackId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
        >
          登录
        </Link>
        <Link
          href="/login"
          className="bg-white text-black px-5 py-2 rounded-full font-medium hover:bg-gray-100 transition-colors text-sm"
        >
          注册
        </Link>
      </div>
    );
  }

  return (
    <div className={`relative ${className || ''}`}>
      <button
        onClick={() => {
          setDraftName(profileName);
          setAvatarFile(null);
          setProfileMessage('');
          setIsOpen(true);
        }}
        className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
      >
        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-sm font-bold border border-gray-600 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt="用户头像" className="h-full w-full object-cover" />
          ) : (
            displayInitial
          )}
        </div>
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <form
            ref={profileDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
            tabIndex={-1}
            onSubmit={saveProfile}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-zinc-950/95 p-6 text-white shadow-2xl shadow-black/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="profile-dialog-title" className="text-xl font-semibold">个人资料</h2>
                <p className="mt-1 text-sm text-gray-400">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="用户头像" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold">
                    {displayInitial}
                  </div>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-gray-100 transition-colors hover:bg-white/15">
                <Camera className="h-4 w-4" />
                更换头像
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-gray-300">名称</span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={40}
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base text-white outline-none transition-colors focus:border-white/40"
              />
            </label>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-gray-300">
                <span>ID</span>
                <div className="flex items-center gap-2">
                  {copyStatus !== 'idle' && (
                    <span className={`text-xs ${copyStatus === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
                      {copyStatus === 'success' ? '已复制' : '复制失败'}
                    </span>
                  )}
                  <button
                    type="button"
                    title="复制用户ID"
                    onClick={copyUserId}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-100 transition-colors hover:bg-white/10"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-gray-300">
                <span>有效期</span>
                <span className="font-medium text-white">
                  {getRemainingDays() || '未知'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3 text-gray-300">
                <span>积分</span>
                <span className="font-medium text-white">
                  {availableCredits ?? '未知'}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-200">
                <CreditCard className="h-4 w-4" />
                充值积分
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'starter' as const, price: '$1', credits: 100 },
                  { id: 'value' as const, price: '$10', credits: 1000 },
                ]).map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    disabled={openingPackId !== null}
                    onClick={() => openCheckout(pack.id)}
                    className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-left transition-colors hover:border-emerald-300/40 hover:bg-emerald-300/10 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="flex items-center justify-between text-sm font-semibold text-white">
                      {pack.price}
                      {openingPackId === pack.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    </span>
                    <span className="mt-1 block text-xs text-emerald-300">{pack.credits} 积分</span>
                  </button>
                ))}
              </div>
              {paymentMessage && (
                <p className={`mt-2 text-xs ${paymentMessage.includes('已在新标签页') ? 'text-emerald-300' : 'text-red-300'}`}>
                  {paymentMessage}
                </p>
              )}
            </div>

            {profileMessage && (
              <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${profileMessage === '已保存' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-red-400/30 bg-red-400/10 text-red-200'}`}>
                {profileMessage}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  signOut();
                  setIsOpen(false);
                }}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10"
              >
                退出登录
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-white/10"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex min-w-20 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
                </button>
              </div>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
};

async function getInviteAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const LandingPage: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const t = translations[lang];

  const heroSection = useScrollAnimation();
  const featuredSection = useScrollAnimation();
  const ctaSection = useScrollAnimation();

  const chapters = [
    { title: t.project1.title, desc: t.project1.desc, image: '/Script.jpg', alt: 'Script Generation' },
    { title: t.project2.title, desc: t.project2.desc, image: '/Canvas.jpg', alt: 'Creative Design Canvas' },
    { title: t.project3.title, desc: t.project3.desc, image: '/Video.jpg', alt: 'Cinematic Video Production' },
  ];

  const renderProjectCard = (chapterIndex: number, extraClassName = '') => {
    const chapter = chapters[chapterIndex];

    return (
      <div className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black transition-all duration-700 ${extraClassName}`}>
        <div className="relative aspect-[16/10] md:aspect-[16/9] overflow-hidden">
          <img
            src={chapter.image}
            alt={chapter.alt}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_24%,rgba(0,0,0,0.10))]"></div>
          <div className="absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/10 pointer-events-none"></div>
        </div>
      </div>
    );
  };

  const goToPreviousChapter = () => {
    setActiveChapterIndex((current) => (current - 1 + chapters.length) % chapters.length);
  };

  const goToNextChapter = () => {
    setActiveChapterIndex((current) => (current + 1) % chapters.length);
  };

  const activeChapter = chapters[activeChapterIndex];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden relative">
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4">
        <div className="bg-black/40 backdrop-blur-md border border-gray-700/50 rounded-full px-6 py-3 flex items-center gap-8 shadow-xl">
          <div className="flex items-center space-x-2">
            <img src="/bs_logo.jpeg" alt="BS Logo" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-semibold hidden sm:inline">MusesSystem</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t.nav.home}</a>
            <Link href="/canvas" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
              {t.nav.canvas}
            </Link>
            <Link href="/projects" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t.nav.works}</Link>
            <Link href="/timeline" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t.nav.timeline}</Link>

            <button
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors text-sm font-medium"
            >
              <Globe className="w-4 h-4" />
              <span>{lang === 'en' ? 'CN' : 'EN'}</span>
            </button>
          </nav>

          <UserNav className="ml-auto" />
        </div>
      </header>

      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-screen">
        <div className="absolute inset-0 w-full h-full">
          <ColorBends
            colors={["#10b981", "#ff5c7a", "#3b82f6"]}
            rotation={0}
            speed={0.2}
            scale={1}
            frequency={1}
            warpStrength={1}
            mouseInfluence={1}
            parallax={0.5}
            noise={0.1}
            transparent={false}
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-black/30 to-black pointer-events-none z-[1]"></div>
        <div className="absolute inset-x-0 bottom-[-2rem] h-48 bg-[radial-gradient(ellipse_at_62%_0%,rgba(234,243,255,0.26),transparent_34%),radial-gradient(ellipse_at_70%_10%,rgba(196,171,255,0.24),transparent_28%),radial-gradient(ellipse_at_55%_20%,rgba(132,255,221,0.16),transparent_32%)] blur-2xl pointer-events-none z-[1]"></div>

        <div className="max-w-7xl mx-auto relative z-10 min-h-[calc(100vh-8rem)] flex items-end pb-8" ref={heroSection.ref}>
          <div>
            <div className={`inline-flex items-center space-x-2 bg-gray-900 rounded-full px-4 py-2 mb-8 animate-on-scroll animate-fade-up ${heroSection.isVisible ? 'animated' : ''}`}>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-300">{t.hero.badge}</span>
            </div>

            <h1 className={`text-5xl md:text-7xl font-medium mb-6 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent animate-on-scroll animate-fade-up delay-100 ${heroSection.isVisible ? 'animated' : ''}`}>
              {t.hero.title}
            </h1>

            <p className={`text-xl text-gray-400 max-w-3xl mb-12 leading-relaxed animate-on-scroll animate-fade-up delay-200 ${heroSection.isVisible ? 'animated' : ''}`}>
              {t.hero.desc}
            </p>

          </div>
        </div>
      </section>

      <div className="relative -mt-24 pt-24">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-transparent via-black/50 to-black pointer-events-none z-[1]"></div>
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.26),transparent_32%),radial-gradient(ellipse_at_62%_8%,rgba(194,175,255,0.24),transparent_28%),radial-gradient(ellipse_at_44%_12%,rgba(106,235,255,0.14),transparent_30%)] blur-3xl opacity-90 pointer-events-none z-[1]"></div>
        <div className="absolute left-1/2 top-4 h-28 w-[min(64rem,82vw)] -translate-x-1/2 rounded-full bg-white/12 blur-3xl opacity-60 pointer-events-none z-[1]"></div>
        <div className="absolute left-1/2 top-16 h-px w-[min(58rem,76vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-70 pointer-events-none z-[1]"></div>
        <div className="absolute left-[58%] top-6 h-40 w-40 rounded-full bg-violet-200/12 blur-[90px] pointer-events-none z-[1]"></div>
        <div className="absolute left-[42%] top-10 h-32 w-32 rounded-full bg-cyan-200/10 blur-[84px] pointer-events-none z-[1]"></div>
        <div className="absolute inset-0 w-full h-full z-0">
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

        <section className="relative z-10 pt-20 pb-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16" ref={featuredSection.ref}>
              <h2 className={`text-4xl md:text-5xl font-medium mb-4 animate-on-scroll animate-fade-up ${featuredSection.isVisible ? 'animated' : ''}`}>{t.featured.title}</h2>
              <p className={`text-xl text-gray-400 max-w-3xl mx-auto animate-on-scroll animate-fade-up delay-100 ${featuredSection.isVisible ? 'animated' : ''}`}>
                {t.featured.desc}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 sm:p-7 lg:p-9 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(87,255,183,0.10),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(132,180,255,0.13),transparent_24%)]"></div>

              <article className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-12 lg:items-center">
                <div className="max-w-xl">
                  <p className="text-xs tracking-[0.28em] uppercase text-gray-500 mb-5">
                    {`Chapter 0${activeChapterIndex + 1}`}
                  </p>
                  <h3 className="text-3xl md:text-5xl font-medium text-white mb-5">
                    {activeChapter.title}
                  </h3>
                  <p className="text-lg md:text-xl text-gray-400 leading-relaxed mb-8">
                    {activeChapter.desc}
                  </p>
                  <Link href="/canvas" className="flex items-center space-x-2 text-white hover:text-green-400 transition-colors">
                    <span>{t.common.learnMore}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="relative">
                  {renderProjectCard(activeChapterIndex, 'shadow-[0_30px_80px_rgba(0,0,0,0.35)]')}
                </div>
              </article>

              <div className="relative z-10 mt-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {chapters.map((chapter, index) => (
                    <button
                      key={chapter.title}
                      type="button"
                      aria-label={`Chapter 0${index + 1}`}
                      onClick={() => setActiveChapterIndex(index)}
                      className={`h-2.5 rounded-full transition-all ${
                        index === activeChapterIndex ? 'w-9 bg-white' : 'w-2.5 bg-white/25 hover:bg-white/45'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Previous chapter"
                    onClick={goToPreviousChapter}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white hover:text-black"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next chapter"
                    onClick={goToNextChapter}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white text-black transition-colors hover:bg-green-300"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 pt-14 pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div
              ref={ctaSection.ref}
              className={`relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#07111f] px-7 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-16 animate-on-scroll animate-fade-up ${ctaSection.isVisible ? 'animated' : ''}`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(108,240,255,0.18),transparent_26%),radial-gradient(circle_at_82%_20%,rgba(177,146,255,0.22),transparent_24%),radial-gradient(circle_at_58%_82%,rgba(87,255,183,0.10),transparent_28%),linear-gradient(135deg,rgba(7,17,31,0.96),rgba(10,24,38,0.90)_55%,rgba(8,20,30,0.96))]"></div>
              <div className="absolute inset-x-[8%] top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
              <div className="absolute -left-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full border border-cyan-300/15"></div>
              <div className="absolute -left-10 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full border border-cyan-200/10"></div>
              <div className="absolute right-[-5rem] top-[-4rem] h-52 w-52 rounded-full bg-violet-300/10 blur-3xl"></div>
              <div className="absolute left-[36%] bottom-[-6rem] h-40 w-72 rounded-full bg-cyan-200/10 blur-3xl"></div>

              <div className="relative z-10 grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-end">
                <div className="max-w-4xl">
                  <p className="text-xs tracking-[0.36em] uppercase text-cyan-100/65 mb-5">
                    {t.cta.kicker}
                  </p>
                  <h2 className="text-[clamp(3rem,7vw,6.5rem)] leading-[0.92] font-medium text-white text-balance">
                    {t.cta.title}
                  </h2>
                </div>

                <div className="lg:justify-self-end">
                  <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-6 sm:p-7">
                    <p className="text-lg sm:text-xl text-gray-300 leading-relaxed mb-8">
                      {t.cta.desc}
                    </p>
                    <Link
                      href="/canvas"
                      className="inline-flex items-center gap-3 rounded-full bg-white text-black px-7 py-4 font-semibold text-base sm:text-lg transition-all hover:bg-cyan-50 hover:shadow-[0_0_40px_rgba(255,255,255,0.18)]"
                    >
                      <span>{t.cta.btn}</span>
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="relative z-10 border-t border-white/10 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 MusesSystem. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/terms" className="transition-colors hover:text-white">
                服务条款
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-white">
                隐私条款
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
