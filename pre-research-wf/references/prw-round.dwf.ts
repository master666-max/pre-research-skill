/*
zcode-workflow args:
  - theme: string (required) 预调研主题一句话
  - round: number (required) 轮次 k（1 起）
  - workdir: string (required) 产物目录（工作区相对路径，如 prw-试车/m1）
  - axisPath: string (required) 轴件 json（工作区相对）
  - panelPath: string (required) 配额表/面板 spec json（工作区相对）
*/
// =====================================================================
// prw-round · 螺旋四站法单轮引擎（一轮 = 一个 run）· v6（可测试性重构+失配标注+注意力补丁+矿脉学科：
//   失速判定/配额验收/回炉合并抽为纯函数 judgeStall/auditQuota/mergeRebake，
//   ⑥红队触发⑦LIMITED 可 EvalWorkflowSnippet 谓词级直测；行为逐字节等价）
// 法学唯一事实源 = ~/.zcode/skills/pre-research/（v1.4.0+，子代理按路径自取）
// 原则：脚本管数字（配额/计票/收窄/棘轮/未竟差额全部确定性代码），子代理管检索判读写作
// =====================================================================

// ---------- args 窄化 ----------
const theme = String(args.theme);
const round = Number(args.round);
const workdir = String(args.workdir).replace(/\/+$/, "");
const axisPath = String(args.axisPath);
const panelPath = String(args.panelPath);
const maxRound = args.maxRound === undefined ? 3 : Number(args.maxRound);
const prevPoolPath = args.prevPoolPath === undefined ? "" : String(args.prevPoolPath);
const prevStall = args.prevStall === true;
const forceWrapUp = args.forceWrapUp === true;
const skillRef = "C:/Users/26672/.zcode/skills/pre-research/references/methodology.md";
const HONESTY = "若判据不可满足或指令互相矛盾：escalation 明说，禁硬编凑数。";

// ---------- 类型契约 ----------
interface Axis {
  id: string;
  name: string;
  /** 一句话同构问题 */
  isomorphicProblem: string;
  /** 关键断裂点 */
  breachPoint: string;
}
interface Nomination {
  /** 被提名的学科/子域/实建系统 */
  discipline: string;
  /** 一句话同构钩子 */
  hook: string;
  /** 一手锚（作者·年份·题名·出处） */
  anchor: string;
  /** 挂轴 id */
  axisId: string;
  /** 证据形态 */
  kind: "文献" | "田野";
  /** 深掘标记（v1.6.0 候款）：该学科近原生同构值得专项五维发掘时置 true，入矿脉识别门 */
  excavate?: boolean;
}
interface Mechanism {
  /** 机制名 */
  name: string;
  /** 同构钩子：该机制解决什么同构问题（须写关系结构：在 X 约束下对 Y 负责，禁学科名词/纯效果） */
  hook: string;
  /** 机制要点 2-3 句（含源域支撑网一句：该机制在原生域靠什么成立） */
  points: string;
  /** 一手锚：作者·年份·题名·出处 */
  anchor: string;
  /** 锚核实状态：核到=verified；核不到=unverified 且 points 尾注一句疑点 */
  anchorStatus: "verified" | "unverified";
  /** 引擎咬合面候选 */
  biteFace: string;
  /** 失配标注（v1.5.0 强制）：原生域前提 vs 本域现状：缺什么支撑/多什么干扰；预期断裂形态一句。真寻不得填「未寻得失配」并降半票 */
  mismatch: string;
  /** 可实验性初判 */
  experimentability: string;
  /** 挂轴 id */
  axisId: string;
  /** 证据形态 */
  kind: "文献" | "田野";
}
interface DiscBatch {
  /** 学科名（须与配额表逐字一致） */
  discipline: string;
  /** 机制条目，数量必须 ≥ 配额 */
  mechanisms: Mechanism[];
}
interface MechanismBatch {
  /** 区划名（须与配额表逐字一致） */
  district: string;
  /** 本区各学科条目 */
  entries: DiscBatch[];
  /** 涌现提名（可为空数组，禁杜撰凑数） */
  nominates: Nomination[];
  /** 自报合规计数（v1.5.1 强制；引擎对账实数，不符登记不采信——自报即注意力自检） */
  selfCheck: { total: number; anchorsVerified: number; mismatchFilled: number; nominations: number };
}
interface QuotaDiscipline { name: string; entryQuota: number; /** 席别标注（v1.6.0 可选；导线转换上轮矿脉席时填「矿脉」，站3 触发五维深读保证位） */ tier?: string; }
interface QuotaDistrict { district: string; disciplines: QuotaDiscipline[]; }
interface PanelSpec {
  round: number;
  districts: QuotaDistrict[];
  ratchets: { recency: string; depth: string; expQuota: number };
}
interface ConvPath { kind: "文献" | "田野" | "提名"; source: string; grade: string; mismatch?: string; }
interface ConvRow {
  axisId: string; problem: string; paths: ConvPath[]; pathCount: number;
  status: "候选" | "结构必需";
}
interface Prereg {
  hypothesis: string; criteria: string; sandboxPath: string;
  threeStateRule: string; killCriteria: string; budget: string; preregPath: string;
}
interface ExpReceipt {
  id: string; discipline: string; problem: string;
  preregPath: string; receiptPath: string;
  state: "咬合" | "不咬合" | "登记盲区";
  killCriteriaMet: boolean; blindSpotProblem?: string;
}
interface DeepDive { axisId: string; refinedDisciplines: string[]; note: string; }
interface AnchorVerdict { anchor: string; verdict: "confirmed" | "notFound" | "unclear"; note: string; }
interface PanelEntry { name: string; axisIds: string[]; tier: "正式" | "观察" | "野卡" | "矿脉"; origin: string; }
/** 矿脉候选（v1.6.0）：近原生同构学科的专项五维发掘（法学 SKILL §四/§10；不计收敛路/不占 A·B/不占探索税） */
interface MineCandidate { discipline: string; trigger: string; axisIds: string[]; }
/** 上轮提名池台账行（pool-C<k-1>.jsonl） */
interface PoolCarry {
  round: number; source_district: string; discipline: string; hook: string; anchor: string;
  axisId: string; kind: string; status: string;
  paths?: number; lastSeenRound?: number; lastSeatedRound?: number;
}
/** 本轮统一提名池行（carry 合并后） */
interface PoolRow {
  discipline: string; hook: string; anchor: string; axisId: string; kind: "文献" | "田野";
  sourceDistrict: string; carriedFrom: number | null; cumPaths: number; score: number;
}
interface QuotaRow {
  district: string; discipline: string; quota: number; delivered: number;
  verifiedAnchors: number; unverifiedAnchors: number; limited: boolean;
}
interface LockSpec {
  round: number; theme: string;
  panel: PanelEntry[];
  conv: ConvRow[];
  ratchets: { recency: string; depth: string; expQuota: number };
  quotaLedger: QuotaRow[];
  pool: { nominated: number; promoted: number; observing: number; stayed: number; exited: { name: string; reason: string }[]; absorbed: number };
  experiments: ExpReceipt[];
  deepDives: DeepDive[];
  stallSuspected: boolean;
  saturated: boolean;
  wrapUp: boolean;
  unfinished: { item: string; gap: string; suggestion: string }[];
}
interface DraftOut { lockPath: string; poolPath: string; panelPath: string; }

