# -*- coding: utf-8 -*-
"""prw_core · pre-research-idle 确定性内核（站5 收窄/失速判定/配额验收/回炉合并）。

从 pre-research-wf references/prw-round.dwf.ts v4 纯逻辑段逐函数移植，语义逐条对齐：
validate_panel / count_conv / build_pool / next_ratchets / judge_stall / audit_quota / merge_rebake
+ narrow（站5 一条命令组装 LockSpec，含收窄公式 A×B×C、跨轮提名池、退出判据、未竟源、收卷分支）。
法学唯一事实源 = ~/.zcode/skills/pre-research/（v1.4.0+）。数据形态：dict 进出（JSON 原生）。

v1.7.0 增强（2026-10-08，源=C1-C3 真跑复盘；既有回执与锁定件不回判）：
  · 回执五态判读：反噬=定态负向结果，清障失速；表冲突=待重预注册裁决，不清障（judge_stall）
  · 未竟源增补四条：反噬登记/表冲突移交/矿脉未掘（需 --mined）/野卡未填（narrow）
  · audit 自带 selfCheck 门（v1.5.1 引擎对账接线；遗留批件回放用 --lenient-selfcheck）
  · version 版本哨（判据源清单 hash，快照/比对，漂移 exit 2）
  · sandboxcheck 沙盒脚本静态门（禁网模块/写越界/未声明读越界/动态路径提示/体积读数）

CLI（主会话 Bash 调用；全部文件 IO，路径即契约）：
  py -X utf8 prw_core.py narrow --axes A.json --batches "glob*.json" --receipts R.json --panel P.json
              --round K --prev-pool pool.jsonl --prev-stall 0 --max-round 3 --force-wrapup 0
              [--mined "甲|乙"]   → stdout：LockSpec JSON（pretty）
  py -X utf8 prw_core.py stall --receipts R.json --conv C.json   → true/false
  py -X utf8 prw_core.py audit --panel P.json --batches "glob" [--lenient-selfcheck]
      → {ledger, deficits, selfcheck{ok, issues}}；selfCheck 门不过 exit 2
  py -X utf8 prw_core.py conv --axes A.json --batches "glob"     → ConvRow[]
  py -X utf8 prw_core.py selfcheck --batches "glob" [--prev-pool pool.jsonl]
      → {issues, duplicates}；issues 非空 exit 2（duplicates 仅登记不判死）
  py -X utf8 prw_core.py ratchets --round K                      → {recency, depth, expQuota}
  py -X utf8 prw_core.py version --snapshot OUT.json | --check SNAP.json
      → 判据源清单 hash 快照/比对（漂移 exit 2）
  py -X utf8 prw_core.py sandboxcheck --dir D [--whitelist W.json]
      → 沙盒脚本静态门报告；errors 非空 exit 2
"""
from __future__ import annotations

import argparse
import ast
import datetime
import glob as globlib
import hashlib
import json
import math
import os
import sys
from typing import Any

# ---------- 棘轮梯子（法学 §四；末档后持平合法=pre-research v1.4.0 B2 裁决） ----------
RECENCY = ["不限年代", "≥2005", "≥2018", "≥2024"]
DEPTH = ["摘要级", "全文精读", "方法论级", "边缘扫尾"]
QUOTA = [5, 3, 2, 1]

# ---------- v1.7.0 回执定态契约（法学 §五：v1.3.0 反噬命中即定态 / v1.4.0 表冲突移交重预注册） ----------
# 五态齐备；「反噬」与「表冲突」此前游离在 schema 之外，判读面丢失（C1-C3 真跑实录）。
LAW_RECEIPT_STATES = ("咬合", "不咬合", "登记盲区", "反噬", "表冲突")
STALL_CLEARING_STATES = ("不咬合", "反噬")  # 定态负向结果＝螺旋在咬合，清障失速（表冲突待裁决/盲区不可判，不清障）

# ---------- v1.7.0 沙盒脚本静态门：禁网模块根名（保守从严，误报可入 sandboxcheck-allow.json） ----------
FORBIDDEN_MODULES = {"socket", "requests", "httpx", "aiohttp", "ftplib", "telnetlib",
                     "smtplib", "poplib", "imaplib", "xmlrpc", "websockets", "urllib",
                     "urllib3", "http", "webbrowser"}
_OS_MUTATORS = {"remove", "unlink", "rmdir", "rename", "replace", "mkdir", "makedirs",
                "chmod", "chown", "symlink", "link", "truncate"}
_SHUTIL_MUTATORS = {"rmtree", "copy", "copy2", "copyfile", "move"}
_OS_EXEC = {"system", "popen", "execv", "execvp", "spawnv", "spawnl"}


def validate_panel(p: dict) -> None:
    """配额表机械校验（硬数字门数据面；文案与 TS 版对齐）。"""
    if not p.get("districts"):
        raise ValueError("配额表校验失败：无区划")
    for d in p["districts"]:
        if not d.get("district"):
            raise ValueError("配额表校验失败：存在无名区划")
        if not d.get("disciplines"):
            raise ValueError(f"配额表校验失败：区划「{d['district']}」无学科")
        for c in d["disciplines"]:
            if not c.get("name"):
                raise ValueError(f"配额表校验失败：区划「{d['district']}」存在无名学科")
            if not (c.get("entryQuota", 0) >= 1):
                raise ValueError(f"配额表校验失败：{d['district']}/{c['name']} entryQuota 非法")


