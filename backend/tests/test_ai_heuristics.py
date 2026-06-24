from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.ai.audio_preprocessing import WhisperAudioPreprocessor
from app.services.ai.stt import _attach_speaker_labels
from app.services.ai.stt import WhisperSpeechToTextService
from app.services.ai.llm_analysis import HeuristicLLMAnalysisService
from app.services.ai.text_normalization import normalize_meeting_terms
from app.services.ai_engine import (
    _augment_context_with_audio_quality,
    _build_sentence_segments,
    _build_meeting_search_document,
    _build_speaker_fields,
    _build_tx_rows,
    _summarize_audio_preprocessing,
    _summarize_stt_routing,
)


class HeuristicMeetingAnalysisTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = HeuristicLLMAnalysisService()

    def test_dialogue_normalization_strips_speakers_and_fillers(self) -> None:
        text = """
정아름: 다들 왔죠? 그럼 회의 시작하겠습니다.

김소현: 네.

(웃음)

송지영: 잠시만요. 제 노트북 업데이트가 갑자기...
"""
        normalized = self.service._normalize_dialogue_transcript(text)

        self.assertNotIn("정아름:", normalized)
        self.assertNotIn("김소현:", normalized)
        self.assertNotIn("(웃음)", normalized)
        self.assertIn("회의 시작하겠습니다.", normalized)
        self.assertIn("제 노트북 업데이트가 갑자기...", normalized)

    def test_noise_sentence_filter_keeps_real_content(self) -> None:
        sentences = [
            "네",
            "좋습니다",
            "우선 로그인 기능부터 만들고, 그 다음 업무 등록 기능, 결재 기능 순으로 가는 게 좋습니다.",
            "음",
        ]

        filtered = self.service._filter_noise_sentences(sentences)

        self.assertEqual(
            filtered,
            ["우선 로그인 기능부터 만들고, 그 다음 업무 등록 기능, 결재 기능 순으로 가는 게 좋습니다."],
        )

    def test_action_item_title_cleanup_drops_temporal_prefix(self) -> None:
        title = self.service._build_title("오늘은 사내 업무관리시스템 구축 프로젝트 일정이랑 업무 분담을 정하겠습니다.")

        self.assertFalse(title.startswith("은 "))
        self.assertIn("사내 업무관리시스템", title)

    def test_sentence_cleanup_collapses_repeated_phrases(self) -> None:
        sentence = (
            "그럼 이건 첫 번째 리스크로 등록하고 담당한 소연님이 "
            "그럼 이건 첫 번째 리스크로 등록하고 담당한 소연님이 "
            "인사팀과 협의하는 걸로 하고요"
        )

        cleaned = self.service._cleanup_sentence(sentence)

        self.assertEqual(
            cleaned,
            "그럼 이건 첫 번째 리스크로 등록하고 담당한 소연님이 인사팀과 협의하는 걸로 하고요",
        )

    def test_speaker_fields_are_prepared_for_future_diarization(self) -> None:
        self.assertEqual(_build_speaker_fields(None), {"speaker": None, "speaker_id": None, "speaker_label": None})
        self.assertEqual(
            _build_speaker_fields("speaker_1"),
            {"speaker": "speaker_1", "speaker_id": "speaker_1", "speaker_label": "speaker_1"},
        )

    def test_sentence_segments_include_speaker_placeholders(self) -> None:
        segments = _build_sentence_segments("회의 시작하겠습니다. 준비됐습니다.")

        self.assertEqual(len(segments), 2)
        self.assertTrue(all(segment["speaker"] is None for segment in segments))
        self.assertTrue(all(segment["speaker_id"] is None for segment in segments))
        self.assertTrue(all(segment["speaker_label"] is None for segment in segments))

    def test_tx_rows_keep_speaker_columns_even_without_diarization(self) -> None:
        rows = _build_tx_rows(
            [
                {
                    "index": 0,
                    "start_seconds": 12.2,
                    "speaker": None,
                    "text": "회의를 시작하겠습니다.",
                    "masked_text": "회의를 시작하겠습니다.",
                },
                {
                    "index": 1,
                    "start_seconds": 34.9,
                    "speaker": "speaker_2",
                    "speaker_id": "speaker_2",
                    "speaker_label": "채하율",
                    "text": "준비됐습니다.",
                    "masked_text": "준비됐습니다.",
                },
            ]
        )

        self.assertEqual(rows[0]["spk"], None)
        self.assertEqual(rows[0]["speaker_id"], None)
        self.assertEqual(rows[0]["speaker_label"], None)
        self.assertEqual(rows[1]["spk"], "speaker_2")
        self.assertEqual(rows[1]["speaker_id"], "speaker_2")
        self.assertEqual(rows[1]["speaker_label"], "채하율")

    def test_attach_speaker_labels_matches_overlap_and_assigns_stable_names(self) -> None:
        segments = [
            {
                "index": 0,
                "start_seconds": 0.0,
                "end_seconds": 5.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "회의를 시작하겠습니다.",
            },
            {
                "index": 1,
                "start_seconds": 5.1,
                "end_seconds": 10.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "네, 준비됐습니다.",
            },
            {
                "index": 2,
                "start_seconds": 10.1,
                "end_seconds": 15.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "저도 준비됐습니다.",
            },
        ]
        turns = [
            {"start_seconds": 0.0, "end_seconds": 6.0, "speaker_id": "SPEAKER_00"},
            {"start_seconds": 6.0, "end_seconds": 15.0, "speaker_id": "SPEAKER_01"},
        ]

        annotated, summary = _attach_speaker_labels(segments, turns)

        self.assertEqual(summary["status"], "applied")
        self.assertEqual(summary["speaker_count"], 2)
        self.assertEqual(annotated[0]["speaker_label"], "화자 1")
        self.assertEqual(annotated[0]["speaker_id"], "SPEAKER_00")
        self.assertEqual(annotated[1]["speaker_label"], "화자 2")
        self.assertEqual(annotated[2]["speaker_label"], "화자 2")

    def test_meeting_search_document_combines_title_keywords_and_body(self) -> None:
        segments = _build_sentence_segments("회의를 시작하겠습니다. 결제 기능을 우선 보겠습니다.")
        analysis_data = {
            "summary": "회의에서는 결제 기능과 업무 등록 기능 우선순위를 정리했다.",
            "keywords": [{"text": "기능 우선순위", "type": "purple"}, {"text": "결재 기능", "type": "cyan"}],
            "decisions": ["결제 기능을 우선 진행하기로 했다."],
            "action_items": [
                {
                    "title": "요구사항 명세서 진행",
                    "description": "김소현이 요구사항 명세서를 7월 12일까지 완료한다.",
                    "priority": "medium",
                    "assignee": "김소현",
                    "due_at": "2026-07-12",
                    "status": "todo",
                }
            ],
            "issues": [{"text": "결제 기능 영향 범위를 확인했다."}],
            "next_agenda": ["다음 회의에서는 리스크 대응 방안을 다시 확인한다."],
        }

        document = _build_meeting_search_document(
            transcript="회의를 시작하겠습니다. 결제 기능을 우선 보겠습니다.",
            masked_transcript="회의를 시작하겠습니다. 결제 기능을 우선 보겠습니다.",
            analysis_data=analysis_data,
            segments=segments,
            context_snapshot={"meeting_title": "주간 회의", "project_name": "TIKI"},
        )

        self.assertEqual(document["meeting_title"], "주간 회의")
        self.assertEqual(document["project_name"], "TIKI")
        self.assertIn("기능 우선순위", document["keywords"])
        self.assertIn("결제 기능을 우선 진행하기로 했다.", document["search_text"])
        self.assertTrue(document["chunks"])
        self.assertTrue(any(chunk["search_text"] for chunk in document["chunks"]))
        self.assertIn("회의를 시작하겠습니다", document["search_text"])

    def test_meeting_term_normalization_corrects_common_whisper_misreads(self) -> None:
        text = "산의 업무 관리 시스템에서 데시보드와 결지 요청, 디자인 시한, 우성 검토, 정관리 기능과 노구인, 담당자 지적, 중간 시암을 확인합니다."

        normalized = normalize_meeting_terms(text)

        self.assertIn("사내 업무 관리 시스템", normalized)
        self.assertIn("대시보드", normalized)
        self.assertIn("결재 요청", normalized)
        self.assertIn("디자인 시안", normalized)
        self.assertIn("우선 검토", normalized)
        self.assertIn("일정 관리 기능", normalized)
        self.assertIn("로그인", normalized)
        self.assertIn("담당자 지정", normalized)
        self.assertIn("중간 시안", normalized)

    def test_meeting_summary_preserves_action_items_on_noisy_dialogue(self) -> None:
        transcript = """
정아름: 오늘은 사내 업무관리시스템 구축 프로젝트 일정이랑 업무 분담을 정하겠습니다.
김소현: 우선 로그인 기능부터 만들고, 그 다음 업무 등록 기능, 결재 기능 순으로 가는 게 좋습니다.
채하율: 요구사항 명세서는 김소현 님이 진행하고 2026-06-25까지 완료하는 걸로 하겠습니다.
송지영: 다음 회의에서는 개발 일정과 예상 리스크를 다시 보죠.
"""
        result = self.service.summarize_and_extract_tickets(
            transcript,
            context={
                "extra": {
                    "audio_preprocessing": {
                        "raw_noisy": True,
                        "quality_flags": ["raw_noise_detected"],
                    }
                }
            },
        )

        action_titles = [item["title"] for item in result["action_items"]]

        self.assertIn("업무관리시스템", result["summary"])
        self.assertGreaterEqual(len(result["action_items"]), 3)
        self.assertTrue(any("로그인" in title for title in action_titles), action_titles)
        self.assertTrue(any("요구사항 명세서" in title for title in action_titles), action_titles)
        self.assertTrue(result["decisions"])
        self.assertTrue(result["next_agenda"])
        self.assertIn("다음 회의", result["next_agenda"][0])
        self.assertTrue(result["extra_data"]["audio_noise_context"])
        self.assertLessEqual(len(result["summary"]), 320)

    def test_summary_is_rewritten_into_dashboard_style(self) -> None:
        transcript = """
정아름: 다들 왔죠? 그럼 회의 시작하겠습니다.
김소현: 네 알겠습니다.
채하율: 네, 준비됐습니다.
송지영: 저도 준비됐습니다.
정아름: 오늘 회의 목적은 사내 업무관리시스템 구축 프로젝트 일정이랑 업무 분담을 정하는 겁니다.
김소현: 기본적으로 업무 등록 기능, 일정 관리 기능, 결제 기능, 공지사항 기능, 그리고 관리자 페이지가 있습니다.
채하율: 결제 기능은 필수라고 생각합니다.
송지영: 요구사항 명세서는 김소현님이 진행하고 7월 12일까지 완료하는 걸로 하겠습니다.
정아름: 디자인 중간 시안은 7월 15일, 최종 시안은 7월 22일로 정리하겠습니다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertTrue(result["summary"].startswith("회의에서는"))
        self.assertIn("기능 우선순위", result["summary"])
        self.assertIn("후속", result["summary"])
        self.assertNotIn("회의 시작하겠습니다", result["summary"])
        self.assertNotIn("오늘 회의 목적은", result["summary"])

    def test_action_items_are_rewritten_like_ticket_cards(self) -> None:
        transcript = """
