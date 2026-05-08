'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useAuthStore } from '@/stores/authStore';
import ColorBends from '@/components/ColorBends';
import Galaxy from '@/components/Galaxy';
import { getCreditBalance } from '@/services/CreditService';

const translations = {
  en: {
    nav: { home: 'Home', canvas: 'Canvas', works: 'Works', timeline: 'Timeline', login: 'LOGIN' },
    hero: {
      badge: 'Available for Work',
      title: 'Design Your Future with Passion & Purpose',
      desc: 'Unlock your creative potential with intelligent content and design solutions tailored for clarity, impact, and high-efficiency reach. From personal branding to AI-driven visuals, I help transform your ideas into valuable and influential content.'
    },
    featured: {
      title: 'Featured Projects',
      desc: 'A curated selection of AI-driven creative projects—where algorithms, aesthetics, and experience design converge.'
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
      kicker: 'Final Act',
      title: 'Ready to Elevate Your AI Creation Experience?',
      desc: 'Take the first step toward clean, conversion-driven design that delights users and drives growth.',
      btn: 'START NOW'
    }
  },
  zh: {
    nav: { home: '首页', canvas: '画布', works: '作品', timeline: '时间线', login: '登录' },
    hero: {
      badge: '接受项目预订',
      title: '用激情与目标设计未来',
      desc: '通过为您量身定制的智能内容和设计解决方案，释放您的创造潜力，实现清晰、震撼和高效的触达。从个人品牌到AI驱动的视觉效果，我帮助将您的想法转化为有价值且具影响力的内容。'
    },
    featured: {
      title: '精选项目',
      desc: 'AI驱动的创意项目精选——算法、美学与体验设计的融合。'
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
      kicker: '终章',
      title: '准备好提升您的AI创作体验了吗？',
      desc: '迈出第一步，体验简洁、以转化为导向的设计，取悦用户并推动增长。',
      btn: '立即开始'
    }
  }
};

const UserNav: React.FC<{ className?: string }> = ({ className }) => {
  const { user, isAuthenticated, isLoading, signOut, checkAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [availableCredits, setAvailableCredits] = useState<number | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetch('/api/invite-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '', userId: user.id, action: 'check' }),
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.expires_at) setExpiresAt(data.expires_at);
        })
        .catch(() => {});

      getCreditBalance()
        .then((balance) => setAvailableCredits(balance?.available_points ?? null))
        .catch(() => setAvailableCredits(null));
    }
  }, [isAuthenticated, user?.id]);

  const getRemainingDays = () => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return '已过期';
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return `${days}天`;
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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
      >
        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-sm font-bold border border-gray-600">
          {user?.email?.[0].toUpperCase() || 'U'}
        </div>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-2 text-sm text-gray-500 flex items-center justify-between">
              <span>有效期</span>
              <span className="text-gray-800 font-medium">
                {getRemainingDays() || '未知'}
              </span>
            </div>
            <div className="px-4 py-2 text-sm text-gray-500 flex items-center justify-between">
              <span>积分</span>
              <span className="text-gray-800 font-medium">
                {availableCredits ?? '未知'}
              </span>
            </div>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const LandingPage: React.FC = () => {
  const [lang, setLang] = useState<'en' | 'zh'>('en');
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
      <div className={`bg-gray-900/95 rounded-2xl overflow-hidden transition-all duration-700 ${extraClassName}`}>
        <div className="relative aspect-[16/10] md:aspect-[16/9] overflow-hidden">
          <img
            src={chapter.image}
            alt={chapter.alt}
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/8 rounded-2xl pointer-events-none"></div>
        </div>
      </div>
    );
  };

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

            <div className="space-y-20 lg:space-y-0">
              {chapters.map((chapter, index) => (
                <article
                  key={chapter.title}
                  className="lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-12 lg:min-h-[120vh]"
                >
                  <div className="flex items-center lg:py-28">
                    <div className="max-w-xl">
                      <p className="text-xs tracking-[0.28em] uppercase text-gray-500 mb-5">
                        {`Chapter 0${index + 1}`}
                      </p>
                      <h3 className="text-3xl md:text-5xl font-medium text-white mb-5">
                        {chapter.title}
                      </h3>
                      <p className="text-lg md:text-xl text-gray-400 leading-relaxed mb-8">
                        {chapter.desc}
                      </p>
                      <button className="flex items-center space-x-2 text-white hover:text-green-400 transition-colors">
                        <span>{t.common.learnMore}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-10 lg:mt-0">
                    <div className="lg:sticky lg:top-24 lg:min-h-screen lg:flex lg:items-center">
                      <div className="w-full">
                        {renderProjectCard(index, 'shadow-[0_30px_80px_rgba(0,0,0,0.35)]')}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
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
      </div>
    </div>
  );
};

export default LandingPage;
