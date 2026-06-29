from __future__ import annotations

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.ai.audio_preprocessing import WhisperAudioPreprocessor
from app.services.ai.diarization import _normalize_diarization_turns
from app.services.ai.document_ingestion import load_document_file
from app.services.ai.llm_analysis import _estimate_model_tier
from app.services.ai.llm_analysis import _resolve_model_name_for_tier
from app.services.ai.llm_analysis import LangChainAnalysisService
from app.services.ai.llm_analysis import OpenAIAnalysisService
from app.services.ai.llm_analysis import build_llm_analysis_service
from app.services.ai.stt import _attach_speaker_labels
from app.services.ai.stt import WhisperSpeechToTextService
from app.services.ai.llm_analysis import HeuristicLLMAnalysisService
from app.services.ai.llm_analysis import _build_issue_sentence
from app.schemas.ai_input import build_ai_input_contract
from app.schemas.ai_input import normalize_source_kind
from app.services.ai.text_normalization import normalize_meeting_terms
from app.services.ai_engine import AIEngine
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

    def test_build_llm_analysis_service_prefers_langchain_when_available(self) -> None:
        with patch("app.services.ai.llm_analysis.settings.llm_analysis_provider", "langchain"), patch(
            "app.services.ai.llm_analysis.settings.openai_api_key",
            "test-key",
        ), patch(
            "app.services.ai.llm_analysis._langchain_dependencies_available",
            return_value=True,
        ):
            service = build_llm_analysis_service()

        self.assertIsInstance(service, LangChainAnalysisService)

    def test_build_llm_analysis_service_falls_back_to_heuristic_when_langchain_missing(self) -> None:
        with patch("app.services.ai.llm_analysis.settings.llm_analysis_provider", "langchain"), patch(
            "app.services.ai.llm_analysis.settings.openai_api_key",
            "test-key",
        ), patch(
            "app.services.ai.llm_analysis._langchain_dependencies_available",
            return_value=False,
        ):
            service = build_llm_analysis_service()

        self.assertIsInstance(service, HeuristicLLMAnalysisService)

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
        self.assertEqual(
            _build_speaker_fields(None),
            {
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "participant_name": None,
                "speaker_display_name": None,
                "speaker_kind": "unknown",
                "is_mapped": False,
            },
        )
        self.assertEqual(
            _build_speaker_fields("speaker_1"),
            {
                "speaker": "speaker_1",
                "speaker_id": "speaker_1",
                "speaker_label": "speaker_1",
                "participant_name": None,
                "speaker_display_name": "speaker_1",
                "speaker_kind": "generic",
                "is_mapped": False,
            },
        )

    def test_sentence_segments_include_speaker_placeholders(self) -> None:
        segments = _build_sentence_segments("회의 시작하겠습니다. 준비됐습니다.")

        self.assertEqual(len(segments), 2)
        self.assertTrue(all(segment["speaker"] is None for segment in segments))
        self.assertTrue(all(segment["speaker_id"] is None for segment in segments))
        self.assertTrue(all(segment["speaker_label"] is None for segment in segments))
        self.assertTrue(all(segment["speaker_display_name"] is None for segment in segments))
        self.assertTrue(all(segment["speaker_kind"] == "unknown" for segment in segments))

    def test_whisper_model_selection_routes_by_profile(self) -> None:
        service = WhisperSpeechToTextService(language="ko")
        preprocessing = SimpleNamespace(
            is_noisy=False,
            chunking_enabled=False,
            duration_seconds=45.0,
        )
        chunk = SimpleNamespace(start_seconds=0.0, end_seconds=120.0)

        with patch("app.services.ai.stt.settings.whisper_light_model", "small-model"), patch(
            "app.services.ai.stt.settings.whisper_medium_model",
            "medium-model",
        ), patch(
            "app.services.ai.stt.settings.whisper_model",
            "large-model",
        ):
            small_service = WhisperSpeechToTextService(language="ko", transcription_profile="small")
            medium_service = WhisperSpeechToTextService(language="ko", transcription_profile="medium")
            large_service = WhisperSpeechToTextService(language="ko", transcription_profile="large")

            self.assertEqual(small_service._select_model_name(preprocessing), "small-model")
            self.assertEqual(small_service._select_chunk_model_name(preprocessing, chunk), "small-model")
            self.assertEqual(medium_service._select_model_name(preprocessing), "medium-model")
            self.assertEqual(medium_service._select_chunk_model_name(preprocessing, chunk), "medium-model")
            self.assertEqual(large_service._select_model_name(preprocessing), "large-model")
            self.assertEqual(large_service._select_chunk_model_name(preprocessing, chunk), "large-model")

    def test_whisper_device_resolution_prefers_cuda_then_mps_then_cpu(self) -> None:
        cuda_torch = SimpleNamespace(
            cuda=SimpleNamespace(is_available=lambda: True),
            backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: True)),
        )
        mps_torch = SimpleNamespace(
            cuda=SimpleNamespace(is_available=lambda: False),
            backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: True)),
        )
        cpu_torch = SimpleNamespace(
            cuda=SimpleNamespace(is_available=lambda: False),
            backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: False)),
        )

        with patch.dict("sys.modules", {"torch": cuda_torch}):
            self.assertEqual(WhisperSpeechToTextService._resolve_device_name(), "cuda")

        with patch.dict("sys.modules", {"torch": mps_torch}):
            self.assertEqual(WhisperSpeechToTextService._resolve_device_name(), "mps")

        with patch.dict("sys.modules", {"torch": cpu_torch}):
            self.assertEqual(WhisperSpeechToTextService._resolve_device_name(), "cpu")

    def test_whisper_load_model_forwards_device_name(self) -> None:
        fake_whisper = SimpleNamespace(load_model=SimpleNamespace())
        fake_whisper.load_model = unittest.mock.MagicMock(return_value="loaded-model")
        fake_torch = SimpleNamespace(
            cuda=SimpleNamespace(is_available=lambda: False),
            backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: False)),
        )

        with patch.dict("sys.modules", {"whisper": fake_whisper, "torch": fake_torch}):
            model = WhisperSpeechToTextService._load_model("small", "mps")

        self.assertEqual(model, "loaded-model")
        fake_whisper.load_model.assert_called_once_with("small", device="mps")

    def test_faster_whisper_adapter_normalizes_output(self) -> None:
        fake_segment = SimpleNamespace(
            start=0.0,
            end=1.25,
            text="안녕하세요",
            tokens=[1, 2, 3],
            avg_logprob=-0.12,
            compression_ratio=1.05,
            no_speech_prob=0.01,
        )
        fake_info = SimpleNamespace(language="ko", language_probability=0.98)
        fake_model = SimpleNamespace(transcribe=unittest.mock.MagicMock(return_value=(iter([fake_segment]), fake_info)))
        fake_whisper_module = SimpleNamespace(WhisperModel=unittest.mock.MagicMock(return_value=fake_model))
        fake_torch = SimpleNamespace(
            cuda=SimpleNamespace(is_available=lambda: True),
            backends=SimpleNamespace(mps=SimpleNamespace(is_available=lambda: False)),
        )

        with patch.dict("sys.modules", {"faster_whisper": fake_whisper_module, "torch": fake_torch}):
            adapter = WhisperSpeechToTextService._load_model("small", "cuda", "faster-whisper")

        self.assertEqual(adapter.model_name, "small")
        self.assertEqual(adapter.device_name, "cuda")
        self.assertEqual(adapter.compute_type, "float16")
        fake_whisper_module.WhisperModel.assert_called_once_with("small", device="cuda", compute_type="float16")

        result = adapter.transcribe(np.zeros(16_000, dtype=np.float32), fp16=True, logprob_threshold=-1.0, verbose=False)
        self.assertEqual(result["text"], "안녕하세요")
        self.assertEqual(result["language"], "ko")
        self.assertEqual(result["segments"][0]["text"], "안녕하세요")
        self.assertEqual(result["segments"][0]["start"], 0.0)
        self.assertEqual(result["segments"][0]["end"], 1.25)
        self.assertEqual(result["segments"][0]["avg_logprob"], -0.12)

    def test_whisper_fp16_enabled_only_on_cuda(self) -> None:
        service = WhisperSpeechToTextService(language="ko", transcription_profile="balanced")
        preprocessing = SimpleNamespace(is_noisy=False, chunking_enabled=True)

        service.device_name = "cuda"
        cuda_options = service._build_transcription_options(preprocessing)

        service.device_name = "mps"
        mps_options = service._build_transcription_options(preprocessing)

        service.device_name = "cpu"
        cpu_options = service._build_transcription_options(preprocessing)

        self.assertTrue(cuda_options["fp16"])
        self.assertFalse(mps_options["fp16"])
        self.assertFalse(cpu_options["fp16"])

    def test_transcription_profiles_adjust_decoding_budget(self) -> None:
        light_service = WhisperSpeechToTextService(model_name="large", language="ko", transcription_profile="light")
        premium_service = WhisperSpeechToTextService(
            model_name="large",
            language="ko",
            transcription_profile="premium",
        )
        calm_preprocessing = SimpleNamespace(is_noisy=False, chunking_enabled=True)
        noisy_preprocessing = SimpleNamespace(is_noisy=True, chunking_enabled=True)

        light_options = light_service._build_transcription_options(calm_preprocessing)
        light_noisy_options = light_service._build_transcription_options(noisy_preprocessing)
        premium_options = premium_service._build_transcription_options(calm_preprocessing)

        self.assertEqual(light_service.transcription_profile, "light")
        self.assertEqual(light_service.preprocessor.min_chunk_seconds, 60.0)
        self.assertEqual(light_service.preprocessor.transcription_overlap_seconds, 0.15)
        self.assertEqual(light_service.preprocessor.noisy_chunk_overlap_seconds, 0.8)
        self.assertEqual(light_service.preprocessor.max_chunk_seconds, 240.0)
        self.assertEqual(light_options["beam_size"], 1)
        self.assertEqual(light_options["best_of"], 1)
        self.assertEqual(light_noisy_options["beam_size"], 1)
        self.assertEqual(light_noisy_options["best_of"], 1)
        self.assertEqual(premium_service.transcription_profile, "premium")
        self.assertEqual(premium_service.preprocessor.transcription_overlap_seconds, 1.0)
        self.assertEqual(premium_options["beam_size"], 5)
        self.assertEqual(premium_options["best_of"], 5)

    def test_transcription_profile_accepts_small_medium_large_aliases(self) -> None:
        small_service = WhisperSpeechToTextService(model_name="large", language="ko", transcription_profile="small")
        medium_service = WhisperSpeechToTextService(model_name="large", language="ko", transcription_profile="medium")
        large_service = WhisperSpeechToTextService(model_name="large", language="ko", transcription_profile="large")

        self.assertEqual(small_service.transcription_profile, "light")
        self.assertEqual(medium_service.transcription_profile, "balanced")
        self.assertEqual(large_service.transcription_profile, "premium")

    def test_light_profile_promotes_long_meeting_audio_to_medium_model(self) -> None:
        service = WhisperSpeechToTextService(model_name="large-model", language="ko", transcription_profile="light")
        preprocessing = SimpleNamespace(duration_seconds=707.869, chunking_enabled=True)

        self.assertEqual(service._select_model_name(preprocessing), "medium")

    def test_llm_tier_estimation_routes_short_and_long_inputs(self) -> None:
        short_tier = _estimate_model_tier("회의를 시작하겠습니다. 결제 기능을 우선 보겠습니다.")
        long_tier = _estimate_model_tier(
            " ".join(["오늘은 사내 업무관리시스템 구축과 로그인, 결제, 일정, 리스크, 테스트, 배포를 순차적으로 점검합니다."] * 60),
            context={"extra": {"audio_preprocessing": {"raw_noisy": True}}},
        )

        self.assertEqual(short_tier, "small")
        self.assertEqual(long_tier, "large")

    def test_resolve_model_name_for_tier_prefers_tier_specific_settings(self) -> None:
        with patch("app.services.ai.llm_analysis.settings.openai_small_model", "model-small"), patch(
            "app.services.ai.llm_analysis.settings.openai_medium_model",
            "model-medium",
        ), patch(
            "app.services.ai.llm_analysis.settings.openai_large_model",
            "model-large",
        ):
            self.assertEqual(_resolve_model_name_for_tier("small"), "model-small")
            self.assertEqual(_resolve_model_name_for_tier("medium"), "model-medium")
            self.assertEqual(_resolve_model_name_for_tier("large"), "model-large")

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
        self.assertIsNone(rows[0]["who"])
        self.assertEqual(rows[0]["when"], "00:12")
        self.assertEqual(rows[0]["speaker_id"], None)
        self.assertEqual(rows[0]["speaker_label"], None)
        self.assertIsNone(rows[0]["speaker_display_name"])
        self.assertIsNone(rows[0]["participant_name"])
        self.assertEqual(rows[0]["what"], "회의를 시작하겠습니다.")
        self.assertEqual(rows[1]["spk"], "speaker_2")
        self.assertEqual(rows[1]["who"], "채하율")
        self.assertEqual(rows[1]["when"], "00:35")
        self.assertEqual(rows[1]["speaker_id"], "speaker_2")
        self.assertEqual(rows[1]["speaker_label"], "채하율")
        self.assertEqual(rows[1]["speaker_display_name"], "채하율")
        self.assertEqual(rows[1]["what"], "준비됐습니다.")

    def test_attach_speaker_labels_discards_tiny_extra_speaker(self) -> None:
        segments = [
            {
                "index": 0,
                "start_seconds": 0.0,
                "end_seconds": 100.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "첫 번째 발화입니다.",
            },
            {
                "index": 1,
                "start_seconds": 100.0,
                "end_seconds": 200.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "두 번째 발화입니다.",
            },
            {
                "index": 2,
                "start_seconds": 240.0,
                "end_seconds": 243.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "짧은 끼어들기입니다.",
            },
        ]
        turns = [
            {"start_seconds": 0.0, "end_seconds": 60.0, "speaker_id": "SPEAKER_00"},
            {"start_seconds": 60.0, "end_seconds": 120.0, "speaker_id": "SPEAKER_01"},
            {"start_seconds": 120.0, "end_seconds": 180.0, "speaker_id": "SPEAKER_02"},
            {"start_seconds": 180.0, "end_seconds": 240.0, "speaker_id": "SPEAKER_03"},
            {"start_seconds": 240.0, "end_seconds": 243.0, "speaker_id": "SPEAKER_04"},
        ]

        annotated, summary = _attach_speaker_labels(segments, turns, meeting_duration_seconds=243.0)

        self.assertEqual(summary["speaker_count"], 4)
        self.assertEqual(summary["raw_speaker_count"], 5)
        self.assertEqual(summary["discarded_speaker_count"], 1)
        self.assertEqual(summary["expected_participant_count"], None)
        self.assertEqual(summary["validation_status"], "unknown")
        self.assertIn("SPEAKER_04", summary["ignored_speaker_ids"])
        self.assertEqual(annotated[-1]["speaker_label"], "기타")
        self.assertEqual(annotated[-1]["speaker_kind"], "minor")

    def test_attach_speaker_labels_discards_short_two_turn_extra_speaker(self) -> None:
        segments = [
            {
                "index": 0,
                "start_seconds": 0.0,
                "end_seconds": 40.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "첫 번째 발화입니다.",
            },
            {
                "index": 1,
                "start_seconds": 40.0,
                "end_seconds": 80.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "두 번째 발화입니다.",
            },
            {
                "index": 2,
                "start_seconds": 80.0,
                "end_seconds": 120.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "세 번째 발화입니다.",
            },
            {
                "index": 3,
                "start_seconds": 120.0,
                "end_seconds": 160.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "네 번째 발화입니다.",
            },
            {
                "index": 4,
                "start_seconds": 160.0,
                "end_seconds": 164.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "짧은 두 번 발화입니다.",
            },
            {
                "index": 5,
                "start_seconds": 164.0,
                "end_seconds": 167.2,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "짧은 두 번째 발화입니다.",
            },
        ]
        turns = [
            {"start_seconds": 0.0, "end_seconds": 40.0, "speaker_id": "SPEAKER_00"},
            {"start_seconds": 40.0, "end_seconds": 80.0, "speaker_id": "SPEAKER_01"},
            {"start_seconds": 80.0, "end_seconds": 120.0, "speaker_id": "SPEAKER_02"},
            {"start_seconds": 120.0, "end_seconds": 160.0, "speaker_id": "SPEAKER_03"},
            {"start_seconds": 160.0, "end_seconds": 162.0, "speaker_id": "SPEAKER_04"},
            {"start_seconds": 165.0, "end_seconds": 167.2, "speaker_id": "SPEAKER_04"},
        ]

        annotated, summary = _attach_speaker_labels(segments, turns, meeting_duration_seconds=167.2)

        self.assertEqual(summary["speaker_count"], 4)
        self.assertEqual(summary["raw_speaker_count"], 5)
        self.assertEqual(summary["discarded_speaker_count"], 1)
        self.assertIn("SPEAKER_04", summary["ignored_speaker_ids"])
        self.assertEqual(annotated[-1]["speaker_label"], "기타")
        self.assertEqual(annotated[-1]["speaker_kind"], "minor")

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

        annotated, summary = _attach_speaker_labels(segments, turns, meeting_duration_seconds=15.0)

        self.assertEqual(summary["status"], "applied")
        self.assertEqual(summary["speaker_count"], 2)
        self.assertEqual(summary["turn_count"], 2)
        self.assertAlmostEqual(summary["total_speech_seconds"], 15.0)
        self.assertAlmostEqual(summary["meeting_duration_seconds"], 15.0)
        self.assertEqual(len(summary["speaker_statistics"]), 2)
        self.assertAlmostEqual(summary["speaker_statistics"][0]["speech_seconds"], 6.0)
        self.assertAlmostEqual(summary["speaker_statistics"][0]["speech_ratio"], 0.4)
        self.assertAlmostEqual(summary["speaker_statistics"][0]["meeting_ratio"], 0.4)
        self.assertAlmostEqual(summary["speaker_statistics"][1]["speech_seconds"], 9.0)
        self.assertAlmostEqual(summary["speaker_statistics"][1]["speech_ratio"], 0.6)
        self.assertAlmostEqual(summary["speaker_statistics"][1]["meeting_ratio"], 0.6)
        self.assertEqual(annotated[0]["speaker_label"], "팀원 1")
        self.assertEqual(annotated[0]["speaker_id"], "SPEAKER_00")
        self.assertEqual(annotated[1]["speaker_label"], "팀원 2")
        self.assertEqual(annotated[2]["speaker_label"], "팀원 2")

    def test_attach_speaker_labels_maps_speakers_to_participant_names_by_speech_rank(self) -> None:
        segments = [
            {
                "index": 0,
                "start_seconds": 0.0,
                "end_seconds": 4.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "회의를 시작하겠습니다.",
            },
            {
                "index": 1,
                "start_seconds": 4.1,
                "end_seconds": 12.0,
                "speaker": None,
                "speaker_id": None,
                "speaker_label": None,
                "text": "네, 준비됐습니다.",
            },
        ]
        turns = [
            {"start_seconds": 0.0, "end_seconds": 4.0, "speaker_id": "SPEAKER_00"},
            {"start_seconds": 4.0, "end_seconds": 12.0, "speaker_id": "SPEAKER_01"},
        ]

        annotated, summary = _attach_speaker_labels(
            segments,
            turns,
            meeting_duration_seconds=12.0,
            participant_names=["김소현", "정아름"],
        )

        self.assertEqual(summary["speaker_participant_mapping"][0]["participant_name"], "김소현")
        self.assertEqual(summary["speaker_participant_mapping"][1]["participant_name"], "정아름")
        self.assertEqual(summary["expected_participant_count"], 2)
        self.assertEqual(summary["mapped_participant_count"], 2)
        self.assertEqual(summary["validation_status"], "ok")
        self.assertEqual(annotated[0]["speaker_label"], "정아름")
        self.assertEqual(annotated[1]["speaker_label"], "김소현")
        self.assertEqual(summary["speaker_statistics"][0]["participant_name"], "정아름")
        self.assertEqual(summary["speaker_statistics"][1]["participant_name"], "김소현")

    def test_diarization_turn_normalization_merges_small_gaps(self) -> None:
        turns = [
            {"start_seconds": 0.0, "end_seconds": 3.0, "speaker_id": "SPEAKER_00"},
            {"start_seconds": 3.2, "end_seconds": 5.0, "speaker_id": "SPEAKER_00"},
            {"start_seconds": 6.0, "end_seconds": 8.0, "speaker_id": "SPEAKER_01"},
        ]

        normalized = _normalize_diarization_turns(turns)

        self.assertEqual(len(normalized), 2)
        self.assertEqual(normalized[0]["speaker_id"], "SPEAKER_00")
        self.assertAlmostEqual(normalized[0]["start_seconds"], 0.0)
        self.assertAlmostEqual(normalized[0]["end_seconds"], 5.0)
        self.assertEqual(normalized[1]["speaker_id"], "SPEAKER_01")

    def test_preprocessor_applies_boundary_overlap_to_chunks(self) -> None:
        preprocessor = WhisperAudioPreprocessor(transcription_overlap_seconds=1.0, noisy_chunk_overlap_seconds=2.5)

        clean_specs = preprocessor._apply_overlap_to_intervals([(10.0, 20.0), (20.0, 30.0)], 30.0, overlap_seconds=1.0)
        noisy_specs = preprocessor._apply_overlap_to_intervals([(10.0, 20.0), (20.0, 30.0)], 30.0, overlap_seconds=2.5)

        self.assertEqual(clean_specs[0], (10.0, 21.0, 10.0, 20.0))
        self.assertEqual(clean_specs[1], (19.0, 30.0, 20.0, 30.0))
        self.assertEqual(noisy_specs[0], (10.0, 22.5, 10.0, 20.0))
        self.assertEqual(noisy_specs[1], (17.5, 30.0, 20.0, 30.0))

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

        section_types = [section["section_type"] for section in document["sections"]]

        self.assertEqual(document["version"], "v2")
        self.assertEqual(document["contract_version"], "v2")
        self.assertEqual(document["meeting_title"], "주간 회의")
        self.assertEqual(document["project_name"], "TIKI")
        self.assertEqual(document["source_text"], "회의를 시작하겠습니다. 결제 기능을 우선 보겠습니다.")
        self.assertEqual(document["masked_source_text"], "회의를 시작하겠습니다. 결제 기능을 우선 보겠습니다.")
        self.assertIn("기능 우선순위", document["keywords"])
        self.assertIn("결제 기능을 우선 진행하기로 했다.", document["search_text"])
        self.assertEqual(document["indexed_text"], document["search_text"])
        self.assertIn("summary", section_types)
        self.assertIn("keywords", section_types)
        self.assertIn("decision", section_types)
        self.assertIn("action_item", section_types)
        self.assertIn("transcript", section_types)
        self.assertTrue(document["chunks"])
        self.assertTrue(any(chunk["search_text"] for chunk in document["chunks"]))
        self.assertIn("회의를 시작하겠습니다", document["search_text"])

    def test_ai_result_contains_script_segments_and_tx_rows(self) -> None:
        service = AIEngine(llm_service=HeuristicLLMAnalysisService())
        result = service.process_text(
            "정아름: 회의를 시작하겠습니다. 김소현: 네, 준비됐습니다."
        )

        ai_input_contract = result.analysis.extra_data.get("ai_input_contract", {})
        script_segments = result.analysis.extra_data.get("script_segments", [])
        tx_rows = result.analysis.extra_data.get("tx", [])

        self.assertTrue(ai_input_contract)
        self.assertEqual(ai_input_contract["contract_version"], "v1")
        self.assertEqual(ai_input_contract["source_kind"], "text")
        self.assertEqual(
            ai_input_contract["source_text"],
            "정아름: 회의를 시작하겠습니다. 김소현: 네, 준비됐습니다.",
        )
        self.assertTrue(ai_input_contract["chunks"])
        self.assertEqual(ai_input_contract["chunks"][0]["chunk_kind"], "segment")
        self.assertTrue(script_segments)
        self.assertTrue(tx_rows)
        self.assertEqual(script_segments[0]["contract_version"], "v1")
        self.assertEqual(script_segments[0]["speaker"], None)
        self.assertIsNone(script_segments[0]["who"])
        self.assertIsNone(script_segments[0]["when"])
        self.assertEqual(script_segments[0]["what"], "정아름: 회의를 시작하겠습니다.")
        self.assertEqual(script_segments[0]["segment_label"], "[SEGMENT 1]")
        self.assertEqual(script_segments[0]["source"], "text")
        self.assertEqual(script_segments[0]["text"], "정아름: 회의를 시작하겠습니다.")
        self.assertEqual(tx_rows[0]["contract_version"], "v1")
        self.assertIsNone(tx_rows[0]["who"])
        self.assertIsNone(tx_rows[0]["when"])
        self.assertEqual(tx_rows[0]["what"], "정아름: 회의를 시작하겠습니다.")
        self.assertEqual(tx_rows[0]["txt"], "정아름: 회의를 시작하겠습니다.")
        self.assertEqual(tx_rows[0]["segment_label"], "[SEGMENT 1]")
        self.assertEqual(tx_rows[0]["source"], "text")

    def test_ai_input_contract_normalizes_source_kind_and_chunks(self) -> None:
        contract = build_ai_input_contract(
            source_kind="  DOCUMENT  ",
            source_text="  문서 원문  ",
            masked_source_text="  문서 마스킹  ",
            source_name="  report.pdf  ",
            source_path="  /tmp/report.pdf  ",
            source_title="  주간 보고서  ",
            chunks=[
                {
                    "index": 0,
                    "chunk_kind": " section ",
                    "title": "  개요  ",
                    "text": "  1. 개요  ",
                    "masked_text": "  1. 개요  ",
                    "metadata": {"page": 1, "note": ""},
                }
            ],
            context={"project_name": "  TIKI  ", "empty": ""},
            metadata={"source": "  upload  ", "unused": None},
        )

        self.assertEqual(normalize_source_kind("DOCUMENT"), "document")
        self.assertEqual(contract.contract_version, "v1")
        self.assertEqual(contract.source_kind, "document")
        self.assertEqual(contract.source_name, "report.pdf")
        self.assertEqual(contract.source_path, "/tmp/report.pdf")
        self.assertEqual(contract.source_title, "주간 보고서")
        self.assertEqual(contract.source_text, "문서 원문")
        self.assertEqual(contract.masked_source_text, "문서 마스킹")
        self.assertEqual(contract.context, {"project_name": "  TIKI  "})
        self.assertEqual(contract.metadata, {"source": "  upload  "})
        self.assertEqual(contract.chunks[0].chunk_kind, "section")
        self.assertEqual(contract.chunks[0].title, "개요")
        self.assertEqual(contract.chunks[0].text, "1. 개요")
        self.assertEqual(contract.chunks[0].masked_text, "1. 개요")
        self.assertEqual(contract.chunks[0].metadata, {"page": 1})

    def test_document_loader_extracts_pdf_text_and_chunks(self) -> None:
        sample_path = Path(
            "/Users/jiyoung/문서/내파일/study/내 문서/협업/최종프로젝트/데이터소스/문서파일/sample_meeting_ops_easy.pdf"
        )

        result = load_document_file(sample_path)

        self.assertEqual(result.source_kind, "document")
        self.assertEqual(result.extraction_method, "document_pdf")
        self.assertEqual(result.page_count, 2)
        self.assertTrue(result.metadata.get("source_title"))
        self.assertGreaterEqual(len(result.chunks), 2)
        self.assertIn("운영팀 주간 회의록", result.text)
        self.assertIn("AI 회의록 솔루션", result.text)
        self.assertIn("Jira", result.text)

    def test_document_processing_uses_document_contract(self) -> None:
        sample_path = Path(
            "/Users/jiyoung/문서/내파일/study/내 문서/협업/최종프로젝트/데이터소스/문서파일/sample_meeting_ops_easy.pdf"
        )
        service = AIEngine(llm_service=HeuristicLLMAnalysisService())

        result = service.process_document(str(sample_path))
        analysis_dict = result.analysis.to_dict()
        ai_input_contract = analysis_dict["extra_data"]["ai_input_contract"]

        self.assertEqual(analysis_dict["contract_version"], "v1")
        self.assertEqual(ai_input_contract["source_kind"], "document")
        self.assertEqual(analysis_dict["extra_data"]["document_extraction"]["page_count"], 2)
        self.assertEqual(analysis_dict["extra_data"]["document_extraction"]["source_kind"], "document")
        self.assertEqual(analysis_dict["extra_data"]["source_kind"], "document")
        self.assertIn("document_summary", analysis_dict["extra_data"])
        self.assertEqual(analysis_dict["extra_data"]["document_summary"]["source_kind"], "document")
        self.assertIn("document_summary", result.to_dict()["meeting_minutes"])
        self.assertIn("운영팀 주간 회의록", result.transcript)
        self.assertTrue(analysis_dict["extra_data"]["search_document"]["sections"])

    def test_ai_output_contract_includes_summary_request_and_fixed_fields(self) -> None:
        service = AIEngine(llm_service=HeuristicLLMAnalysisService())
        result = service.process_text(
            "정아름: 회의를 시작하겠습니다. 김소현: 네, 준비됐습니다.",
            rag_context={
                "summary_request": {
                    "focus": "주요 결정",
                    "prompt": "5줄 이내로 정리해줘",
                    "length": "간결",
                }
            },
        )

        analysis_dict = result.analysis.to_dict()
        result_dict = result.to_dict()
        summary_request = analysis_dict["summary_request"]
        extra_data = analysis_dict["extra_data"]

        self.assertEqual(analysis_dict["contract_version"], "v1")
        self.assertEqual(result_dict["analysis_contract_version"], "v1")
        self.assertEqual(summary_request["contract_version"], "v1")
        self.assertEqual(summary_request["focus"], "주요 결정")
        self.assertEqual(summary_request["prompt"], "5줄 이내로 정리해줘")
        self.assertEqual(summary_request["length"], "간결")
        self.assertIn("summary", extra_data)
        self.assertIn("keywords", extra_data)
        self.assertIn("decisions", extra_data)
        self.assertIn("action_items", extra_data)
        self.assertIn("issues", extra_data)
        self.assertIn("next_agenda", extra_data)
        self.assertIn("search_document", extra_data)
        self.assertEqual(
            extra_data["analysis_output_fields"],
            ["meeting_title", "summary", "keywords", "decisions", "action_items", "issues", "next_agenda", "search_document"],
        )
        self.assertEqual(result_dict["meeting_minutes"]["summary_request"]["focus"], "주요 결정")
        self.assertEqual(result_dict["meeting_minutes"]["search_document"]["contract_version"], "v2")
        self.assertIn("meeting_title", extra_data["analysis_output_fields"])
        self.assertEqual(extra_data["analysis_output_fields"][0], "meeting_title")
        self.assertTrue(result_dict["meeting_minutes"]["meeting_title"])

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
        self.assertIn("업무관리시스템", result["meeting_title"])
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

    def test_action_items_ignore_acknowledgements_and_summary_lines(self) -> None:
        transcript = """
정아름: 다들 왔죠? 그럼 회의 시작하겠습니다.
김소현: 네 알겠습니다.
채하율: 네, 준비됐습니다.
송지영: 저도 준비됐습니다.
정아름: 오늘 회의 목적은 사내 업무관리시스템 구축 프로젝트 일정이랑 업무 분담을 정하는 겁니다.
김소현: 요구사항 명세서는 김소현님이 진행하고 7월 12일까지 완료하는 걸로 하겠습니다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)
        titles = [item["title"] for item in result["action_items"]]
        descriptions = [item["description"] for item in result["action_items"]]

        self.assertTrue(any("요구사항 명세서" in title for title in titles), titles)
        self.assertFalse(any("준비됐습니다" in text for text in titles + descriptions), result["action_items"])
        self.assertFalse(any("업무관리시스템 정리" in title for title in titles), titles)

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
        self.assertTrue(all(len(title) <= 96 for title in issue_titles), issue_titles)

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
        self.assertTrue(all(item.startswith("다음 회의에서") for item in result["next_agenda"]), result["next_agenda"])
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
        self.assertTrue(all(item.startswith("다음 회의에서") for item in result["next_agenda"]), result["next_agenda"])
        self.assertTrue(any(item.endswith("한다.") for item in result["next_agenda"]), result["next_agenda"])
        self.assertTrue(any("다음 회의" in item for item in result["next_agenda"]), result["next_agenda"])
        self.assertFalse(any("다시 보죠" in item for item in result["next_agenda"]), result["next_agenda"])

    def test_next_agenda_collapses_repeated_clauses(self) -> None:
        transcript = """