정아름: 요구사항 명세서는 김소현님이 진행하고 7월 12일까지 완료하는 걸로 하겠습니다.
송지영: 파일 첨부 기능은 1차 오픈에 포함하는 방향으로 검토합시다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)
        action_items = result["action_items"]
        descriptions = [item["description"] for item in action_items]

        self.assertTrue(any(desc.endswith("한다.") for desc in descriptions), descriptions)
        self.assertTrue(any("요구사항 명세서" in desc for desc in descriptions), descriptions)
        self.assertTrue(any("파일 첨부 기능" in desc and "검토" in desc for desc in descriptions), descriptions)

    def test_issues_are_rewritten_like_risk_cards(self) -> None:
        transcript = """
정아름: 특히 결재 기능은 모두가 나면 안 되죠. 그럼 테스트는 어떤 방식으로 진행하실 건가요.
김소현: 그럼 이건 첫 번째 리스크로 등록하고 담당한 소연님이 인사팀과 협의하는 걸로 하고요.
"""

        result = self.service.summarize_and_extract_tickets(transcript)
        issue_titles = [item["text"] for item in result["issues"]]

        self.assertTrue(issue_titles)
        self.assertTrue(any(title.endswith("필요하다.") or title.endswith("확인했다.") for title in issue_titles), issue_titles)
        self.assertTrue(any("결재 기능" in title or "리스크" in title for title in issue_titles), issue_titles)

    def test_decisions_ignore_meeting_opening_lines(self) -> None:
        transcript = """
정아름: 다들 왔죠? 그럼 회의 시작하겠습니다.
김소현: 결제 기능은 필수라고 생각합니다. 이걸로 결정하겠습니다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertTrue(result["decisions"])
        self.assertTrue(any("결정" in item for item in result["decisions"]))
        self.assertFalse(any("회의 시작" in item for item in result["decisions"]))

    def test_followup_agenda_captures_discussion_questions(self) -> None:
        transcript = "송지영: 이번에는 추가 기능 요청이 들어올 경우에 어떻게 대응할지 이야기해봅시다."

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertTrue(result["next_agenda"])
        self.assertTrue(any(item.endswith("한다.") for item in result["next_agenda"]), result["next_agenda"])
        self.assertTrue(any("대응 방안" in item for item in result["next_agenda"]), result["next_agenda"])
        self.assertFalse(any("이야기해봅시다" in item for item in result["next_agenda"]), result["next_agenda"])
        self.assertFalse(result["issues"])

    def test_next_agenda_are_rewritten_like_followup_cards(self) -> None:
        transcript = """
