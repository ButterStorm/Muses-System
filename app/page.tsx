'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, Globe, User, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useAuthStore } from '@/stores/authStore';
import ColorBends from '@/components/ColorBends';
import Galaxy from '@/components/Galaxy';

const translations = {
  en: {
    nav: { home: 'Home', canvas: 'Canvas', works: 'Works', login: 'LOGIN' },
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
      title: 'Ready to Elevate Your AI Creation Experience?',
      desc: 'Take the first step toward clean, conversion-driven design that delights users and drives growth.',
      btn: 'START NOW'
    }
  },
  zh: {
    nav: { home: '首页', canvas: '画布', works: '作品', login: '登录' },
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
      title: '准备好提升您的AI创作体验了吗？',
      desc: '迈出第一步，体验简洁、以转化为导向的设计，取悦用户并推动增长。',
      btn: '立即开始'
    }
  }
};

const UserNav: React.FC = () => {
  const { user, isAuthenticated, isLoading, signOut, checkAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
          {user?.email?.[0].toUpperCase() || 'U'}
        </div>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
            <Link
              href="/canvas"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              我的画布
            </Link>
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
  const project1 = useScrollAnimation();
  const project2 = useScrollAnimation();
  const project3 = useScrollAnimation();
  const ctaSection = useScrollAnimation();

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
            <a href="#works" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">{t.nav.works}</a>

            <button
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors text-sm font-medium"
            >
              <Globe className="w-4 h-4" />
              <span>{lang === 'en' ? 'CN' : 'EN'}</span>
            </button>
          </nav>

          <UserNav />
        </div>
      </header>

      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
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

        <div className="max-w-7xl mx-auto relative z-10" ref={heroSection.ref}>
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
      </section>

      <div className="relative">
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

        <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16" ref={featuredSection.ref}>
              <h2 className={`text-4xl md:text-5xl font-medium mb-4 animate-on-scroll animate-fade-up ${featuredSection.isVisible ? 'animated' : ''}`}>{t.featured.title}</h2>
              <p className={`text-xl text-gray-400 max-w-3xl mx-auto animate-on-scroll animate-fade-up delay-100 ${featuredSection.isVisible ? 'animated' : ''}`}>
                {t.featured.desc}
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div
                ref={project1.ref}
                className={`bg-gray-900 rounded-2xl overflow-hidden group hover:bg-gray-800 transition-colors animate-on-scroll animate-fade-up ${project1.isVisible ? 'animated' : ''}`}
              >
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src="/Script.jpg"
                    alt="Script Generation"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60"></div>
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-medium mb-3">{t.project1.title}</h3>
                  <p className="text-gray-400 mb-6 leading-relaxed">
                    {t.project1.desc}
                  </p>
                  <button className="flex items-center space-x-2 text-white hover:text-green-400 transition-colors">
                    <span>{t.common.learnMore}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={project2.ref}
                className={`bg-gray-900 rounded-2xl overflow-hidden group hover:bg-gray-800 transition-colors animate-on-scroll animate-fade-up delay-100 ${project2.isVisible ? 'animated' : ''}`}
              >
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src="/Canvas.jpg"
                    alt="Creative Design Canvas"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60"></div>
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-medium mb-3">{t.project2.title}</h3>
                  <p className="text-gray-400 mb-6 leading-relaxed">
                    {t.project2.desc}
                  </p>
                  <button className="flex items-center space-x-2 text-white hover:text-green-400 transition-colors">
                    <span>{t.common.learnMore}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={project3.ref}
                className={`lg:col-span-2 bg-gray-900 rounded-2xl overflow-hidden group hover:bg-gray-800 transition-colors animate-on-scroll animate-fade-up delay-200 ${project3.isVisible ? 'animated' : ''}`}
              >
                <div className="flex flex-col lg:flex-row">
                  <div className="flex-[1.5] p-8 lg:p-12">
                    <h3 className="text-3xl font-medium mb-4">{t.project3.title}</h3>
                    <p className="text-gray-400 mb-8 leading-relaxed max-w-2xl">
                      {t.project3.desc}
                    </p>
                    <button className="flex items-center space-x-2 text-white hover:text-green-400 transition-colors">
                      <span>{t.common.learnMore}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 aspect-video lg:aspect-auto relative overflow-hidden">
                    <img
                      src="/Video.jpg"
                      alt="Cinematic Video Production"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-l from-gray-900 via-transparent to-transparent lg:bg-gradient-to-t opacity-60"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div
              ref={ctaSection.ref}
              className={`bg-gray-900 rounded-3xl p-12 relative overflow-hidden animate-on-scroll animate-fade-up ${ctaSection.isVisible ? 'animated' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-transparent to-green-500/10"></div>

              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-medium mb-6">
                  {t.cta.title}
                </h2>
                <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                  {t.cta.desc}
                </p>
                <Link
                  href="/canvas"
                  className="bg-white text-black px-8 py-4 rounded-full font-semibold hover:bg-gray-100 transition-colors text-lg inline-block"
                >
                  {t.cta.btn}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;