// ---------- 看板预设（仪表盘：面板席态 + 轮进度；id 为编译期字面量） ----------
artifact.board("panel", { key: "name", status: "status", columns: ["足额", "缺口回炉", "限流", "正式", "观察", "野卡", "退出"], cardTitle: "name" });
artifact.metrics("round", { metrics: [{ field: "structuralRows", label: "结构必需行" }, { field: "experiments", label: "实验数" }, { field: "unfinished", label: "未竟" }] });
interface AuditOut { consistent: boolean; issues: string[]; }

// ---------- 纯逻辑（确定性， EvalWorkflowSnippet 已验） ----------
function validatePanel(p: PanelSpec): void {
  if (!p.districts || p.districts.length === 0) throw new Error("配额表校验失败：无区划");
  for (const d of p.districts) {
    if (!d.district) throw new Error("配额表校验失败：存在无名区划");
    if (!d.disciplines || d.disciplines.length === 0) throw new Error(`配额表校验失败：区划「${d.district}」无学科`);
    for (const c of d.disciplines) {
      if (!c.name) throw new Error(`配额表校验失败：区划「${d.district}」存在无名学科`);
      if (!(c.entryQuota >= 1)) throw new Error(`配额表校验失败：${d.district}/${c.name} entryQuota 非法`);
    }
  }
}
function countConv(axes: Axis[], batches: MechanismBatch[]): ConvRow[] {
  return axes.map((a) => {
    const seen = new Set<string>();
    const paths: ConvPath[] = [];
    for (const b of batches) {
      for (const e of b.entries) {
        for (const m of e.mechanisms) {
          if (m.axisId !== a.id) continue;
          const key = (m.kind === "田野" ? "田野" : "文献") + "|" + e.discipline;
          if (seen.has(key)) continue;
          seen.add(key);
          const pth: ConvPath = { kind: m.kind === "田野" ? "田野" : "文献", source: e.discipline, grade: m.anchorStatus === "verified" ? "带锚已核" : "锚未核" };
          if (m.mismatch) pth.mismatch = m.mismatch;
          paths.push(pth);
        }
      }
      for (const n of b.nominates) {
        if (n.axisId !== a.id) continue;
        const key = "提名|" + n.discipline;
        if (seen.has(key)) continue;
        seen.add(key);
        paths.push({ kind: "提名", source: n.discipline, grade: n.kind === "田野" ? "田野已实装" : "提名" });
      }
    }
    const pathCount = paths.length;
    return { axisId: a.id, problem: a.isomorphicProblem, paths, pathCount, status: (pathCount >= 3 ? "结构必需" : "候选") as ConvRow["status"] };
  });
}
function buildPool(batches: MechanismBatch[], carried: PoolCarry[]): { rows: PoolRow[]; curDisciplines: Set<string> } {
  // 同一区划（=同一份报告）的多条提名不重复计路：提名路数 = 命中区划数
  const cur = new Map<string, { nom: Nomination; districts: Set<string> }>();
  const curDisciplines = new Set<string>();
  for (const b of batches) {
    for (const n of b.nominates) {
      curDisciplines.add(n.discipline);
      const v = cur.get(n.discipline);
      if (v) v.districts.add(b.district);
      else cur.set(n.discipline, { nom: n, districts: new Set([b.district]) });
    }
  }
  const rows = new Map<string, PoolRow>();
  for (const c of carried) {
    const prevPaths = typeof c.paths === "number" && c.paths >= 1 ? c.paths : 1;
    rows.set(c.discipline, {
      discipline: c.discipline, hook: c.hook, anchor: c.anchor, axisId: c.axisId,
      kind: (c.kind === "田野" ? "田野" : "文献") as PoolRow["kind"],
      sourceDistrict: c.source_district, carriedFrom: c.round, cumPaths: prevPaths, score: 0,
    });
  }
  for (const [disc, v] of cur) {
    const ex = rows.get(disc);
    if (ex) ex.cumPaths += v.districts.size;
    else rows.set(disc, {
      discipline: disc, hook: v.nom.hook, anchor: v.nom.anchor, axisId: v.nom.axisId,
      kind: v.nom.kind, sourceDistrict: [...v.districts][0] ?? "", carriedFrom: null,
      cumPaths: v.districts.size, score: 0,
    });
  }
  const arr = [...rows.values()];
  for (const r of arr) {
    const anchorOk = r.anchor && r.anchor.length > 6 && !r.anchor.includes("未核");
    const base = r.kind === "田野" ? 3 : anchorOk ? 2 : 1;
    r.score = base * 100 + r.cumPaths * 10 + (r.carriedFrom !== null ? 5 : 0);
  }
  return { rows: arr.sort((x, y) => y.score - x.score), curDisciplines };
}
const RECENCY = ["不限年代", "≥2005", "≥2018", "≥2024"];
const DEPTH = ["摘要级", "全文精读", "方法论级", "边缘扫尾"];
const QUOTA = [5, 3, 2, 1];
function nextRatchets(round: number) {
  // 轮 k 的下一轮 = 梯子第 k+1 档（0 基第 k 档），封顶第 4 档；末档后持平合法
  // （pre-research v1.4.0 法学声明：档位序有限封顶，续轮不造新维——委托方裁决 2026-10-05 B2）
  const i = Math.min(round, 3);
  return { recency: RECENCY[i], depth: DEPTH[i], expQuota: QUOTA[i] };
}