정아름: 다음 회의에서는 개발 일정과 예상 리스크를 다시 보죠.
"""

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertTrue(result["next_agenda"], result["next_agenda"])
        self.assertTrue(any(item.endswith("한다.") for item in result["next_agenda"]), result["next_agenda"])
        self.assertTrue(any("다음 회의" in item for item in result["next_agenda"]), result["next_agenda"])
        self.assertFalse(any("다시 보죠" in item for item in result["next_agenda"]), result["next_agenda"])

    def test_noise_summary_rewrites_into_meeting_summary_style(self) -> None:
        transcript = """
정아름: 다들 왔죠? 그럼 회의 시작하겠습니다.
김소현: 결제 기능은 필수라고 생각합니다.
채하율: 업무 등록 기능도 중요하다고 생각해요.
송지영: 디자인 수정 요청이 많아질 수 있어서 리스크가 있습니다.
"""

        result = self.service.summarize_and_extract_tickets(
            transcript,
            context={
                "extra": {
                    "audio_preprocessing": {
                        "raw_noisy": True,
                        "quality_flags": ["raw_noise_detected"],
                    }
                }
            },
        )

        self.assertLessEqual(len(result["summary"]), 320)
        self.assertNotIn("회의 시작", result["summary"])
        self.assertNotIn("다들 왔죠", result["summary"])
        self.assertIn("결제", result["summary"])
        self.assertIn("업무 등록", result["summary"])

    def test_keywords_are_topic_tags_not_generic_noise_words(self) -> None:
        transcript = """
