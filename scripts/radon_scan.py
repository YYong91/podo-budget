#!/usr/bin/env python3
"""Radon 코드 품질 스캐너

백엔드 코드의 복잡도를 분석하고, 이전 결과와 비교하여 변화를 감지한다.
결과는 .radon/history.json에 누적 저장된다.

사용법:
    uv run python scripts/radon_scan.py              # 스캔 + 비교
    uv run python scripts/radon_scan.py --json       # JSON 출력 (커맨드 연동용)
    uv run python scripts/radon_scan.py --threshold C  # C등급 이상만 (기본값)
"""

import json
import subprocess
import sys
from datetime import datetime, UTC
from pathlib import Path

# ── 설정 ────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent.parent / "backend" / "app"
HISTORY_FILE = Path(__file__).parent.parent / ".radon" / "history.json"
DEFAULT_THRESHOLD = "C"  # C등급 이상 추출

# CC 등급 → 숫자 (비교용)
GRADE_ORDER = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5}


def run_radon_cc(threshold: str = DEFAULT_THRESHOLD) -> list[dict]:
    """radon cc 실행 → 구조화된 결과 반환"""
    result = subprocess.run(
        ["radon", "cc", str(BACKEND_DIR), "-s", "-j", "-n", threshold],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"radon cc 실행 실패: {result.stderr}", file=sys.stderr)
        return []

    raw = json.loads(result.stdout)
    items = []
    for filepath, blocks in raw.items():
        # 상대 경로로 변환 (backend/app/ 기준)
        rel_path = filepath.replace(str(BACKEND_DIR.parent) + "/", "")
        for block in blocks:
            items.append({
                "file": rel_path,
                "name": block["name"],
                "lineno": block["lineno"],
                "complexity": block["complexity"],
                "rank": block["rank"],
                "type": block["type"],  # F=function, M=method, C=class
            })

    # 복잡도 내림차순 정렬
    items.sort(key=lambda x: x["complexity"], reverse=True)
    return items