// ---------- 矿脉识别门（v1.6.0；法学 SKILL §四/§10——不计收敛路/不占 A·B/不占探索税） ----------
function mineCandidates(conv: ConvRow[], batches: MechanismBatch[], limitedRows: QuotaRow[]): MineCandidate[] {
  const limitedNames = new Set(limitedRows.map((r) => r.discipline));
  const axesHit = new Map<string, Set<string>>();
  for (const r of conv) for (const p of r.paths) {
    if (!axesHit.has(p.source)) axesHit.set(p.source, new Set());
    axesHit.get(p.source)!.add(r.axisId);
  }
  const mechsOf = new Map<string, Mechanism[]>();
  for (const b of batches) for (const e of b.entries) {
    if (!mechsOf.has(e.discipline)) mechsOf.set(e.discipline, []);
    mechsOf.get(e.discipline)!.push(...e.mechanisms);
  }
  const out = new Map<string, MineCandidate>();
  const add = (disc: string, trigger: string, axisIds: string[]) => {
    if (limitedNames.has(disc)) return;
    if (out.has(disc)) { out.get(disc)!.trigger += "＋" + trigger; return; }
    out.set(disc, { discipline: disc, trigger, axisIds });
  };
  for (const [disc, ax] of axesHit) if (ax.size >= 2) add(disc, `跨≥2轴命中（${[...ax].sort().join("+")}）`, [...ax].sort());
  for (const [disc, mechs] of mechsOf) {
    if (mechs.length >= 2 && mechs.every((m) => m.mismatch === "未寻得失配")) {
      add(disc, "全条目未寻得失配（近原生同构）", [...(axesHit.get(disc) ?? [])].sort());
    }
  }
  for (const b of batches) for (const n of b.nominates) if (n.excavate === true) {
    add(n.discipline, "提名深掘标记", [...(axesHit.get(n.discipline) ?? [n.axisId])]);
  }
  return [...out.values()].sort((a, b) => a.discipline.localeCompare(b.discipline));
}

// ---------- 纯逻辑（可测试面：⑥失速判定 / ⑦配额验收与 LIMITED / 回炉合并） ----------
/** ⑥ 红队谓词（法学 §七）：两站零证伪且零新结构必需 = 失速嫌疑 */
function judgeStall(receipts: ExpReceipt[], conv: ConvRow[]): boolean {
  const falsified = receipts.filter((r) => r.state === "不咬合").length;
  const structural = conv.filter((r) => r.status === "结构必需").length;
  return falsified === 0 && structural === 0;
}
/** ⑦ 配额机械验收：逐学科对账交付/锚核状态，产出台账与缺口清单（LIMITED 数据源） */
function auditQuota(panel: PanelSpec, batches: MechanismBatch[]): { ledger: QuotaRow[]; deficits: { district: string; discipline: string; missing: number }[] } {
  const ledger: QuotaRow[] = [];
  const deficits: { district: string; discipline: string; missing: number }[] = [];
  for (const d of panel.districts) {
    const batch = batches.find((b) => b.district === d.district);
    for (const c of d.disciplines) {
      const entry = batch ? batch.entries.find((e) => e.discipline === c.name) : undefined;
      const delivered = entry ? entry.mechanisms.length : 0;
      const verifiedAnchors = entry ? entry.mechanisms.filter((m) => m.anchorStatus === "verified").length : 0;
      ledger.push({ district: d.district, discipline: c.name, quota: c.entryQuota, delivered, verifiedAnchors, unverifiedAnchors: delivered - verifiedAnchors, limited: delivered < c.entryQuota });
      if (delivered < c.entryQuota) deficits.push({ district: d.district, discipline: c.name, missing: c.entryQuota - delivered });
    }
  }
  return { ledger, deficits };
}
/** 回炉合并：把补齐批次并入主批次（原区合并/新学科追加/整区新增），返回实补条数 */
function mergeRebake(batches: MechanismBatch[], def: { district: string; discipline: string }, patch: MechanismBatch): number {
  const base = batches.find((b) => b.district === def.district);
  if (base) {
    const target = base.entries.find((e) => e.discipline === def.discipline);
    const patchEntry = patch.entries.find((e) => e.discipline === def.discipline);
    if (target && patchEntry) target.mechanisms = [...target.mechanisms, ...patchEntry.mechanisms];
    else if (patchEntry) base.entries.push(patchEntry);
    base.nominates = [...base.nominates, ...patch.nominates];
  } else {
    batches.push(patch);
  }
  return patch.entries.reduce((s, e) => s + e.mechanisms.length, 0);
}

// ---------- 站1 · 按区并行广度调研 + 配额回炉 ----------
phase("站1·按区并行广度调研与配额回炉");
const axisRaw = JSON.parse(await files.read(axisPath)) as { axes: Axis[] };
const panel = JSON.parse(await files.read(panelPath)) as PanelSpec;
const axes = axisRaw.axes;
validatePanel(panel);
if (axes.length === 0) throw new Error("轴件校验失败：无轴");
log(`立项件就绪：主题「${theme}」，第 ${round} 轮，${panel.districts.length} 区 ${panel.districts.reduce((s, d) => s + d.disciplines.length, 0)} 学科，${axes.length} 根轴`);