정아름: 로그인, 업무 등록, 결재 기능의 우선순위를 정하겠습니다.
김소현: 디자인 수정 요청은 따로 보고, 테스트 일정과 리스크 관리도 확인해야 합니다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)
        keywords = [item["text"] for item in result["keywords"]]

        self.assertTrue(any(tag in keywords for tag in ("업무관리시스템", "기능 우선순위", "디자인 수정", "리스크 관리")))
        self.assertFalse(any(tag in keywords for tag in ("일정", "마감", "완료")))

    def test_decisions_are_rewritten_into_concise_statements(self) -> None:
        transcript = """
김소현: 결제 기능은 필수라고 생각합니다. 저는 업무 등록 기능도 중요하다고 생각해요. 업무를 등록하고 담당자를 지정하는 기능이 있어야 결제도 의미가 있을 것 같아요. 저도 동의해요 좋습니다.
송지영: 그럼 알림 기능은 2차 개발 후보로 분류하겠습니다.
정아름: 월 5일까지 확보하는 걸 목표로 하겠습니다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)
        decisions = result["decisions"]

        self.assertTrue(any("결제 기능" in item for item in decisions), decisions)
        self.assertTrue(any("업무 등록 기능" in item for item in decisions), decisions)
        self.assertTrue(any("알림 기능" in item and "2차 개발 후보" in item for item in decisions), decisions)
        self.assertTrue(any("월 5일" in item or "2026-07-05" in item for item in decisions), decisions)
        self.assertTrue(all(len(item) <= 60 for item in decisions), decisions)

    def test_korean_due_date_is_parsed_into_action_item(self) -> None:
        transcript = """
