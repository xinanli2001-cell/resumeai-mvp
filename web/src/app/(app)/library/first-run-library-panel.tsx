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
    tone: "bg-[#f2d9c8] text-[#9f2617]",
    key: "import",
  },
  {
    title: "添加第一段经历",
    description: "从一段项目、实习或工作经历开始，逐步补全你的材料库。",
    tone: "bg-[#e4f7f1] text-[#006b55]",
    key: "experience",
  },
  {
    title: "从基本信息开始",
    description: "先填写姓名、目标岗位和联系方式，建立你的求职档案。",
    tone: "bg-[#f5e4cf] text-[#6a4632]",
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
    <section className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-stretch">
        <div className="desk-slab relative overflow-hidden p-7 md:p-10">
          <div className="magazine-rule mb-7 h-1 w-32 rounded-full" />
          <h1 className="max-w-3xl text-4xl font-black leading-[1.05] text-[#1c1714] md:text-6xl">
            先铺开材料，再折向岗位
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#7a6457]">
            不需要一次填完所有内容。先把已有经历剪贴进来，ResumeAI 会把它整理成可复用素材纸，后续再根据 JD 折出对应版本。
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="border-t border-[#d6b39b] pt-4">
              <p className="text-2xl font-black text-[#c72413]">1</p>
              <p className="mt-1 text-sm font-bold text-[#1c1714]">资料平面</p>
            </div>
            <div className="border-t border-[#d6b39b] pt-4">
              <p className="text-2xl font-black text-[#008766]">2</p>
              <p className="mt-1 text-sm font-bold text-[#1c1714]">JD 折痕</p>
            </div>
            <div className="border-t border-[#d6b39b] pt-4">
              <p className="text-2xl font-black text-[#6a4632]">3</p>
              <p className="mt-1 text-sm font-bold text-[#1c1714]">简历成形</p>
            </div>
          </div>
          <div className="pointer-events-none absolute right-6 top-6 hidden rounded-full border border-[#d6b39b] px-4 py-2 text-xs font-black text-[#7a4a32] md:block">
            素材纸 01
          </div>
        </div>

        <div className="desk-slab self-stretch p-2">
          {actions.map((action, index) => (
            <button
              key={action.key}
              type="button"
              onClick={handlers[action.key]}
              className="desk-row grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 text-left transition hover:bg-[#fff8ef]"
            >
              <span className={`grid size-9 place-items-center rounded-full text-xs font-black ${action.tone}`}>{index + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-[#1c1714]">{action.title}</span>
                <span className="mt-1 block text-sm leading-5 text-[#7a6457]">{action.description}</span>
              </span>
              <span className="text-xl font-black text-[#c72413]" aria-hidden="true">→</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onSkip}
            className="magazine-button-secondary m-2 px-4 py-3 text-sm"
          >
            直接进入完整资料库
          </button>
        </div>
      </div>
    </section>
  );
}
