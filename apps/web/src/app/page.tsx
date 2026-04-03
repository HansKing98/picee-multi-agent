"use client";

import Link from "next/link";

const demoCards = [
  {
    href: "/ai-start",
    tag: "Quick Start",
    title: "Agent Starter Demo",
    description: "体验基础 Copilot/Agent 交互流程，快速查看状态与工具调用。",
    cta: "进入 /start",
  },
  {
    href: "/ai-document-editor",
    tag: "Generative UI",
    title: "AI Document Editor",
    description: "查看 AI 文档编辑能力，包括内容生成、改写与结构化编辑体验。",
    cta: "进入 /ai-document-editor",
  },
  {
    href: "/ai-todo-confirm",
    tag: "Human in the Loop",
    title: "AI Todo Confirm",
    description: "查看 AI 待办事项确认能力，包括内容生成、改写与结构化编辑体验。",
    cta: "进入 /ai-todo-confirm",
  },
  {
    href: "/ai-long-running-task",
    tag: "Agentic Generative UI",
    title: "AI Long Running Task",
    description: "查看 AI 长任务执行能力，包括内容生成、改写与结构化编辑体验。",
    cta: "进入 /ai-long-running-task",
  },
  {
    href: "/ai-haiku-generator",
    tag: "Tool Based Generative UI",
    title: "AI Haiku Generator",
    description: "查看 AI 诗句生成能力，包括内容生成、改写与结构化编辑体验。",
    cta: "进入 /ai-haiku-generator",
  },
  {
    href: "/ai-make-your-recipe",
    tag: "Shared State",
    title: "AI Make Your Recipe",
    description: "查看 AI 烹饪助手能力，包括内容生成、改写与结构化编辑体验。",
    cta: "进入 /ai-make-your-recipe",
  },
  {
    href: "/ai-travel-multiple-agent",
    tag: "Sub Graphs Agent",
    title: "AI Travel Multiple Agent",
    description: "查看 AI 旅行助手能力，包括内容生成、改写与结构化编辑体验。",
    cta: "进入 /ai-travel-multiple-agent",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-12 h-72 w-72 rounded-full bg-indigo-500/35 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-violet-500/30 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-16 md:px-10">
        <header className="mb-12">
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/80">
            Picee Multi-Agent
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
            Demo Navigation
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
            选择一个演示页面开始体验，页面风格统一、交互清晰，适合作为项目入口。
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          {demoCards.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={`打开 ${item.href} 页面`}
              className="group cursor-pointer rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-cyan-200">
                {item.tag}
              </span>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                {item.description}
              </p>
              <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-cyan-200">
                <span>{item.cta}</span>
                <span
                  className="transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