const batches: MechanismBatch[] = await Promise.all(
  panel.districts.map((d) =>
    agent(`调研员·${d.district}`).ask<MechanismBatch>(
      `你是预调研站1 的区划调研员，辖区划「${d.district}」。\n` +
      `【义务清单（落盘与返回前逐项自检，缺一打回）】\n` +
      `1. 先读判据文件 ${skillRef} 的 §1（机制条目模板与质量规则）——只需 §1，勿整读全文；严格按其执行。\n` +
      `2. 每条机制挂轴（axisId；轴件在 ${axisPath}，用读文件工具读）；同构钩子写关系结构（该机制在 X 约束下对 Y 负责，禁学科名词、禁纯效果句）。\n` +
      `3. 一手亲取核锚（作者·年份·题名·出处）；核不到 anchorStatus 填 unverified 并在 points 尾注疑点一句；禁编造 DOI/URL/年份；条目不足配额如实注明，禁凑数。\n` +
      `4. 失配标注 mismatch 必填（法学 v1.5.0）：原生域前提 vs 本域现状（缺什么支撑/多什么干扰+预期断裂形态一句）；真寻不得填「未寻得失配」（将降半票）——同构只发借用许可，失配才决定怎么借、借了哪里会坏。\n` +
      `5. 涌现提名 nominates 必填可空：本区清单外的新学科/子域/实建系统若可能解某轴同构问题即提名（discipline/hook/anchor/axisId/kind）；若该学科近原生同构（失配趋零/体系级），加 excavate=true 深掘标记（v1.6.0，入矿脉识别门）；无提名交空数组，禁杜撰。\n` +
      `6. 落盘并返回：①机制条目 Markdown 表格文件（表格+失配脚注+提名段+自检段：条目总数/锚核声明/【未核】清单/失配覆盖声明）写到 ${workdir}/entries-C${round}-${d.district}.md；②返回结构化批次，district 逐字等于「${d.district}」，selfCheck 自报计数（total/anchorsVerified/mismatchFilled/nominations——引擎将对账，谎报必登记）。\n` +
      `【上下文】研究主题：${theme}（第 ${round} 轮）。本区学科与配额：${d.disciplines.map((c) => `${c.name}（≥${c.entryQuota} 条）`).join("、")}。\n` +
      `【收尾自检】落盘与返回前，按上方 1-6 逐项核对一遍。${HONESTY}`
    )
  )
);
log(`站1 首轮回收 ${batches.length} 区`);

// 自检对账门（v1.5.1 A2）：自报计数 vs 引擎实数，不符登记不采信（实数为准）
const selfCheckIssues: string[] = [];
for (const b of batches) {
  const mechs = b.entries.flatMap((e) => e.mechanisms);
  const real = {
    total: mechs.length,
    anchorsVerified: mechs.filter((m) => m.anchorStatus === "verified").length,
    mismatchFilled: mechs.filter((m) => m.mismatch && m.mismatch.length > 0).length,
    nominations: b.nominates.length,
  };
  if (!b.selfCheck) { selfCheckIssues.push(`${b.district}: 缺 selfCheck`); continue; }
  for (const k of ["total", "anchorsVerified", "mismatchFilled", "nominations"] as const) {
    if (b.selfCheck[k] !== real[k]) selfCheckIssues.push(`${b.district}: selfCheck.${k}=${b.selfCheck[k]} ≠ 实数 ${real[k]}`);
  }
}
if (selfCheckIssues.length > 0) log(`自检对账不符 ${selfCheckIssues.length} 处（以实数为准）：${selfCheckIssues.join("；")}`);

// 配额机械验收（第一遍；auditQuota 纯函数=⑦LIMITED 数据源）
let quotaAudit = auditQuota(panel, batches);
let ledger = quotaAudit.ledger;
let deficits = quotaAudit.deficits;

// 缺口回炉（至多一次，PLAN 硬数字配额门②）
for (const def of deficits) {
  const patch = await agent(`调研员·${def.district}-回炉`).ask<MechanismBatch>(
    `你负责回炉补齐。区划「${def.district}」的学科「${def.discipline}」此前交回条目未达配额，缺 ${def.missing} 条。\n` +
    `判据文件：${skillRef} §1；轴件：${axisPath}；主题：${theme}（第 ${round} 轮）。\n` +
    `只针对缺口学科补做检索与条目，同样纪律（一手亲取/未核标注/禁凑数/提名必填可空）。返回 MechanismBatch：district 逐字等于「${def.district}」，entries 只放缺口学科。\n${HONESTY}`
  );
  const added = mergeRebake(batches, def, patch);
  log(`回炉：「${def.district}/${def.discipline}」补 ${added} 条`);
}
quotaAudit = auditQuota(panel, batches);
ledger = quotaAudit.ledger;
deficits = quotaAudit.deficits;
const limitedRows = ledger.filter((r) => r.limited);
for (const r of ledger) report({ name: `${r.district}/${r.discipline}`, status: r.limited ? "限流" : (r.delivered >= r.quota ? "足额" : "缺口回炉") }, "panel");
for (const r of limitedRows) log(`RESEARCH-FACE-LIMITED：${r.district}/${r.discipline} 配额 ${r.quota} 实收 ${r.delivered}（如实降级，禁凑数）`);
for (const b of batches) report({ district: b.district, disciplines: b.entries.length, mechanisms: b.entries.reduce((s, e) => s + e.mechanisms.length, 0), nominations: b.nominates.length });

// 锚点抽验（独立复核，≤3 条）
const sample: { anchor: string; where: string }[] = [];
for (const b of batches) {
  for (const e of b.entries) {
    if (sample.length >= 3) break;
    const m = e.mechanisms.find((x) => x.anchorStatus === "verified");
    if (m) sample.push({ anchor: m.anchor, where: `${b.district}/${e.discipline}/${m.name}` });
  }
  if (sample.length >= 3) break;
}
if (sample.length > 0) {
  const verdicts = await agent("锚点复核员").ask<AnchorVerdict[]>(
    `你是一手锚独立复核员。对下列 ${sample.length} 条锚逐条检索核实（作者/年份/题名/出处是否真实存在且相互对得上），返回逐条判定数组：anchor（逐字回抄）/verdict（confirmed|notFound|unclear）/note（一句）。只判锚真伪，不评机制内容。锚清单：${JSON.stringify(sample)}\n${HONESTY}`
  );
  for (const v of verdicts) {
    if (v.verdict !== "notFound") continue;
    for (const b of batches) for (const e of b.entries) for (const m of e.mechanisms) {
      if (m.anchor === v.anchor) { m.anchorStatus = "unverified"; log(`抽验降级：锚「${v.anchor.slice(0, 60)}」未找到 → unverified`); }
    }
  }
}
quotaAudit = auditQuota(panel, batches);
ledger = quotaAudit.ledger;
deficits = quotaAudit.deficits;