정아름: 7월 10일까지는 수정 요청을 받고 이후에는 긴급 수정만 반영하는 게 좋겠습니다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertTrue(result["action_items"])
        self.assertEqual(result["action_items"][0]["due_at"], "2026-07-10")

    def test_action_item_title_is_compacted_into_ticket_style(self) -> None:
        title = self.service._build_action_item_title(
            "그럼 요구사항 명세서는 김소현 님이 진행하고 6월 25일까지 완료하는 걸로 하겠습니다."
        )

        self.assertEqual(title, "요구사항 명세서 진행")
        self.assertLessEqual(len(title), 20)

    def test_action_items_are_capped_at_seven(self) -> None:
        transcript = """
정아름: 업무관리시스템 일정을 정리하겠습니다.
김소현: 로그인 기능을 진행하겠습니다.
채하율: 업무 등록 기능을 진행하겠습니다.
송지영: 결제 기능을 진행하겠습니다.
민수: 알림 기능을 진행하겠습니다.
지은: 파일 첨부 기능을 검토하겠습니다.
현우: 디자인 수정을 반영하겠습니다.
수연: 테스트 일정을 확인하겠습니다.
도윤: 리스크 관리를 대응하겠습니다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertEqual(len(result["action_items"]), 7)
        self.assertTrue(any("업무관리시스템" in item["title"] for item in result["action_items"]))
        self.assertTrue(any("로그인" in item["title"] for item in result["action_items"]))
        self.assertTrue(any("업무 등록" in item["title"] for item in result["action_items"]))

    def test_issues_are_compacted_into_short_risk_titles(self) -> None:
        transcript = """
정아름: 특히 결제 기능은 모두가 나면 안 되죠. 그럼 테스트는 어떤 방식으로 진행하실 건가요.
김소현: 그럼 이건 첫 번째 리스크로 등록하고 담당한 소연님이 인사팀과 협의하는 걸로 하고요.
"""

        result = self.service.summarize_and_extract_tickets(transcript)
        issue_titles = [item["text"] for item in result["issues"]]

        self.assertTrue(result["issues"])
        self.assertTrue(all(len(title) <= 36 for title in issue_titles), issue_titles)
        self.assertTrue(any("협의" in title or "리스크" in title for title in issue_titles), issue_titles)

    def test_assignee_is_corrected_from_context_name_candidates(self) -> None:
        transcript = """