송지영: 다음 회의에서는 추가 기능 요청이 들어올 경우에 어떻게 대응할지 이야기해봅시다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertTrue(result["next_agenda"], result["next_agenda"])
        self.assertTrue(all(item.startswith("다음 회의에서") for item in result["next_agenda"]), result["next_agenda"])
        self.assertTrue(any("추가 기능 요청" in item for item in result["next_agenda"]), result["next_agenda"])
        self.assertFalse(any(item.count("다음 회의에서") > 1 for item in result["next_agenda"]), result["next_agenda"])
        self.assertFalse(any("대응 방안을 다음 회의에서 논의한다 대응 방안을" in item for item in result["next_agenda"]), result["next_agenda"])

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
        self.assertTrue(result["summary"].startswith("회의에서는"))
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

    def test_action_items_are_capped_to_project_limit(self) -> None:
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

        self.assertLessEqual(len(result["action_items"]), 12)
        self.assertTrue(any("업무관리시스템" in item["title"] for item in result["action_items"]))
        self.assertTrue(any("로그인" in item["title"] for item in result["action_items"]))
        self.assertTrue(any("업무 등록" in item["title"] for item in result["action_items"]))

    def test_action_items_can_expand_up_to_hundred_items(self) -> None:
        transcript = "\n".join(
            f"정아름: 테스트 작업 {i}를 진행하겠습니다." for i in range(120)
        )

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertLessEqual(len(result["action_items"]), 100)

    def test_missing_assignee_falls_back_to_mi_jung(self) -> None:
        transcript = """
정아름: 결제 기능은 필수라고 생각합니다. 진행하겠습니다.
"""

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertTrue(result["action_items"])
        self.assertEqual(result["action_items"][0]["assignee"], "미정")

    def test_project_kickoff_meeting_is_rewritten_into_sample_style(self) -> None:
        transcript = """
정아름: 오늘 회의 목적은 사내 업무관리시스템 구축 프로젝트 일정이랑 업무 분담을 정하는 겁니다. 대표님께서도 올해 안에 꼭 오픈하라고 말씀하셔서 일정을 현실적으로 잡아야 할 것 같아요.
김소현: 기본적으로 업무 등록 기능, 일정 관리 기능, 결재 기능, 공지사항 기능, 그리고 관리자 페이지가 있습니다.
김소현: 직원 약 150명 정도를 예상하고 있습니다.
채하율: 결재 기능은 필수라고 생각합니다.
채하율: 요구사항 명세서는 김소현 님이 진행하고 7월 12일까지 가능합니다.
송지영: 디자인 중간 시안은 7월 15일, 최종 시안은 7월 22일 정도 생각하고 있습니다.
정아름: 그럼 우선순위를 정해보죠. 1순위는 업무 등록 및 담당자 지정. 2순위는 결재 기능. 3순위는 일정 관리. 4순위는 공지사항. 5순위는 관리자 기능.
채하율: 결재 기능이 현재 인사 시스템과 연동되는 걸로 알고 있습니다. 그런데 아직 연동 문서를 못 받았습니다.
송지영: 대표님이 디자인 피드백을 많이 주시는 편입니다. 그래서 이번에는 수정 요청 마감일을 정했으면 좋겠습니다. 7월 17일까지는 수정 요청을 받고 이후에는 긴급 수정만 반영하는 게 좋겠습니다.
정아름: 파일 첨부 기능은 1차 오픈에 포함하는 방향으로 검토합시다. 알림 기능은 2차 개발 후보로 분류하겠습니다.
채하율: 8월 21일부터 9월 10일까지 어떨까요?
"""

        result = self.service.summarize_and_extract_tickets(transcript)

        self.assertEqual(result["meeting_title"], "사내 업무관리시스템 구축 프로젝트 킥오프")
        self.assertIn("150명", result["summary"])
        self.assertIn("2026.09.30", result["summary"])
        self.assertTrue(any(tag["text"] == "기능 우선순위" for tag in result["keywords"]), result["keywords"])
        self.assertEqual(len(result["decisions"]), 3)
        self.assertGreaterEqual(len(result["action_items"]), 10)
        self.assertEqual(result["action_items"][0]["assignee"], "김소현")
        self.assertEqual(result["action_items"][0]["due_at"], "2026-07-05")
        self.assertTrue(any(issue["level"] == "high" for issue in result["issues"]), result["issues"])
        self.assertTrue(any("통합 테스트" in item for item in result["next_agenda"]), result["next_agenda"])

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

    def test_issue_titles_do_not_repeat_redundant_risk_phrases(self) -> None:
        title = self.service._build_issue_title("리스크 관리")
        sentence = _build_issue_sentence("리스크 관리")

        self.assertTrue(title, title)
        self.assertFalse("리스크 관리를 리스크를" in title, title)
        self.assertFalse("리스크 관리를 리스크를" in sentence, sentence)
        self.assertTrue(title.endswith("."), title)
        self.assertIn("리스크 관리", title, title)
        self.assertIn("리스크 관리", sentence, sentence)

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

    def test_noisy_meeting_keeps_profile_based_model_selection(self) -> None:
        service = WhisperSpeechToTextService(language="ko", transcription_profile="small")
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

        self.assertEqual(service._select_model_name(noisy_preprocessing), "medium")
        self.assertEqual(service._select_model_name(calm_preprocessing), "medium")

    def test_chunk_model_selection_tracks_profile(self) -> None:
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

        with patch("app.services.ai.stt.settings.whisper_model", "large-model"):
            service = WhisperSpeechToTextService(language="ko", transcription_profile="large")
            self.assertEqual(service._select_chunk_model_name(preprocessing, easy_chunk), "large-model")
            self.assertEqual(service._select_chunk_model_name(preprocessing, hard_chunk), "large-model")

    def test_segment_core_region_filter_uses_midpoint(self) -> None:
        self.assertTrue(WhisperSpeechToTextService._is_segment_in_core_region(29.0, 31.0, 30.0, 60.0))
        self.assertFalse(WhisperSpeechToTextService._is_segment_in_core_region(27.0, 29.0, 30.0, 60.0))

    def test_diarization_reuses_preprocessed_samples_when_available(self) -> None:
        service = WhisperSpeechToTextService(model_name="large", language="ko")
        fake_samples = np.zeros(16_000, dtype=np.float32)
        preprocessing = type(
            "Preprocessing",
            (),
            {
                "samples": fake_samples,
                "sample_rate": 16_000,
            },
        )()
        captured: dict[str, object] = {}

        class FakeDiarizationService:
            model_name = "fake-diarizer"

            def diarize(self, audio_path: str, *, samples=None, sample_rate=None):
                captured["audio_path"] = audio_path
                captured["samples"] = samples
                captured["sample_rate"] = sample_rate
                return []

        service._diarization_service = FakeDiarizationService()

        with patch("app.services.ai.stt.settings.diarization_enabled", True):
            turns, summary = service._diarize_audio(Path(__file__).resolve(), preprocessing=preprocessing)

        self.assertEqual(turns, [])
        self.assertEqual(summary["status"], "empty")
        self.assertIs(captured["samples"], fake_samples)
        self.assertEqual(captured["sample_rate"], 16_000)


if __name__ == "__main__":
    unittest.main()
