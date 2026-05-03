'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const milestones = [
  {
    date: '2026 年 0501',
    title: 'MusesSystem 0.01',
    description: 'AI 创作系统启动，整合画布、内容生成与多模态工作流。',
    yearClass: 'bg-[#dbeafe] text-[#132f64]',
    markerClass: 'bg-[#3b82f6] border-[#2563eb] text-[#dbeafe]',
    cardClass: 'hover:border-[#93c5fd] hover:shadow-[0_24px_60px_rgba(59,130,246,0.14)]',
  },
  {
    date: '2023 年 - 2025 年',
    title: '技术沉淀',
    description: '完成核心 AI 能力和产品基础设施的早期积累。',
    yearClass: 'bg-[#dcfce7] text-[#0f3f2c]',
    markerClass: 'bg-[#f8f8f6] border-[#10b981] text-[#10b981]',
    cardClass: 'hover:border-[#86efac] hover:shadow-[0_24px_60px_rgba(16,185,129,0.14)]',
  },
];

export default function TimelinePage() {
  return (
    <main className="min-h-screen bg-[#f8f8f6] text-[oklch(0.22_0.014_276)]">
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4">
        <div className="bg-zinc-950/75 backdrop-blur-md border border-white/10 rounded-full px-5 py-3 flex items-center gap-5 shadow-[0_18px_45px_rgba(34,31,43,0.18)]">
          <Link href="/" className="text-zinc-300 transition-colors hover:text-zinc-50" aria-label="返回首页">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <img src="/bs_logo.jpeg" alt="BS Logo" className="w-8 h-8 rounded-lg" />
            <span className="text-sm sm:text-base font-semibold text-zinc-50">MusesSystem</span>
          </div>
          <span className="hidden sm:block h-5 w-px bg-white/15" />
          <span className="hidden sm:block text-sm font-medium text-zinc-200">时间线</span>
        </div>
      </header>

      <section className="px-5 pb-24 pt-32 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-[#3b82f6]">Timeline</p>
            <h1 className="text-4xl font-semibold tracking-tight text-[oklch(0.15_0.018_276)] sm:text-6xl">创作系统时间线</h1>
            <p className="mt-5 text-base leading-7 text-[oklch(0.43_0.014_276)] sm:text-lg">
              从技术沉淀到多模态创作，把关键阶段整理成一条清晰的产品发展路径。
            </p>
          </div>

          <div className="relative mx-auto max-w-5xl py-6">
            <div className="absolute bottom-8 left-4 top-8 w-px bg-[repeating-linear-gradient(to_bottom,#3b82f6_0_10px,transparent_10px_18px,#10b981_18px_28px,transparent_28px_36px,#ff5c7a_36px_46px,transparent_46px_54px)] opacity-55 md:left-1/2 md:-translate-x-px" />

            <div className="space-y-12 md:space-y-0">
              {milestones.map((item, index) => {
                const isLeft = index % 2 === 0;

                return (
                  <article
                    key={`${item.date}-${item.title}`}
                    className={`relative grid min-h-40 grid-cols-[2rem_minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] md:gap-0 ${index > 0 ? 'md:-mt-2' : ''
                      }`}
                  >
                    <div
                      className={`relative z-10 col-start-1 mt-12 flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-[0_0_0_6px_rgba(248,248,246,1)] md:col-start-2 md:justify-self-center ${item.markerClass}`}
                    >
                      <span className="h-3 w-3 rounded-full bg-current opacity-70" />
                    </div>

                    <div
                      className={`col-start-2 row-start-1 ${isLeft ? 'md:col-start-1 md:mr-6 md:justify-self-end' : 'md:col-start-3 md:ml-6 md:justify-self-start'
                        }`}
                    >
                      <div className={`w-full max-w-[22rem] rounded-md border border-[oklch(0.84_0.006_260)] bg-[oklch(0.99_0.004_260)]/78 p-2 shadow-[0_1px_0_rgba(38,35,48,0.04),0_18px_45px_rgba(64,58,82,0.07)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 ${item.cardClass}`}>
                        <div className={`rounded px-5 py-4 text-lg font-bold ${item.yearClass}`}>
                          {item.date}
                        </div>
                        <div className="px-5 py-7">
                          <h2 className="text-2xl font-bold tracking-tight text-[oklch(0.17_0.018_276)]">{item.title}</h2>
                          <p className="mt-4 text-sm leading-6 text-[oklch(0.39_0.014_276)]">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
