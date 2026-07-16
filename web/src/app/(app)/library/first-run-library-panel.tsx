type FirstRunLibraryPanelProps = {
  onImport: () => void;
  onAddExperience: () => void;
  onFillProfile: () => void;
  onSkip: () => void;
};

const actions = [
  {
    title: "粘贴已有简历",
    description: "粘贴一段已有简历或项目材料，先由 AI 整理成可编辑草稿。",
    key: "import",
  },
  {
    title: "添加第一段经历",
    description: "从一段项目、实习或工作经历开始，逐步补全你的材料库。",
    key: "experience",
  },
  {
    title: "从基本信息开始",
    description: "先填写姓名、目标岗位和联系方式，建立你的求职档案。",
    key: "profile",
  },
] as const;

export function FirstRunLibraryPanel({ onImport, onAddExperience, onFillProfile, onSkip }: FirstRunLibraryPanelProps) {
  const handlers = {
    import: onImport,
    experience: onAddExperience,
    profile: onFillProfile,
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12">
      <div className="border-y border-[#d9e4f7] py-7 md:py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#004ac6]">ResumeAI Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#0b1c30]">开始整理你的求职材料</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#52637a]">
          不需要一次填完所有内容。选择一个最顺手的入口，ResumeAI 会把它组织成后续 JD 匹配和简历改写可以直接使用的材料。
        </p>

        <div className="mt-7 grid gap-3">
          {actions.map((action, index) => (
            <button
              key={action.key}
              type="button"
              onClick={handlers[action.key]}
              className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 border border-[#d9e4f7] bg-white px-4 py-4 text-left shadow-sm transition hover:border-[#004ac6] hover:bg-[#f8faff]"
            >
              <span className="grid size-7 place-items-center bg-[#eff4ff] text-xs font-bold text-[#004ac6]">0{index + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#0b1c30]">{action.title}</span>
                <span className="mt-1 block text-sm leading-5 text-[#52637a]">{action.description}</span>
              </span>
              <span className="text-base font-semibold text-[#004ac6]" aria-hidden="true">→</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="mt-6 text-sm font-semibold text-[#52637a] underline decoration-[#b9d0ff] underline-offset-4 hover:text-[#004ac6]"
        >
          直接进入完整资料库
        </button>
      </div>
    </section>
  );
}