def count_conv(axes: list, batches: list) -> list:
    """收敛计票：同区划同源去重（key=kind|discipline），提名全局去重（key=提名|discipline）。"""
    out = []
    for a in axes:
        seen: set[str] = set()
        paths: list[dict] = []
        for b in batches:
            for e in b.get("entries", []):
                for m in e.get("mechanisms", []):
                    if m.get("axisId") != a["id"]:
                        continue
                    kind = "田野" if m.get("kind") == "田野" else "文献"
                    key = kind + "|" + e["discipline"]
                    if key in seen:
                        continue
                    seen.add(key)
                    pth = {"kind": kind, "source": e["discipline"],
                           "grade": "带锚已核" if m.get("anchorStatus") == "verified" else "锚未核"}
                    if m.get("mismatch"):
                        pth["mismatch"] = m["mismatch"]
                    paths.append(pth)
            for n in b.get("nominates", []):
                if n.get("axisId") != a["id"]:
                    continue
                key = "提名|" + n["discipline"]
                if key in seen:
                    continue
                seen.add(key)
                paths.append({"kind": "提名", "source": n["discipline"],
                              "grade": "田野已实装" if n.get("kind") == "田野" else "提名"})
        pc = len(paths)
        out.append({"axisId": a["id"], "problem": a["isomorphicProblem"], "paths": paths, "pathCount": pc,
                    "status": "结构必需" if pc >= 3 else "候选"})
    return out


def build_pool(batches: list, carried: list) -> dict:
    """统一提名池：carry 合并 + 本轮提名（跨区计路）+ 预注册排序键评分降序。

    score = base*100 + cumPaths*10 + (carried?5:0)；base = 田野 3 / 锚好 2 / 其他 1。
    anchorOk = len(anchor)>6 且不含「未核」（与 TS 版字面一致）。
    """
    cur: dict[str, dict] = {}
    cur_disciplines: set[str] = set()
    for b in batches:
        for n in b.get("nominates", []):
            cur_disciplines.add(n["discipline"])
            v = cur.get(n["discipline"])
            if v:
                v["districts"].add(b["district"])
            else:
                cur[n["discipline"]] = {"nom": n, "districts": {b["district"]}}
    rows: dict[str, dict] = {}
    for c in carried:
        prev_paths = c["paths"] if isinstance(c.get("paths"), int) and c.get("paths", 0) >= 1 else 1
        rows[c["discipline"]] = {
            "discipline": c["discipline"], "hook": c["hook"], "anchor": c["anchor"], "axisId": c["axisId"],
            "kind": "田野" if c.get("kind") == "田野" else "文献", "sourceDistrict": c["source_district"],
            "carriedFrom": c["round"], "cumPaths": prev_paths, "score": 0,
        }
    for disc, v in cur.items():
        if disc in rows:
            rows[disc]["cumPaths"] += len(v["districts"])
        else:
            n = v["nom"]
            rows[disc] = {"discipline": disc, "hook": n["hook"], "anchor": n["anchor"], "axisId": n["axisId"],
                          "kind": "田野" if n.get("kind") == "田野" else "文献",
                          "sourceDistrict": sorted(v["districts"])[0] if v["districts"] else "",
                          "carriedFrom": None, "cumPaths": len(v["districts"]), "score": 0}
    arr = list(rows.values())  # dict 保插入序：carry 行先、新提名后（对齐 TS Map 语义）
    for r in arr:
        anchor_ok = bool(r["anchor"]) and len(r["anchor"]) > 6 and ("未核" not in r["anchor"])
        base = 3 if r["kind"] == "田野" else (2 if anchor_ok else 1)
        r["score"] = base * 100 + r["cumPaths"] * 10 + (5 if r["carriedFrom"] is not None else 0)
    arr.sort(key=lambda r: -r["score"])  # 稳定排序，同分保持插入序（对齐 TS）
    return {"rows": arr, "curDisciplines": sorted(cur_disciplines)}


def next_ratchets(round_: int) -> dict:
    """棘轮梯子：轮 k 的下一轮 = 第 k+1 档（0 基第 k 档），封顶第 4 档；末档后持平合法（B2）。"""
    i = min(round_, 3)
    return {"recency": RECENCY[i], "depth": DEPTH[i], "expQuota": QUOTA[i]}


def judge_stall(receipts: list, conv: list) -> bool:
    """⑥ 红队谓词（法学 §七）：两站零证伪且零新结构必需 = 失速嫌疑。

    v1.7.0：清障集=STALL_CLEARING_STATES（不咬合+反噬）——反噬是定态负向结果
    （v1.3.0「反噬命中即定态」），是有效发现而非失速；「表冲突」待重预注册裁决、
    「登记盲区」不可判定，二者不清障（维持原语义，仅收编反噬）。
    """
    falsified = sum(1 for r in receipts if r.get("state") in STALL_CLEARING_STATES)
    structural = sum(1 for r in conv if r.get("status") == "结构必需")
    return falsified == 0 and structural == 0


