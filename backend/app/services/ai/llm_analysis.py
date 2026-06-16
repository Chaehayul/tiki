"""LLM summary and ticket extraction service boundary."""


class LLMAnalysisService:
    def summarize_and_extract_tickets(self, transcript: str) -> dict:
        raise NotImplementedError