// ---------- 站2 · 小实验验证（前半配额） ----------
let conv: ConvRow[] = countConv(axes, batches);
const receipts: ExpReceipt[] = [];
async function runExperiments(rows: ConvRow[], budget: number, station: string): Promise<void> {
  if (rows.length === 0 || budget <= 0) {
    const probe = await world.run("py", ["-c", "print('empty experiment menu: 0 converged rows with >=3 paths or quota exhausted')"]);
    log(`${station} 空菜单确认（exit ${probe.exitCode}）：无 ≥3 路收敛行或配额用尽，实验合法为空`);
    return;
  }
  for (const row of rows) {
    const id = `exp-C${round}-${row.axisId}`;
    const prereg = await agent(`预注册员·${row.axisId}`).ask<Prereg>(
      `你是预注册员。针对收敛行（轴 ${row.axisId}「${row.problem}」，${row.pathCount} 路：${row.paths.map((p) => p.kind + ":" + p.source).join("、")}）设计一枚小实验的预注册件。\n` +
      `判据：${skillRef} §5/§6（只读这两节，勿整读）。六字段全必填：hypothesis（假设与判据，先锁后跑可证伪）/criteria（判据）/sandboxPath（沙盒目录 ${workdir}/sandbox/${id}/，零生产写）/threeStateRule（三态判定式：咬合/不咬合/登记盲区；判定序=kill→反噬→咬合→空转机械判）/killCriteria（何种读数即终止）/budget（单枚 ≤1 会话）/preregPath。\n` +
      `把预注册件写成 Markdown 落盘到 ${workdir}/sandbox/${id}-prereg.md。\n${HONESTY}`
    );
    if (!prereg.hypothesis || !prereg.criteria || !prereg.killCriteria) throw new Error(`预注册件字段缺失：${id}`);
    const rec = await agent(`实验员·${row.axisId}`).ask<ExpReceipt>(
      `你是实验员。用读文件工具读预注册件 ${prereg.preregPath}，按其执行一枚小实验：在沙盒目录 ${workdir}/sandbox/${id}/ 内写并运行最小验证（可用 py 脚本），零生产写，kill criteria 触发即停。\n` +
      `按预注册三态口径判定 state（咬合/不咬合/登记盲区）；登记盲区时填 blindSpotProblem。\n` +
      `回执必含**判定序四行**（法学 v1.3.0 判定序的逐步执行锚，缺一即回执不完整）：①kill=（逐条对照预锁 kill criteria 的触发判定）②反噬=（代价面读数是否命中，命中即定态）③咬合=（H 判据逐条对照结论）④空转=（排除依据一句）。\n` +
      `落盘回执到 ${workdir}/sandbox/${id}-receipt.md，返回结构化回执（id 填 ${id}，discipline 填主要贡献学科，preregPath/receiptPath 填工作区相对路径）。\n${HONESTY}`
    );
    if (!rec.receiptPath) throw new Error(`实验回执缺 receiptPath：${id}`);
    const gate = await world.run("py", ["-c", "import io;io.open(r'" + rec.receiptPath.replace(/\\/g, "/") + "', encoding='utf-8').read();print('receipt ok')"]);
    if (gate.exitCode !== 0) throw new Error(`回执文件门未过（exit ${gate.exitCode}）：${rec.receiptPath}`);
    receipts.push(rec);
    report({ id: rec.id, station, state: rec.state, killCriteriaMet: rec.killCriteriaMet });
    log(`${station} 实验 ${id} → ${rec.state}`);
  }
}
phase("站2·小实验验证");
await runExperiments(conv.filter((r) => r.status === "结构必需").slice(0, Math.ceil(panel.ratchets.expQuota / 2)), Math.ceil(panel.ratchets.expQuota / 2), "站2");

// ---------- 站3 · 深度调研（限收敛命中） ----------
phase("站3·深度调研");
const structural = conv.filter((r) => r.status === "结构必需").slice(0, 3);
const deepDives: DeepDive[] = [];
if (structural.length === 0) {
  const probe = await world.run("py", ["-c", "print('no structural axis: deep dive legally empty')"]);
  log(`站3 空清单确认（exit ${probe.exitCode}）：无结构必需轴，深度调研合法为空`);
} else {
  for (const row of structural) {
    const axis = axes.find((a) => a.id === row.axisId);
    if (!axis) continue;
    const sources = [...new Set(row.paths.map((p) => p.source))];
    const entryFiles = batches.map((b) => `${workdir}/entries-C${round}-${b.district}.md`);
    const dive = await agent(`深读员·${row.axisId}`).ask<DeepDive>(
      `你是深度调研员。轴 ${row.axisId}「${axis.isomorphicProblem}」已达结构必需（${row.pathCount} 路：${sources.join("、")}）。\n` +
      `【义务清单（落盘前逐项自检）】\n` +
      `1. 对贡献学科做全文级精读：读本区批件（${entryFiles.join("、")}，必要时自行检索原文）。\n` +
      `2. 每学科机制要点精化一轮、咬合面校准。\n` +
      `3. 失配校准（v1.5.0）：逐路写明失配处——借入机制在原生域的前提 vs 本库现状（缺什么支撑/多什么干扰/预期断裂形态），笔记单列「失配面」一节；批件标注与实读不符处如实改判。\n` +
      `4. 精读笔记落盘：${workdir}/deep-C${round}-${row.axisId}.md（文尾自检段：精读层级/【未核】清单/失配面覆盖声明）；返回 {axisId, refinedDisciplines, note}。\n` +
      `【收尾自检】落盘与返回前按 1-4 逐项核对。${HONESTY}`
    );
    deepDives.push(dive);
    report({ axisId: dive.axisId, refined: dive.refinedDisciplines.length });
  }
}