def audit_quota(panel: dict, batches: list) -> dict:
    """⑦ 配额机械验收：逐学科对账，产出台账（LIMITED 标记）与缺口清单。"""
    ledger: list[dict] = []
    deficits: list[dict] = []
    for d in panel["districts"]:
        batch = next((b for b in batches if b.get("district") == d["district"]), None)
        for c in d["disciplines"]:
            entry = next((e for e in batch["entries"] if e["discipline"] == c["name"]), None) if batch else None
            delivered = len(entry["mechanisms"]) if entry else 0
            verified = sum(1 for m in entry["mechanisms"] if m.get("anchorStatus") == "verified") if entry else 0
            ledger.append({"district": d["district"], "discipline": c["name"], "quota": c["entryQuota"],
                           "delivered": delivered, "verifiedAnchors": verified,
                           "unverifiedAnchors": delivered - verified, "limited": delivered < c["entryQuota"]})
            if delivered < c["entryQuota"]:
                deficits.append({"district": d["district"], "discipline": c["name"], "missing": c["entryQuota"] - delivered})
    return {"ledger": ledger, "deficits": deficits}


def merge_rebake(batches: list, def_: dict, patch: dict) -> int:
    """回炉合并：原区合并 / 缺学科追加 / 整区新增；提名随补并账。返回实补条数。"""
    base = next((b for b in batches if b.get("district") == def_["district"]), None)
    if base:
        target = next((e for e in base["entries"] if e["discipline"] == def_["discipline"]), None)
        patch_entry = next((e for e in patch.get("entries", []) if e["discipline"] == def_["discipline"]), None)
        if target and patch_entry:
            target["mechanisms"] = [*target["mechanisms"], *patch_entry["mechanisms"]]
        elif patch_entry:
            base["entries"].append(patch_entry)
        base["nominates"] = [*base.get("nominates", []), *patch.get("nominates", [])]
    else:
        batches.append(patch)
    return sum(len(e["mechanisms"]) for e in patch.get("entries", []))


def selfcheck_audit(batches: list) -> list:
    """v1.5.1 A2 自检对账门：子代理自报合规计数 vs 引擎实数，逐处不符登记（实数为准，不采信自报）。

    selfCheck = {total, anchorsVerified, mismatchFilled, nominations}；缺 selfCheck 整批登记；
    mismatch 空串算未填（谎报 mismatchFilled 即被逮）。
    """
    issues: list[str] = []
    for b in batches:
        mechs = [m for e in b.get("entries", []) for m in e.get("mechanisms", [])]
        real = {
            "total": len(mechs),
            "anchorsVerified": sum(1 for m in mechs if m.get("anchorStatus") == "verified"),
            "mismatchFilled": sum(1 for m in mechs if m.get("mismatch")),
            "nominations": len(b.get("nominates", [])),
        }
        sc = b.get("selfCheck")
        district = b.get("district", "?")
        if not isinstance(sc, dict):
            issues.append(f"{district}: 缺 selfCheck")
            continue
        for k, rv in real.items():
            if sc.get(k) != rv:
                issues.append(f"{district}: selfCheck.{k}={sc.get(k)} ≠ 实数 {rv}")
    return issues


def selfcheck_duplicates(batches: list, carried: list) -> list:
    """v1.7.0 重复提名提示（携带约定未定，仅登记不判死——两级门精神）。

    本轮提名与上轮台账 discipline+hook+anchor 逐字相同 ⇒ 疑似机械携带（无新证据），
    用于续轮核查「继承批件 nominates 置空」约定是否被遵守；不计入 issues、不影响退出码。
    """
    out: list[str] = []
    prev = {c["discipline"]: (c.get("hook", ""), c.get("anchor", "")) for c in carried}
    for b in batches:
        for n in b.get("nominates", []):
            d = n["discipline"]
            if d in prev and (n.get("hook", ""), n.get("anchor", "")) == prev[d]:
                out.append(f"{b.get('district', '?')}: 重复提名（与上轮台账逐字相同，疑似机械携带无新证据）：{d}")
    return out


# ---------- v1.7.0 版本哨：判据源清单 hash 快照/比对 ----------

def _version_targets() -> dict:
    """判据源清单（相对本文件位置推导；跨文件升级（法学/内核/测试）一网打尽）。"""
    base = os.path.dirname(os.path.abspath(__file__))
    return {
        "prw_core.py": os.path.join(base, "prw_core.py"),
        "test_prw_core.py": os.path.join(base, "test_prw_core.py"),
        "idle-SKILL.md": os.path.normpath(os.path.join(base, "..", "SKILL.md")),
        "pre-research-SKILL.md": os.path.normpath(os.path.join(base, "..", "..", "pre-research", "SKILL.md")),
        "methodology.md": os.path.normpath(os.path.join(base, "..", "..", "pre-research", "references", "methodology.md")),
    }


