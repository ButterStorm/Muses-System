import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '隐私条款 | MusesSystem',
  description: 'MusesSystem 隐私条款',
};

const sections = [
  {
    title: '1. 我们如何收集信息',
    body: '当你注册账号、登录、使用画布、提交提示词、上传素材、生成内容、消耗积分、调用 Agent 工作流或联系我们时，我们可能收集你主动提供的信息以及服务运行过程中产生的必要信息。',
  },
  {
    title: '2. 我们收集的信息类型',
    body: '我们可能处理账号信息、联系方式、用户 ID、头像与昵称、认证状态、积分与交易记录、项目与工作流数据、上传素材、提示词、生成结果、设备与浏览器信息、日志、错误报告和安全审计信息。',
  },
  {
    title: '3. 信息使用目的',
    body: '我们使用相关信息用于提供和维护服务、完成认证与授权、执行生成任务、保存项目历史、统计积分消耗、排查故障、提升产品体验、防范滥用、履行法律义务及与你沟通服务相关事项。',
  },
  {
    title: '4. AI 处理与第三方模型',
    body: '为完成生成、转写、分析或 Agent 执行任务，你提交的输入、上传素材及必要上下文可能会发送给第三方 AI 模型、存储、计算或基础设施服务商处理。我们会尽量仅传输完成任务所需的信息。',
  },
  {
    title: '5. Cookie 与本地存储',
    body: '我们可能使用 Cookie、本地存储或类似技术维持登录状态、保存偏好设置、提升安全性、分析服务表现并改善用户体验。你可以通过浏览器设置管理相关技术，但部分功能可能因此不可用。',
  },
  {
    title: '6. 信息共享',
    body: '我们不会出售你的个人信息。我们仅在提供服务所必需、获得你的授权、履行法律义务、保护用户和服务安全、处理业务转让或与受约束的服务提供商合作时共享必要信息。',
  },
  {
    title: '7. 数据保存',
    body: '我们会在实现本政策所述目的所需期间保存信息，或根据法律、合规、争议解决、安全审计和备份要求保存更长时间。你删除账号或项目后，相关数据可能仍会在备份或日志中保留一段合理期限。',
  },
  {
    title: '8. 数据安全',
    body: '我们采取合理的技术和组织措施保护信息安全，包括访问控制、传输保护、权限隔离和日志审计。但互联网服务无法保证绝对安全，你也应妥善保护账号凭证和敏感素材。',
  },
  {
    title: '9. 你的权利',
    body: '在适用法律允许的范围内，你可以请求访问、更正、删除、导出或限制处理你的个人信息，也可以撤回部分授权。为保障安全，我们可能需要验证你的身份后再处理相关请求。',
  },
  {
    title: '10. 政策更新',
    body: '我们可能根据产品、法律或运营变化更新本政策。更新后的政策将在本页面发布，并自发布时或页面标明的生效时间起生效。继续使用本服务即表示你了解更新内容。',
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex text-sm font-medium text-gray-400 transition-colors hover:text-white">
          返回首页
        </Link>

        <header className="mt-12 border-b border-white/10 pb-10">
          <p className="text-sm uppercase tracking-[0.32em] text-cyan-200/70">MusesSystem</p>
          <h1 className="mt-4 text-4xl font-medium tracking-tight sm:text-5xl">隐私条款</h1>
          <p className="mt-5 text-base leading-8 text-gray-400">最后更新：2026 年 6 月 14 日</p>
        </header>

        <div className="space-y-10 py-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <p className="mt-3 text-base leading-8 text-gray-300">{section.body}</p>
            </section>
          ))}

          <section>
            <h2 className="text-xl font-semibold text-white">11. 联系我们</h2>
            <p className="mt-3 text-base leading-8 text-gray-300">
              如你希望行使隐私权利，或对本隐私条款有任何疑问，请通过网站公开联系方式、项目维护方或产品支持渠道与我们联系。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