// ---------- 站3·矿脉深读保证位（v1.6.0：上轮矿脉席学科必深读，挖五维） ----------
{
  const mineDisciplines = panel.districts.flatMap((d) => d.disciplines).filter((c) => (c as { tier?: string }).tier === "矿脉").map((c) => c.name);
  const already = new Set(deepDives.flatMap((dv) => dv.refinedDisciplines));
  const entryFiles = batches.map((b) => `${workdir}/entries-C${round}-${b.district}.md`);
  for (const disc of mineDisciplines) {
    if (already.has(disc)) continue;
    const dive = await agent(`矿脉深读员·${disc}`).ask<DeepDive>(
      `你是矿脉深读员。学科「${disc}」被识别为矿脉（近原生同构，法学 v1.6.0），按**固定五维清单**挖一遍，缺一即档案不完整：\n` +
      `①机制清单全集（突破基础配额，尽量穷尽该域解此问题的机制族）②失败案例与化石（该域自己承认的失败/废弃分支——最贵的失配情报，禁只挖正面）③参数空间与定标依据（可调旋钮及标定来源）④版本演进史（机制在原生域怎么演化）⑤对比边界（与次优机制的对比及该域最终选择它的理由）。\n` +
      `底档：${entryFiles.join("、")}（读文件工具读），必要时自行检索原文；纪律照站1（一手亲取/未核标注/禁凑数）。\n` +
      `矿脉档案落盘：${workdir}/mine-C${round}-${disc}.md。返回 {axisId, refinedDisciplines, note}（axisId 填主贡献轴）。\n${HONESTY}`
    );
    deepDives.push(dive);
    log(`矿脉深读：「${disc}」五维档案落盘`);
  }
}

// ---------- 站4 · 小实验验证（剩余配额） ----------
phase("站4·小实验验证（剩余配额）");
{
  const doneIds = new Set(receipts.map((r) => r.id));
  const remaining = conv.filter((r) => r.status === "结构必需" && !doneIds.has(`exp-C${round}-${r.axisId}`));
  await runExperiments(remaining, panel.ratchets.expQuota - receipts.length, "站4");
}

// ---------- 红队轮（法学 §七：连续两站零证伪且零新结构必需 → 强制红队，仅一轮） ----------
phase("红队轮·对抗性检索与对抗性实验");
let stallSuspected = judgeStall(receipts, conv);
if (stallSuspected) {
  log(`失速确认（judgeStall：两站零证伪+零新结构必需）→ 强制红队轮（仅此一轮，不循环）`);
  const adv = await agent(`红队检索员-C${round}`).ask<MechanismBatch>(
    `你是红队对抗检索员。当前螺旋失速：两站零证伪且零新结构必需。你的任务不是补常规条目：①从「最可能证伪现有收敛结论」的角度定向检索；②从完全未被扫过的学科中找轴（轴件 ${axisPath}，用读文件工具读）的同构解；③为候选收敛行找第 3 路。返回 MechanismBatch（district 逐字填「红队-对抗检索」，纪律同站1：一手锚/未核标注/提名必填可空）。不足 3 条照实返回。\n${HONESTY}`
  );
  batches.push(adv);
  quotaAudit = auditQuota(panel, batches);
  ledger = quotaAudit.ledger;
  deficits = quotaAudit.deficits;
  const advExp = await agent(`红队实验员-C${round}`).ask<ExpReceipt>(
    `你是红队对抗实验员。对当前最强候选设计并执行一枚「证伪向」小实验：假如它不成立，最容易观测到什么？沙盒 ${workdir}/sandbox/redteam-C${round}/，零生产写，kill 即停。三态判定，落盘回执 ${workdir}/sandbox/redteam-C${round}-receipt.md，返回结构化回执（id 填 redteam-C${round}，receiptPath 工作区相对）。\n${HONESTY}`
  );
  if (advExp.receiptPath) {
    const gate = await world.run("py", ["-c", "import io;io.open(r'" + advExp.receiptPath.replace(/\\/g, "/") + "', encoding='utf-8').read();print('ok')"]);
    if (gate.exitCode !== 0) throw new Error(`红队回执门未过：${advExp.receiptPath}`);
    receipts.push(advExp);
    report({ round, id: advExp.id, station: "红队", state: advExp.state });
  }
  conv = countConv(axes, batches);
  stallSuspected = judgeStall(receipts, conv);
  log(`红队后复查：证伪 ${receipts.filter((r) => r.state === "不咬合").length}，结构必需 ${conv.filter((r) => r.status === "结构必需").length}，失速=${stallSuspected}（红队仅此一轮）`);
}