def version_snapshot() -> dict:
    """版本快照：五件判据源文件 sha256+size+mtime（步 0 落盘，站 5 前 --check 比对）。"""
    files: dict[str, dict] = {}
    for name, p in _version_targets().items():
        if os.path.isfile(p):
            with open(p, "rb") as fh:
                data = fh.read()
            st = os.stat(p)
            files[name] = {"path": p, "sha256": hashlib.sha256(data).hexdigest(),
                           "size": st.st_size, "mtime": int(st.st_mtime)}
    return {"when": datetime.datetime.now().isoformat(timespec="seconds"), "files": files}


def version_check(snap: dict) -> list:
    """版本比对：逐件 sha256 对账，返回漂移清单（缺失/变更）；空=零漂移。"""
    drifts: list[dict] = []
    for name, rec in (snap.get("files") or {}).items():
        p = rec.get("path")
        if not p or not os.path.isfile(p):
            drifts.append({"file": name, "kind": "缺失", "detail": p or ""})
            continue
        with open(p, "rb") as fh:
            data = fh.read()
        h = hashlib.sha256(data).hexdigest()
        if h != rec.get("sha256"):
            drifts.append({"file": name, "kind": "变更",
                           "detail": f"sha256 {str(rec.get('sha256', ''))[:12]}→{h[:12]}"})
    return drifts


# ---------- v1.7.0 沙盒脚本静态门：输入面封闭核查（零生产写/禁网/AST 路径白名单） ----------

def _is_open_call(func: ast.expr) -> bool:
    if isinstance(func, ast.Name) and func.id == "open":
        return True
    if isinstance(func, ast.Attribute) and func.attr == "open":
        return True  # io.open / Path(...).open 等，保守纳入
    return False


def _mutator_kind(func: ast.expr) -> str | None:
    """文件系统变更/执行类调用识别（os.remove/shutil.rmtree/os.system…）→ 类型标签或 None。"""
    if not isinstance(func, ast.Attribute) or not isinstance(func.value, ast.Name):
        return None
    mod, attr = func.value.id, func.attr
    if mod == "os" and attr in _OS_MUTATORS:
        return "mutate"
    if mod == "shutil" and attr in _SHUTIL_MUTATORS:
        return "mutate"
    if mod == "os" and attr in _OS_EXEC:
        return "exec"
    return None


def _literal_path(node: ast.expr | None) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def sandboxcheck(dirpath: str, whitelist: list | None = None) -> dict:
    """沙盒脚本静态门（v1.7.0）：对 *.py 做 AST 扫描——

    · 禁网模块导入（FORBIDDEN_MODULES，保守从严；误报可入 sandboxcheck-allow.json）
    · 写越界：open(w/a/x/+) 或 os/shutil 变更类调用落在沙盒外（零生产写硬门）
    · 未声明读越界：沙盒外读路径未入白名单（输入面封闭：外部输入须预注册冻结+白名单声明）
    · 动态路径：非字面量路径参数 → 提示行（无法静态判定，人工核）
    · 体积读数：py 文件数与总字节；>10MB 大件列出
    白名单来源：显式 whitelist 参数 ∪ <dir>/sandboxcheck-allow.json 的 paths（模块误报白
    名单同文件 modules 键）。返回 {errors, warnings, size}；errors 非空即未过门。
    """
    root = os.path.realpath(dirpath)
    errors: list[dict] = []
    warnings: list[dict] = []
    allow_mods: set[str] = set()
    allow_paths: list[str] = [os.path.realpath(p) for p in (whitelist or [])]
    allow_file = os.path.join(root, "sandboxcheck-allow.json")
    if os.path.isfile(allow_file):
        try:
            with open(allow_file, encoding="utf-8") as fh:
                conf = json.load(fh)
            allow_mods = set(conf.get("modules", []))
            allow_paths.extend(os.path.realpath(p) for p in conf.get("paths", []))
        except (OSError, json.JSONDecodeError, TypeError) as e:
            errors.append({"file": "sandboxcheck-allow.json", "line": 0,
                           "kind": "allow 文件解析失败", "detail": str(e)})
    py_files = sorted(globlib.glob(os.path.join(root, "**", "*.py"), recursive=True))
    total_bytes = 0
    big_files: list[dict] = []
    for f in py_files:
        st = os.stat(f)
        total_bytes += st.st_size
        rel = os.path.relpath(f, root)
        if st.st_size > 10 * 1024 * 1024:
            big_files.append({"file": rel, "bytes": st.st_size})
        try:
            with open(f, encoding="utf-8") as fh:
                tree = ast.parse(fh.read(), filename=f)
        except (OSError, SyntaxError) as e:
            errors.append({"file": rel, "line": getattr(e, "lineno", 0) or 0,
                           "kind": "读取/语法错误", "detail": str(e)})
            continue
        fdir = os.path.dirname(os.path.realpath(f))

        def _check_path(node: ast.Call, mode: str, kind: str) -> None:
            p = _literal_path(node.args[0] if node.args else None)
            if p is None:
                warnings.append({"file": rel, "line": node.lineno, "kind": "动态路径（无法静态判定）",
                                 "detail": kind})
                return
            cands = (os.path.realpath(p), os.path.realpath(os.path.join(fdir, p)))
            inside = any(c == root or c.startswith(root + os.sep) for c in cands)
            in_allow = any(any(c == ap or c.startswith(ap + os.sep) for c in cands) for ap in allow_paths)
            if inside:
                return
            if kind == "write":
                errors.append({"file": rel, "line": node.lineno, "kind": "写越界（零生产写违规）",
                               "detail": f"{p} (mode={mode or 'os-mutator'})"})
            elif in_allow:
                return
            else:
                errors.append({"file": rel, "line": node.lineno,
                               "kind": "未声明读越界（输入面白名单外）", "detail": f"{p} (mode={mode})"})

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    root_mod = a.name.split(".")[0]
                    if root_mod in FORBIDDEN_MODULES and root_mod not in allow_mods:
                        errors.append({"file": rel, "line": node.lineno, "kind": "禁网模块",
                                       "detail": a.name})
                    elif root_mod == "subprocess":
                        warnings.append({"file": rel, "line": node.lineno, "kind": "外部命令执行（人工核）",
                                         "detail": a.name})
            elif isinstance(node, ast.ImportFrom):
                root_mod = (node.module or "").split(".")[0]
                if (node.module and root_mod in FORBIDDEN_MODULES and root_mod not in allow_mods
                        and node.module != "urllib.parse"):
                    errors.append({"file": rel, "line": node.lineno, "kind": "禁网模块",
                                   "detail": node.module})
                elif root_mod == "subprocess":
                    warnings.append({"file": rel, "line": node.lineno, "kind": "外部命令执行（人工核）",
                                     "detail": node.module})
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name) \
                        and node.func.value.id == "subprocess":
                    warnings.append({"file": rel, "line": node.lineno, "kind": "外部命令执行（人工核）",
                                     "detail": f"subprocess.{node.func.attr}"})
                mut = _mutator_kind(node.func)
                if mut == "mutate":
                    _check_path(node, "", "write")
                elif mut == "exec":
                    warnings.append({"file": rel, "line": node.lineno, "kind": "系统命令执行（人工核）",
                                     "detail": f"os.{node.func.attr}"})
                elif _is_open_call(node.func):
                    mode = "r"
                    if len(node.args) >= 2:
                        lit = _literal_path(node.args[1])
                        if lit is not None:
                            mode = lit
                    for kw in node.keywords:
                        if kw.arg == "mode":
                            lit = _literal_path(kw.value)
                            if lit is not None:
                                mode = lit
                    write_like = any(ch in mode for ch in "wax+")
                    _check_path(node, mode, "write" if write_like else "read")
    return {"errors": errors, "warnings": warnings,
            "size": {"pyFiles": len(py_files), "totalBytes": total_bytes, "bigFiles": big_files}}


