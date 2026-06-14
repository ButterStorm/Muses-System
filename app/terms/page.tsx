import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '服务条款 | MusesSystem',
  description: 'MusesSystem 服务条款',
};

const sections = [
  {
    title: '1. 接受条款',
    body: '欢迎使用 MusesSystem。访问或使用本网站、画布、生成工具、Agent 工作流及相关服务，即表示你已阅读、理解并同意受本服务条款约束。如果你不同意本条款，请停止使用本服务。',
  },
  {
    title: '2. 服务内容',
    body: 'MusesSystem 提供面向文本、图片、音频、音乐、视频及 Agent 任务的 AI 创作与工作流编排能力。具体功能可能会根据产品迭代、模型供应商能力、系统负载或合规要求进行调整、暂停或终止。',
  },
  {
    title: '3. 账号与安全',
    body: '你应确保注册信息真实、准确，并妥善保管账号、登录凭证和访问权限。通过你的账号发生的操作视为由你本人发起。若发现账号被未授权使用或存在安全风险，请及时停止相关操作并联系我们。',
  },
  {
    title: '4. 积分、配额与付费功能',
    body: '部分能力可能消耗积分、额度或需要付费开通。积分、额度、价格、可用模型和生成限制可能因运营策略或第三方服务成本变化而调整。除非页面另有明确说明，已消耗的积分或额度通常不予退回。',
  },
  {
    title: '5. 用户内容与生成内容',
    body: '你保留对上传、输入或提交内容依法享有的权利。你应确保拥有处理这些内容所需的合法权利。AI 生成内容可能存在不准确、不完整、相似或不适合特定用途的情况，发布、商用或依赖生成内容前，你应自行审查并承担相应责任。',
  },
  {
    title: '6. 禁止行为',
    body: '你不得使用本服务从事违法、侵权、欺诈、骚扰、恶意攻击、规避安全限制、生成或传播有害内容、侵犯他人隐私、滥用模型或干扰服务稳定性的行为。我们可根据合理判断限制、暂停或终止违规使用。',
  },
  {
    title: '7. 第三方服务',
    body: '本服务可能调用第三方模型、存储、认证、支付、分析或基础设施服务。第三方服务的可用性、输出质量、处理规则和数据保护措施可能受其自身条款约束。',
  },
  {
    title: '8. 免责声明',
    body: '在法律允许的最大范围内，本服务按“现状”和“可用”基础提供。我们不承诺服务持续无中断、完全无错误，亦不保证生成结果满足你的特定业务、法律、财务、医疗或专业用途需求。',
  },
  {
    title: '9. 责任限制',
    body: '在法律允许的最大范围内，对于因使用或无法使用本服务导致的间接、附带、特殊、惩罚性或后果性损失，我们不承担责任。若适用法律不允许完全排除责任，则责任范围以法律允许的最低限度为准。',
  },
  {
    title: '10. 条款变更',
    body: '我们可能不时更新本条款。更新后的条款将在本页面发布，并自发布时或页面标明的生效时间起生效。继续使用本服务即表示你接受更新后的条款。',
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex text-sm font-medium text-gray-400 transition-colors hover:text-white">
          返回首页
        </Link>

        <header className="mt-12 border-b border-white/10 pb-10">
          <p className="text-sm uppercase tracking-[0.32em] text-cyan-200/70">MusesSystem</p>
          <h1 className="mt-4 text-4xl font-medium tracking-tight sm:text-5xl">服务条款</h1>
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
              如你对本条款或服务使用有任何问题，请通过网站公开联系方式、项目维护方或产品支持渠道与我们联系。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