// ---------- 站5 · 确定性收窄并合成锁定件 ----------
phase("站5·确定性收窄并合成锁定件");
// A（≥3 路收敛的学科供给）∪ B（实验存活）
const aSet = new Set<string>();
for (const r of conv) if (r.status === "结构必需") for (const p of r.paths) aSet.add(p.source);
const bSet = new Set<string>(receipts.filter((r) => r.state === "咬合").map((r) => r.discipline));
const ab = [...new Set([...aSet, ...bSet])].filter((name) => !limitedRows.some((lr) => lr.discipline === name));
// 跨轮提名池：读上轮台账 → 合并本轮提名（carry 续排/转正/退出）
const carried: PoolCarry[] = [];
if (prevPoolPath) {
  const raw = await files.read(prevPoolPath);
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try { carried.push(JSON.parse(s) as PoolCarry); } catch { log(`提名池台账坏行跳过（合票容错）：${s.slice(0, 40)}`); }
  }
  log(`提名池续排：读入上轮 ${carried.length} 行（${prevPoolPath}）`);
}
const built = buildPool(batches, carried);
const promoted = built.rows.filter((r) => r.cumPaths >= 3);
const poolRestPre = built.rows.filter((r) => r.cumPaths < 3);
// 退出判据：上轮已在观察席 && 本轮零再提名 → 连续一轮零新证据；已进正式席（A/转正）的提名不重复占观察席
const exited: { name: string; reason: string }[] = [];
const absorbed: string[] = [];
const seated = new Set<string>([...ab, ...promoted.map((p) => p.discipline)]);
const poolRest: PoolRow[] = [];
for (const r of poolRestPre) {
  if (seated.has(r.discipline)) { absorbed.push(r.discipline); continue; }
  const carry = carried.find((c) => c.discipline === r.discipline);
  const wasSeated = carry ? carry.status === "观察" : false;
  if (wasSeated && !built.curDisciplines.has(r.discipline)) exited.push({ name: r.discipline, reason: "连续一轮零新证据（上轮观察席，本轮无再提名）" });
  else poolRest.push(r);
}
// C（野卡 ≥20%）：提名池排序填充 ≤2/3，其余自由探索位；pool 非空时 cSize 下限 2（修 cSize=1 提名席失活边缘）
let cSize = ab.length === 0 ? Math.min(Math.max(poolRest.length, 0), 6) : Math.max(Math.ceil(ab.length * 0.25), 1);
if (poolRest.length > 0) cSize = Math.max(cSize, 2);
if (ab.length === 0 && cSize > 6) cSize = 6;
const wildFromPool = Math.min(poolRest.length, Math.floor((cSize * 2) / 3), 6);
const panelEntries: PanelEntry[] = [];
for (const p of promoted) panelEntries.push({ name: p.discipline, axisIds: [p.axisId], tier: "正式", origin: `涌现提名·累计${p.cumPaths}路转正（免观察）` });
for (const name of ab) {
  const axisIds = conv.filter((r) => r.status === "结构必需" && r.paths.some((p) => p.source === name)).map((r) => r.axisId);
  panelEntries.push({ name, axisIds, tier: "正式", origin: aSet.has(name) ? "A·≥3路收敛供给" : "B·实验存活" });
}
for (let i = 0; i < wildFromPool; i++) {
  panelEntries.push({ name: poolRest[i].discipline, axisIds: [poolRest[i].axisId], tier: "观察", origin: `涌现提名·观察席（累计 ${poolRest[i].cumPaths} 路${poolRest[i].carriedFrom !== null ? `·C${poolRest[i].carriedFrom} 起` : ""}）` });
}
const freeSlots = Math.max(cSize - wildFromPool, 0);
for (let i = 0; i < freeSlots; i++) panelEntries.push({ name: `（自由探索位 ${i + 1}·待下轮立项补）`, axisIds: [], tier: "野卡", origin: "自由探索（≥1/3 税）" });
// 矿脉席（v1.6.0）：不计收敛路/不占 A·B/不占探索税；与 A 并存时席别并存票权不叠加（下游并席）
const mines = mineCandidates(conv, batches, limitedRows);
for (const m of mines) panelEntries.push({ name: m.discipline, axisIds: m.axisIds, tier: "矿脉", origin: `矿脉席·${m.trigger}·深读保证位（五维发掘：机制全集/失败化石/参数空间/演进史/对比边界）` });
// 未竟事项（差额机械算出；候选行带共性失配句=v1.5.0 失配避让，item/gap 数字禁改）
const unfinished: { item: string; gap: string; suggestion: string }[] = [];
for (const r of conv) if (r.status === "候选") {
  const mis = [...new Set(r.paths.map((p) => p.mismatch).filter((m) => m && m !== "未寻得失配"))];
  const sug = mis.length > 0 ? `下轮站1 定向补检+失配避让（已有路共性失配：${mis.join("；")}）` : "下轮站1 定向补检";
  unfinished.push({ item: `同构问题「${r.problem}」未收敛`, gap: `还差 ${3 - r.pathCount} 路独立命中`, suggestion: sug });
}
if (poolRest.length > wildFromPool) unfinished.push({ item: `提名池存量 ${poolRest.length - wildFromPool} 条未入观察席`, gap: "排序超额落选", suggestion: "下轮续排（留池不丢）" });
for (const e of exited) unfinished.push({ item: `观察席退出：${e.name}`, gap: e.reason, suggestion: "登记已探未收敛；后续出现新证据可重新提名入池" });
for (const pe of panelEntries) report({ name: pe.name, status: pe.tier }, "panel");
for (const e of exited) report({ name: e.name, status: "退出" }, "panel");
report({ round, structuralRows: conv.filter((r) => r.status === "结构必需").length, experiments: receipts.length, unfinished: unfinished.length }, "round");
for (const r of limitedRows) unfinished.push({ item: `${r.district}/${r.discipline} 检索面受限`, gap: `配额 ${r.quota} 实收 ${r.delivered}`, suggestion: "下轮换检索面或降级出面板" });
for (const rec of receipts) if (rec.state === "登记盲区" && rec.blindSpotProblem) unfinished.push({ item: `登记盲区：${rec.blindSpotProblem}`, gap: "实验无法判定", suggestion: "升格为下轮候选同构问题" });

const lockSpec: LockSpec = {
  round, theme,
  panel: panelEntries,
  conv,
  ratchets: nextRatchets(round),
  quotaLedger: ledger,
  pool: { nominated: built.rows.length, promoted: promoted.length, observing: wildFromPool, stayed: poolRest.length - wildFromPool, exited, absorbed: absorbed.length },
  experiments: receipts,
  deepDives,
  stallSuspected,
  saturated: prevStall && stallSuspected,
  wrapUp: forceWrapUp || (prevStall && stallSuspected) || round >= maxRound,
  unfinished,
};
const lockJson = JSON.stringify(lockSpec, null, 1);
log(`站5 确定性收窄完成：下轮面板 转正 ${promoted.length} + 正式 ${ab.length} + 观察 ${wildFromPool} + 野卡位 ${freeSlots}；退出 ${exited.length}；失速=${stallSuspected} 饱和=${lockSpec.saturated} 收卷=${lockSpec.wrapUp}；未竟 ${unfinished.length} 条`);