def run_radon_mi() -> list[dict]:
    """radon mi 실행 → 파일별 유지보수성 인덱스"""
    result = subprocess.run(
        ["radon", "mi", str(BACKEND_DIR), "-s", "-j"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return []

    raw = json.loads(result.stdout)
    items = []
    for filepath, info in raw.items():
        rel_path = filepath.replace(str(BACKEND_DIR.parent) + "/", "")
        items.append({
            "file": rel_path,
            "mi": info["mi"],
            "rank": info["rank"],
        })

    # MI 오름차순 (낮을수록 유지보수 어려움)
    items.sort(key=lambda x: x["mi"])
    return items


def load_history() -> list[dict]:
    """이전 스캔 결과 로드"""
    if not HISTORY_FILE.exists():
        return []
    with open(HISTORY_FILE) as f:
        return json.load(f)


def save_history(history: list[dict]) -> None:
    """스캔 결과 저장"""
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def compare_with_previous(current: list[dict], history: list[dict]) -> dict:
    """이전 결과와 비교하여 변화 감지"""
    if not history:
        return {"new_issues": current, "resolved": [], "worsened": [], "improved": []}

    prev_scan = history[-1]["cc"]
    prev_map = {f"{item['file']}:{item['name']}": item for item in prev_scan}
    curr_map = {f"{item['file']}:{item['name']}": item for item in current}

    new_issues = []
    worsened = []
    improved = []
    resolved = []

    # 새로 등장하거나 악화된 것
    for key, item in curr_map.items():
        if key not in prev_map:
            new_issues.append(item)
        else:
            prev_cc = prev_map[key]["complexity"]
            curr_cc = item["complexity"]
            if curr_cc > prev_cc:
                worsened.append({**item, "prev_complexity": prev_cc})
            elif curr_cc < prev_cc:
                improved.append({**item, "prev_complexity": prev_cc})

    # 해결된 것 (이전에 있었는데 사라진 것)
    for key, item in prev_map.items():
        if key not in curr_map:
            resolved.append(item)

    return {
        "new_issues": new_issues,
        "resolved": resolved,
        "worsened": worsened,
        "improved": improved,
    }


def format_report(cc_items: list[dict], mi_items: list[dict], diff: dict) -> str:
    """사람이 읽기 좋은 리포트 생성"""
    lines = []
    lines.append("# Radon 코드 품질 리포트")
    lines.append(f"스캔 시각: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append("")

    # 요약
    grade_counts = {}
    for item in cc_items:
        grade_counts[item["rank"]] = grade_counts.get(item["rank"], 0) + 1
    summary = ", ".join(f"{k}: {v}개" for k, v in sorted(grade_counts.items(), key=lambda x: GRADE_ORDER.get(x[0], 9)))
    lines.append(f"## 요약: {len(cc_items)}개 고복잡도 함수 ({summary})")
    lines.append("")

    # 변화 감지
    if any(diff[k] for k in ["new_issues", "resolved", "worsened", "improved"]):
        lines.append("## 이전 대비 변화")
        if diff["worsened"]:
            lines.append(f"### ⚠️ 악화 ({len(diff['worsened'])}개)")
            for item in diff["worsened"]:
                lines.append(f"- {item['rank']}({item['complexity']}) {item['file']}:{item['lineno']} `{item['name']}` (이전: {item['prev_complexity']})")
        if diff["new_issues"]:
            lines.append(f"### 🆕 신규 ({len(diff['new_issues'])}개)")
            for item in diff["new_issues"]:
                lines.append(f"- {item['rank']}({item['complexity']}) {item['file']}:{item['lineno']} `{item['name']}`")
        if diff["improved"]:
            lines.append(f"### ✅ 개선 ({len(diff['improved'])}개)")
            for item in diff["improved"]:
                lines.append(f"- {item['rank']}({item['complexity']}) {item['file']}:{item['lineno']} `{item['name']}` (이전: {item['prev_complexity']})")
        if diff["resolved"]:
            lines.append(f"### 🎉 해결 ({len(diff['resolved'])}개)")
            for item in diff["resolved"]:
                lines.append(f"- {item['file']}:{item['lineno']} `{item['name']}`")
        lines.append("")

    # TOP 리스트
    lines.append("## 복잡도 TOP 20")
    for item in cc_items[:20]:
        lines.append(f"- {item['rank']}({item['complexity']}) {item['file']}:{item['lineno']} `{item['name']}`")
    lines.append("")

    # 유지보수성 최하위
    low_mi = [item for item in mi_items if item["rank"] in ("B", "C")]
    if low_mi:
        lines.append("## 유지보수성 낮은 파일")
        for item in low_mi[:10]:
            lines.append(f"- {item['rank']} (MI={item['mi']:.1f}) {item['file']}")
        lines.append("")

    return "\n".join(lines)


def main():
    json_mode = "--json" in sys.argv
    threshold = DEFAULT_THRESHOLD
    if "--threshold" in sys.argv:
        idx = sys.argv.index("--threshold")
        if idx + 1 < len(sys.argv):
            threshold = sys.argv[idx + 1].upper()

    # 스캔
    cc_items = run_radon_cc(threshold)
    mi_items = run_radon_mi()

    # 이전 결과와 비교
    history = load_history()
    diff = compare_with_previous(cc_items, history)

    # 결과 저장
    scan_result = {
        "timestamp": datetime.now(UTC).isoformat(),
        "threshold": threshold,
        "cc": cc_items,
        "mi": mi_items,
        "summary": {
            "total_high_cc": len(cc_items),
            "new": len(diff["new_issues"]),
            "resolved": len(diff["resolved"]),
            "worsened": len(diff["worsened"]),
            "improved": len(diff["improved"]),
        },
    }
    history.append(scan_result)

    # 최근 20개만 유지
    if len(history) > 20:
        history = history[-20:]
    save_history(history)

    if json_mode:
        output = {
            "current": cc_items,
            "mi": mi_items,
            "diff": diff,
            "summary": scan_result["summary"],
        }
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        report = format_report(cc_items, mi_items, diff)
        print(report)


if __name__ == "__main__":
    main()
