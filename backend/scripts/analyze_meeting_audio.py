from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.ai.llm_analysis import HeuristicLLMAnalysisService
from app.services.ai.stt import WhisperSpeechToTextService
from app.services.ai_engine import AIEngine


def _build_engine(mode: str) -> AIEngine:
    if mode == "heuristic":
        return AIEngine(
            stt_service=WhisperSpeechToTextService(),
            llm_service=HeuristicLLMAnalysisService(),
        )
    return AIEngine()


def _print_section(title: str, value: Any) -> None:
    print(f"{title}")
    if isinstance(value, list):
        if not value:
            print("- 없음")
            return
        for item in value:
            if isinstance(item, dict):
                parts = []
                for key in ("title", "description", "level", "text", "priority", "assignee", "due_at"):
                    if key in item and item.get(key) not in (None, ""):
                        parts.append(f"{key}={item[key]}")
                print(f"- {' | '.join(parts) if parts else json.dumps(item, ensure_ascii=False)}")
            else:
                print(f"- {item}")
        return

    if isinstance(value, dict):
        print(json.dumps(value, ensure_ascii=False, indent=2))
        return

    print(value if value else "- 없음")


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze a meeting audio file and print a readable report.")
    parser.add_argument("audio_path", type=Path, help="Path to the meeting audio file")
    parser.add_argument(
        "--mode",
        choices=("heuristic", "default"),
        default="heuristic",
        help="Use the deterministic local heuristic pipeline or the default app pipeline.",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        default=None,
        help="Optional path to write the full analysis payload as JSON.",
    )
    args = parser.parse_args()

    engine = _build_engine(args.mode)
    result = engine.process_audio(str(args.audio_path))

    audio_summary = result.analysis.extra_data.get("audio_preprocessing", {})
    stt_routing = result.analysis.extra_data.get("stt_routing", [])

    print(f"FILE: {args.audio_path}")
    print(f"MODE: {args.mode}")
    print(f"TRANSCRIPT_LEN: {len(result.transcript)}")
    print(f"MODEL: {result.analysis.model_name}")
    print(f"PROMPT: {result.analysis.prompt_version}")
    _print_section("AUDIO_PREPROCESSING", audio_summary)
    print()
    _print_section("STT_ROUTING", stt_routing)
    print()
    _print_section("SPEAKER_DIARIZATION", result.analysis.extra_data.get("speaker_diarization", {}))
    print()
    _print_section("SUMMARY", result.analysis.summary)
    print()
    _print_section("KEYWORDS", result.analysis.keywords)
    print()
    _print_section("DECISIONS", result.analysis.decisions)
    print()
    _print_section("ACTION_ITEMS", result.analysis.action_items)
    print()
    _print_section("ISSUES", result.analysis.issues)
    print()
    _print_section("NEXT_AGENDA", result.analysis.next_agenda)

    if args.json_output is not None:
        payload = result.to_dict()
        args.json_output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print()
        print(f"JSON_WRITTEN: {args.json_output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