정아름: 요구사항 명세서는 소연님이 진행하고 6월 25일까지 완료하겠습니다.
"""

        result = self.service.summarize_and_extract_tickets(
            transcript,
            context={
                "participants": ["김소현", "정아름"],
            },
        )

        self.assertTrue(result["action_items"])
        self.assertEqual(result["action_items"][0]["assignee"], "김소현")

    def test_audio_preprocessing_summary_merges_quality_flags_into_context(self) -> None:
        preprocessing = {
            "source_path": "/tmp/meeting.m4a",
            "strategy": "ffmpeg_denoise",
            "sample_rate": 16000,
            "duration_seconds": 123.4,
            "chunking_enabled": True,
            "chunk_count": 3,
            "quality_flags": ["raw_noise_detected", "ffmpeg_denoised"],
            "load_metadata": {
                "raw_noisy": True,
                "ffmpeg_denoised": True,
                "stationary_noise_suppressed": False,
                "noisy_recording": True,
            },
        }

        summary = _summarize_audio_preprocessing(preprocessing)
        augmented = _augment_context_with_audio_quality(
            {"project_name": "TIKI", "note": "기존 메모"},
            preprocessing,
        )

        self.assertTrue(summary["raw_noisy"])
        self.assertTrue(summary["ffmpeg_denoised"])
        self.assertEqual(summary["chunk_count"], 3)
        self.assertIn("audio_preprocessing", augmented["extra"])
        self.assertIn("ffmpeg_denoised=true", augmented["note"])

    def test_stt_routing_summary_groups_chunks_by_model(self) -> None:
        segments = [
            {"chunk_index": 0, "start_seconds": 0.0, "end_seconds": 30.0, "duration_seconds": 30.0, "model_name": "small", "chunk_difficulty": 1},
            {"chunk_index": 0, "start_seconds": 0.5, "end_seconds": 29.5, "duration_seconds": 29.0, "model_name": "small", "chunk_difficulty": 1},
            {"chunk_index": 1, "start_seconds": 30.0, "end_seconds": 90.0, "duration_seconds": 60.0, "model_name": "large", "chunk_difficulty": 3},
        ]

        routing = _summarize_stt_routing(segments)

        self.assertEqual(len(routing), 2)
        self.assertEqual(routing[0]["model_name"], "small")
        self.assertEqual(routing[0]["segment_count"], 2)
        self.assertEqual(routing[1]["model_name"], "large")
        self.assertEqual(routing[1]["chunk_difficulty"], 3)

    def test_raw_noisy_long_audio_forces_chunking_even_after_denoise(self) -> None:
        preprocessor = WhisperAudioPreprocessor()
        fake_samples = np.zeros(preprocessor.sample_rate * 120, dtype=np.float32)

        def fake_load_audio(_audio_path: str) -> np.ndarray:
            preprocessor._last_load_metadata = {
                "raw_noisy": True,
                "ffmpeg_denoised": True,
                "stationary_noise_suppressed": False,
                "quality_flags": ["raw_noise_detected", "ffmpeg_denoised"],
            }
            return fake_samples

        with patch.object(WhisperAudioPreprocessor, "load_audio", side_effect=fake_load_audio):
            result = preprocessor.prepare("/tmp/noisy-meeting.m4a")

        self.assertTrue(result.chunking_enabled)
        self.assertEqual(result.strategy, "noisy_fixed_window_split")
        self.assertGreater(len(result.chunks), 1)
        self.assertTrue(result.is_noisy)
        self.assertGreater(result.chunks[0].end_seconds, result.chunks[0].core_end_seconds or 0)
        self.assertLess(result.chunks[1].start_seconds, result.chunks[1].core_start_seconds or 0)

    def test_dense_meeting_audio_does_not_force_noisy_split_too_early(self) -> None:
        preprocessor = WhisperAudioPreprocessor()
        fake_samples = np.zeros(preprocessor.sample_rate * 120, dtype=np.float32)

        with patch.object(WhisperAudioPreprocessor, "_estimate_energy_profile", return_value={"active_ratio": 0.8, "noise_floor": 0.1, "peak": 1.0, "threshold": 0.16}), \
             patch.object(WhisperAudioPreprocessor, "_looks_noisy", return_value=False):
            forced = preprocessor._should_force_quality_split(fake_samples, 120.0)

        self.assertFalse(forced)

    def test_noisy_meeting_uses_noisy_model_selection(self) -> None:
        service = WhisperSpeechToTextService(model_name="large", language="ko")
        noisy_preprocessing = type(
            "Preprocessing",
            (),
            {
                "is_noisy": True,
                "duration_seconds": 765.0,
            },
        )()
        calm_preprocessing = type(
            "Preprocessing",
            (),
            {
                "is_noisy": False,
                "duration_seconds": 765.0,
            },
        )()

        with patch.object(WhisperSpeechToTextService, "_is_model_cached", return_value=True):
            self.assertEqual(service._select_model_name(noisy_preprocessing), "large")
            self.assertEqual(service._select_model_name(calm_preprocessing), "small")

        with patch.object(WhisperSpeechToTextService, "_is_model_cached", return_value=False):
            self.assertEqual(service._select_model_name(noisy_preprocessing), "large")
            self.assertEqual(service._select_model_name(calm_preprocessing), "large")

    def test_chunk_model_selection_uses_small_for_easy_chunks_and_large_for_hard_chunks(self) -> None:
        service = WhisperSpeechToTextService(model_name="large", language="ko")
        preprocessing = type(
            "Preprocessing",
            (),
            {
                "is_noisy": False,
                "duration_seconds": 707.0,
                "strategy": "silence_split",
                "quality_flags": [],
            },
        )()
        easy_chunk = type(
            "Chunk",
            (),
            {
                "start_seconds": 0.0,
                "end_seconds": 34.0,
                "core_start_seconds": 1.0,
                "core_end_seconds": 33.0,
            },
        )()
        hard_chunk = type(
            "Chunk",
            (),
            {
                "start_seconds": 0.0,
                "end_seconds": 96.0,
                "core_start_seconds": 8.0,
                "core_end_seconds": 68.0,
            },
        )()

        with patch.object(WhisperSpeechToTextService, "_is_model_cached", return_value=True):
            self.assertEqual(service._select_chunk_model_name(preprocessing, easy_chunk), "small")
            self.assertEqual(service._select_chunk_model_name(preprocessing, hard_chunk), "large")

    def test_segment_core_region_filter_uses_midpoint(self) -> None:
        self.assertTrue(WhisperSpeechToTextService._is_segment_in_core_region(29.0, 31.0, 30.0, 60.0))
        self.assertFalse(WhisperSpeechToTextService._is_segment_in_core_region(27.0, 29.0, 30.0, 60.0))


if __name__ == "__main__":
    unittest.main()