def mine_candidates(conv: list, batches: list, carried: list, limited_rows: list) -> list:
    """v1.6.0 矿脉识别门（三触发器任一命中；法学 SKILL §四/§10）。

    ①跨轴：单学科条目在 ≥2 根轴的收敛路径出现（体系级同构信号）；
    ②近原生：该学科全部条目（≥2 条）失配标注均「未寻得失配」；
    ③深掘提名：提名行 excavate=True。
    LIMITED 学科剔除。返回 [{discipline, trigger, axisIds}]，不改计票。
    """
    limited_names = {r["discipline"] for r in limited_rows}
    # 学科 → 命中轴集合 / 机制清单（来自批次）
    axes_hit: dict[str, set] = {}
    mechs_of: dict[str, list] = {}
    for r in conv:
        for p in r["paths"]:
            axes_hit.setdefault(p["source"], set()).add(r["axisId"])
    for b in batches:
        for e in b.get("entries", []):
            mechs_of.setdefault(e["discipline"], []).extend(m for m in e.get("mechanisms", []))
    out: dict[str, dict] = {}
    def add(disc: str, trigger: str, axis_ids: list):
        if disc in limited_names:
            return
        if disc in out:
            out[disc]["trigger"] += "＋" + trigger
            return
        out[disc] = {"discipline": disc, "trigger": trigger, "axisIds": axis_ids}
    # ① 跨轴
    for disc, ax in axes_hit.items():
        if len(ax) >= 2:
            add(disc, f"跨≥2轴命中（{'+'.join(sorted(ax))}）", sorted(ax))
    # ② 近原生：≥2 条且全部「未寻得失配」
    for disc, mechs in mechs_of.items():
        if len(mechs) >= 2 and all(m.get("mismatch") == "未寻得失配" for m in mechs):
            hit_axes = sorted(axes_hit.get(disc, set()))
            add(disc, "全条目未寻得失配（近原生同构）", hit_axes)
    # ③ 深掘提名
    for b in batches:
        for n in b.get("nominates", []):
            if n.get("excavate") is True:
                hit_axes = sorted(axes_hit.get(n["discipline"], {n.get("axisId", "")}))
                add(n["discipline"], "提名深掘标记", [a for a in hit_axes if a])
    return sorted(out.values(), key=lambda m: m["discipline"])


def parse_pool_lines(raw: str) -> list:
    """提名池台账逐行 JSON（坏行容错跳过，对齐 TS 合票容错）。"""
    rows = []
    for line in raw.splitlines():
        s = line.strip()
        if not s:
            continue
        try:
            rows.append(json.loads(s))
        except json.JSONDecodeError:
            continue
    return rows