const drafter = agent("锁定件合成员");
const draft = await drafter.ask<DraftOut>(
  `你是锁定件合成员。下面是站5 确定性计算的 LockSpec（**权威数字，禁止改动任何数字/数量/清单/差额**——你只负责转写）：\n${lockJson}\n\n` +
  `落盘三件：①锁定件 ${workdir}/lock-C${round}.md（章节：本轮快照/收敛表/下轮面板（转正·正式·观察·野卡）/棘轮与配额/提名池快照/失速与饱和自检/未竟事项（逐条带差额与续轮建议））；②提名池台账 ${workdir}/pool-C${round}.jsonl（每提名一行 JSON：round/source_district/discipline/hook/anchor/axisId/kind/status/paths）；③下轮席位件 ${workdir}/next-panel-C${round}.json（JSON 逐字段照抄 LockSpec：{"round":${round + 1},"seats":<panel 原样>,"ratchets":<ratchets 原样>,"prevStall":<stallSuspected 原样>}，禁改）。\n` +
  `措辞临床化，禁渲染性修辞。返回 {lockPath, poolPath, panelPath}（工作区相对路径）。\n${HONESTY}`
);
const auditor = agent("锁定件审计员");
let audit = await auditor.ask<AuditOut>(
  `你是锁定件审计员。权威数字在下面的 LockSpec JSON：\n${lockJson}\n\n` +
  `用读文件工具读 ${draft.lockPath}、${draft.poolPath}、${draft.panelPath}，逐项机械核对：面板各档数量、收敛表行数与 pathCount、棘轮三值、配额账行数、未竟事项差额（=3−pathCount）、池行数、席位件 JSON 各字段与 LockSpec 一致（seats/ratchets/prevStall=stallSuspected）。返回 {consistent, issues[]}，只核对不修改。\n${HONESTY}`
);
if (!audit.consistent) {
  log(`锁定件一致性审计未过（${audit.issues.length} 处），回炉一次`);
  await drafter.ask<DraftOut>(
    `你此前合成的锁定件与权威 LockSpec 不一致，审计 issues：${JSON.stringify(audit.issues)}。逐条修正 ${draft.lockPath}、${draft.poolPath}、${draft.panelPath}（数字以 LockSpec 为准，禁再偏），返回 {lockPath, poolPath, panelPath}。\n${HONESTY}`
  );
  audit = await auditor.ask<AuditOut>(
    `复 audit：三件已按 issues 修正。重新完整核对一遍——全清单从头核（面板各档数量/收敛表行数与 pathCount/棘轮三值/配额账行数/未竟差额=3−pathCount/池行数/席位件字段），不许只查上轮 issues。返回 {consistent, issues[]}，只核对不修改。\n${HONESTY}`
  );
}
try {
  await artifact.file("lock", draft.lockPath, { title: `站5 锁定件 C${round}`, description: `${theme}·第 ${round} 轮锁定件（含未竟事项）`, primary: !lockSpec.wrapUp });
} catch (e) {
  log(`锁定件发布失败，回炉重写：${String(e)}`);
  await drafter.ask<DraftOut>(`锁定件文件 ${draft.lockPath} 缺失或不可读，请重写三件并返回 {lockPath, poolPath, panelPath}。\n${HONESTY}`);
  await artifact.file("lock", draft.lockPath, { title: `站5 锁定件 C${round}`, description: `${theme}·第 ${round} 轮锁定件（含未竟事项）`, primary: !lockSpec.wrapUp });
}

// ---------- 收卷分支（终止判据①饱和 / ②轮次上限 / ③强制） ----------
if (lockSpec.wrapUp) {
  phase("收卷·综述回顾件与落地判据件草案");
  const review = await agent("收卷合成人").ask<{ reviewPath: string }>(
    `你是收卷合成人。依据权威 LockSpec：\n${lockJson}\n\n` +
    `并通读工作区在案材料（${workdir}/ 下 entries-C${round}-*.md、deep-*.md、sandbox/ 回执，用读文件工具读），写收卷件 ${workdir}/review-C${round}.md，三节：` +
    `①综述回顾（吸收了什么/放弃了什么，逐条带出处=批件路径）；②未竟事项（照 LockSpec.unfinished 逐条转写，禁改数字）；③落地判据件草案（每件落点预注册：判据/沙盒面/kill criteria）。\n` +
    `收卷性质：saturated=${lockSpec.saturated}（连续两轮失速），round=${round}/${maxRound}，forceWrapUp=${forceWrapUp}。措辞临床化。返回 {reviewPath}。\n${HONESTY}`
  );
  await artifact.file("review", review.reviewPath, { title: `收卷件 C${round}`, description: `${theme}·综述回顾+未竟事项+落地判据件草案`, primary: true });
  log(`收卷完成：${review.reviewPath}（saturated=${lockSpec.saturated}，round=${round}/${maxRound}，force=${forceWrapUp}）`);
}

const findings: { where: string; what: string; evidence: string; status: "verified" | "unconfirmed"; severity: "low" | "medium" | "high" }[] = [];
for (const s of selfCheckIssues) findings.push({ where: "站1 自检对账门", what: `自报计数与实数不符：${s}`, evidence: "selfCheck 对账（实数为准，不采信自报）", status: "verified", severity: "low" });
for (const r of limitedRows) findings.push({ where: `${r.district}/${r.discipline}`, what: `配额未达（${r.delivered}/${r.quota}），已标 RESEARCH-FACE-LIMITED`, evidence: "配额机械验收账", status: "verified", severity: "low" });
if (!audit.consistent) findings.push({ where: draft.lockPath, what: `锁定件与 LockSpec 仍不一致（${audit.issues.length} 处）`, evidence: audit.issues.join("；"), status: "unconfirmed", severity: "high" });
if (stallSuspected) findings.push({ where: `C${round}`, what: "失速嫌疑：两站零证伪且零新结构必需", evidence: "失速自检计数", status: "verified", severity: "medium" });

return {
  conclusion: `C${round} 走完站1-站5：回收 ${batches.length} 区，收敛表 ${conv.length} 行（结构必需 ${conv.filter((r) => r.status === "结构必需").length}），实验 ${receipts.length} 枚，下轮面板 正式 ${ab.length}/观察 ${wildFromPool}/野卡位 ${freeSlots}，未竟事项 ${unfinished.length} 条。锁定件：${draft.lockPath}`,
  findings,
  verified: [
    `配额机械验收（应收 ${ledger.reduce((s, r) => s + r.quota, 0)} 条 / 实收 ${ledger.reduce((s, r) => s + r.delivered, 0)} 条）`,
    `锚点独立抽验 ${sample.length} 条`,
    "实验回执 world.run 文件门（有实验时）",
    "锁定件一致性独立审计",
  ],
  notCovered: [
    receipts.length === 0 ? "小实验：本轮无 ≥3 路收敛行，实验合法为空（判据使然，非跳过）" : "",
    "田野第六路双源摸底（M2 起接入）",
  ].filter((s) => s.length > 0),
};