def narrow(axes: list, batches: list, receipts: list, panel: dict, round_: int,
           carried: list, prev_stall: bool, max_round: int, force_wrapup: bool,
           mined: list | None = None) -> dict:
    """站5 确定性收窄：一条命令组装 LockSpec（收窄公式 A×B×C/跨轮池/棘轮/未竟源/收卷分支）。

    v1.7.0：未竟源九条——原五源 + 反噬登记 / 表冲突移交 / 矿脉未掘（mined=已掘学科清单，
    缺省 None=不可知不报）/ 野卡未填。四条新源皆为「不可静默」项（C1-C3 真跑复盘实录：
    反噬与表冲突的登记此前游离在未竟清单外、矿脉/野卡存量需人工补录）。
    """
    validate_panel(panel)
    conv = count_conv(axes, batches)
    audit = audit_quota(panel, batches)
    ledger = audit["ledger"]
    limited_rows = [r for r in ledger if r["limited"]]

    # A（≥3 路收敛学科供给）∪ B（实验存活），剔除 LIMITED 行
    a_set: set[str] = set()
    for r in conv:
        if r["status"] == "结构必需":
            for p in r["paths"]:
                a_set.add(p["source"])
    b_set = {r["discipline"] for r in receipts if r.get("state") == "咬合"}
    ab = [n for n in dict.fromkeys([*a_set, *b_set]) if n not in {lr["discipline"] for lr in limited_rows}]

    # 跨轮提名池
    built = build_pool(batches, carried)
    promoted = [r for r in built["rows"] if r["cumPaths"] >= 3]
    pool_rest_pre = [r for r in built["rows"] if r["cumPaths"] < 3]
    exited: list[dict] = []
    absorbed: list[str] = []
    seated = set(ab) | {p["discipline"] for p in promoted}
    cur_disciplines = set(built["curDisciplines"])
    pool_rest: list[dict] = []
    for r in pool_rest_pre:
        if r["discipline"] in seated:
            absorbed.append(r["discipline"])
            continue
        carry = next((c for c in carried if c["discipline"] == r["discipline"]), None)
        was_seated = carry is not None and carry.get("status") == "观察"
        if was_seated and r["discipline"] not in cur_disciplines:
            exited.append({"name": r["discipline"], "reason": "连续一轮零新证据（上轮观察席，本轮无再提名）"})
        else:
            pool_rest.append(r)

    # C（野卡 ≥20%）：池排序填充 ≤2/3；pool 非空时 cSize 下限 2（cSize=1 边缘修复）
    c_size = min(max(len(pool_rest), 0), 6) if len(ab) == 0 else max(math.ceil(len(ab) * 0.25), 1)
    if len(pool_rest) > 0:
        c_size = max(c_size, 2)
    if len(ab) == 0 and c_size > 6:
        c_size = 6
    wild_from_pool = min(len(pool_rest), (c_size * 2) // 3, 6)

    panel_entries: list[dict] = []
    for p in promoted:
        panel_entries.append({"name": p["discipline"], "axisIds": [p["axisId"]], "tier": "正式",
                              "origin": f"涌现提名·累计{p['cumPaths']}路转正（免观察）"})
    for name in ab:
        axis_ids = [r["axisId"] for r in conv if r["status"] == "结构必需" and any(p["source"] == name for p in r["paths"])]
        panel_entries.append({"name": name, "axisIds": axis_ids, "tier": "正式",
                              "origin": "A·≥3路收敛供给" if name in a_set else "B·实验存活"})
    for i in range(wild_from_pool):
        r = pool_rest[i]
        carried_note = f"·C{r['carriedFrom']} 起" if r["carriedFrom"] is not None else ""
        panel_entries.append({"name": r["discipline"], "axisIds": [r["axisId"]], "tier": "观察",
                              "origin": f"涌现提名·观察席（累计 {r['cumPaths']} 路{carried_note}）"})
    free_slots = max(c_size - wild_from_pool, 0)
    for i in range(free_slots):
        panel_entries.append({"name": f"（自由探索位 {i + 1}·待下轮立项补）", "axisIds": [], "tier": "野卡",
                              "origin": "自由探索（≥1/3 税）"})
    # 矿脉席（v1.6.0）：不计收敛路/不占 A·B/不占探索税；与 A 并存时席别并存票权不叠加
    mines = mine_candidates(conv=conv, batches=batches, carried=carried, limited_rows=limited_rows)
    for m in mines:
        panel_entries.append({"name": m["discipline"], "axisIds": m["axisIds"], "tier": "矿脉",
                              "origin": f"矿脉席·{m['trigger']}·深读保证位（五维发掘：机制全集/失败化石/参数空间/演进史/对比边界）"})

    # 未竟五源：候选行差额 / 池存量超额 / 观察席退出 / LIMITED / 登记盲区
    # （候选行带共性失配句=v1.5.0 失配避让，item/gap 数字禁改）
    unfinished: list[dict] = []
    for r in conv:
        if r["status"] == "候选":
            mis = sorted({p["mismatch"] for p in r["paths"] if p.get("mismatch") and p["mismatch"] != "未寻得失配"})
            sug = ("下轮站1 定向补检+失配避让（已有路共性失配：" + "；".join(mis) + "）") if mis else "下轮站1 定向补检"
            unfinished.append({"item": f"同构问题「{r['problem']}」未收敛",
                               "gap": f"还差 {3 - r['pathCount']} 路独立命中", "suggestion": sug})
    if len(pool_rest) > wild_from_pool:
        unfinished.append({"item": f"提名池存量 {len(pool_rest) - wild_from_pool} 条未入观察席",
                           "gap": "排序超额落选", "suggestion": "下轮续排（留池不丢）"})
    for e in exited:
        unfinished.append({"item": f"观察席退出：{e['name']}", "gap": e["reason"],
                           "suggestion": "登记已探未收敛；后续出现新证据可重新提名入池"})
    for r in limited_rows:
        unfinished.append({"item": f"{r['district']}/{r['discipline']} 检索面受限",
                           "gap": f"配额 {r['quota']} 实收 {r['delivered']}", "suggestion": "下轮换检索面或降级出面板"})
    for rec in receipts:
        if rec.get("state") == "登记盲区" and rec.get("blindSpotProblem"):
            unfinished.append({"item": f"登记盲区：{rec['blindSpotProblem']}", "gap": "实验无法判定",
                               "suggestion": "升格为下轮候选同构问题"})
    # ---- 未竟源增补（v1.7.0；不可静默：反噬/表冲突/矿脉未掘/野卡未填） ----
    for rec in receipts:
        st = str(rec.get("state", ""))
        detail = rec.get("blindSpotProblem") or rec.get("problem", "")
        if st == "反噬":
            unfinished.append({"item": f"反噬登记（{rec.get('id', '')}）：{detail}",
                               "gap": "效果侧达成、代价面超线（反噬定态）",
                               "suggestion": "代价面重定价或设计变更后复测（判据不据此回改）"})
        elif st.startswith("表冲突"):
            unfinished.append({"item": f"表冲突移交重预注册（{rec.get('id', '')}）：{detail}",
                               "gap": "预锁则表冲突，执行期不裁决",
                               "suggestion": "按重预注册件接续（消解冲突点后复跑，判据不回改）"})
    if mined is not None:
        dug = set(mined)
        undug = [m for m in mines if m["discipline"] not in dug]
        if undug:
            unfinished.append({"item": f"未掘矿脉席 {len(undug)} 席（共 {len(mines)} 席）",
                               "gap": "深读保证位未挖（五维档案缺：机制全集/失败化石/参数空间/演进史/对比边界）",
                               "suggestion": "矿脉档案为收卷后可独立执行的深读任务，按预注册排序键续掘"})
    wild_placeholder = sum(1 for e in panel_entries if e["tier"] == "野卡")
    if wild_placeholder:
        unfinished.append({"item": f"野卡位 {wild_placeholder} 未填",
                           "gap": "自由探索税空位（立项未补）",
                           "suggestion": "重开线先补野卡立项再开其他站位（≥1/3 探索税）"})

    stall = judge_stall(receipts, conv)
    saturated = bool(prev_stall) and stall
    return {
        "round": round_, "theme": "", "panel": panel_entries, "conv": conv,
        "ratchets": next_ratchets(round_), "quotaLedger": ledger,
        "pool": {"nominated": len(built["rows"]), "promoted": len(promoted), "observing": wild_from_pool,
                 "stayed": len(pool_rest) - wild_from_pool, "exited": exited, "absorbed": len(absorbed)},
        "experiments": receipts, "deepDives": [], "stallSuspected": stall,
        "saturated": saturated, "wrapUp": bool(force_wrapup) or saturated or round_ >= max_round,
        "unfinished": unfinished,
    }


# ---------- CLI（文件即契约；主会话 Bash 调用） ----------

def _load_glob(pattern: str) -> list:
    out = []
    for f in sorted(globlib.glob(pattern)):
        with open(f, encoding="utf-8") as fh:
            out.append(json.load(fh))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(prog="prw_core")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("narrow")
    sp.add_argument("--axes", required=True)
    sp.add_argument("--batches", required=True, help="glob，如 'workdir/batch-C2-*.json'")
    sp.add_argument("--receipts", required=True)
    sp.add_argument("--panel", required=True)
    sp.add_argument("--round", type=int, required=True)
    sp.add_argument("--prev-pool", default="")
    sp.add_argument("--prev-stall", type=int, default=0)
    sp.add_argument("--max-round", type=int, default=3)
    sp.add_argument("--force-wrapup", type=int, default=0)
    sp.add_argument("--theme", default="")
    sp.add_argument("--mined", default=None,
                    help="已掘矿脉学科名，'|' 分隔（如 '甲|乙'）；缺省=不可知，不报矿脉未掘")
    sp = sub.add_parser("stall")
    sp.add_argument("--receipts", required=True)
    sp.add_argument("--conv", required=True)
    sp = sub.add_parser("audit")
    sp.add_argument("--panel", required=True)
    sp.add_argument("--batches", required=True)
    sp.add_argument("--lenient-selfcheck", action="store_true",
                    help="遗留批件回放：selfCheck issues 只登记不判死（不回判原则；新轮禁用）")
    sp = sub.add_parser("conv")
    sp.add_argument("--axes", required=True)
    sp.add_argument("--batches", required=True)
    sp = sub.add_parser("selfcheck")
    sp.add_argument("--batches", required=True)
    sp.add_argument("--prev-pool", default="", help="上轮提名池台账（重复提名提示，仅登记不判死）")
    sp = sub.add_parser("ratchets")
    sp.add_argument("--round", type=int, required=True)
    sp = sub.add_parser("version")
    g = sp.add_mutually_exclusive_group(required=True)
    g.add_argument("--snapshot", metavar="OUT.json", help="落盘判据源清单快照")
    g.add_argument("--check", metavar="SNAP.json", help="与快照比对；漂移 exit 2")
    sp = sub.add_parser("sandboxcheck")
    sp.add_argument("--dir", required=True)
    sp.add_argument("--whitelist", default="", help="JSON 数组：白名单外部只读路径")

    args = ap.parse_args()
    if args.cmd == "narrow":
        carried = []
        if args.prev_pool:
            with open(args.prev_pool, encoding="utf-8") as fh:
                carried = parse_pool_lines(fh.read())
        with open(args.axes, encoding="utf-8") as fh:
            axes = json.load(fh)["axes"]
        with open(args.panel, encoding="utf-8") as fh:
            panel = json.load(fh)
        receipts = _load_glob(args.receipts) if "*" in args.receipts else json.load(open(args.receipts, encoding="utf-8"))
        mined = None
        if args.mined is not None:
            mined = [s for s in args.mined.split("|") if s]
        lock = narrow(axes=axes, batches=_load_glob(args.batches), receipts=receipts, panel=panel,
                      round_=args.round, carried=carried, prev_stall=bool(args.prev_stall),
                      max_round=args.max_round, force_wrapup=bool(args.force_wrapup), mined=mined)
        lock["theme"] = args.theme
        print(json.dumps(lock, ensure_ascii=False, indent=1))
        return 0
    elif args.cmd == "stall":
        receipts = _load_glob(args.receipts) if "*" in args.receipts else json.load(open(args.receipts, encoding="utf-8"))
        conv = _load_glob(args.conv) if "*" in args.conv else json.load(open(args.conv, encoding="utf-8"))
        print("true" if judge_stall(receipts, conv) else "false")
        return 0
    elif args.cmd == "audit":
        with open(args.panel, encoding="utf-8") as fh:
            panel = json.load(fh)
        batches = _load_glob(args.batches)
        result = audit_quota(panel, batches)
        sc = selfcheck_audit(batches)
        result["selfcheck"] = {"ok": not sc, "issues": sc}
        print(json.dumps(result, ensure_ascii=False, indent=1))
        if sc and not args.lenient_selfcheck:
            print(f"[audit] selfCheck 门不过（{len(sc)} 处）→ exit 2（遗留批件回放可加 --lenient-selfcheck）",
                  file=sys.stderr)
            return 2
        return 0
    elif args.cmd == "conv":
        with open(args.axes, encoding="utf-8") as fh:
            axes = json.load(fh)["axes"]
        print(json.dumps(count_conv(axes, _load_glob(args.batches)), ensure_ascii=False, indent=1))
        return 0
    elif args.cmd == "selfcheck":
        batches = _load_glob(args.batches)
        issues = selfcheck_audit(batches)
        dups: list[str] = []
        if args.prev_pool:
            with open(args.prev_pool, encoding="utf-8") as fh:
                dups = selfcheck_duplicates(batches, parse_pool_lines(fh.read()))
        print(json.dumps({"issues": issues, "duplicates": dups}, ensure_ascii=False, indent=1))
        if issues:
            print(f"[selfcheck] 自检对账不过（{len(issues)} 处）→ exit 2", file=sys.stderr)
            return 2
        return 0
    elif args.cmd == "ratchets":
        print(json.dumps(next_ratchets(args.round), ensure_ascii=False))
        return 0
    elif args.cmd == "version":
        if args.snapshot:
            snap = version_snapshot()
            with open(args.snapshot, "w", encoding="utf-8") as fh:
                json.dump(snap, fh, ensure_ascii=False, indent=1)
            print(json.dumps({"snapshot": args.snapshot, "files": sorted(snap["files"])}, ensure_ascii=False))
            return 0
        with open(args.check, encoding="utf-8") as fh:
            snap = json.load(fh)
        drifts = version_check(snap)
        print(json.dumps({"drifts": drifts}, ensure_ascii=False, indent=1))
        if drifts:
            print(f"[version] 判据源漂移 {len(drifts)} 处 → exit 2", file=sys.stderr)
            return 2
        return 0
    elif args.cmd == "sandboxcheck":
        whitelist: list = []
        if args.whitelist:
            with open(args.whitelist, encoding="utf-8") as fh:
                whitelist = json.load(fh)
        rep = sandboxcheck(args.dir, whitelist=whitelist)
        print(json.dumps(rep, ensure_ascii=False, indent=1))
        if rep["errors"]:
            print(f"[sandboxcheck] {len(rep['errors'])} 处违规 → exit 2", file=sys.stderr)
            return 2
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
