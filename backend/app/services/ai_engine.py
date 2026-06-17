import logging

# 로깅 설정 (운영/디버깅을 위해 필수)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def transcribe_audio(file_path: str) -> str:
    """
    [STT 엔진] 로컬 Whisper 모델을 사용해 오디오를 텍스트로 변환합니다.
    """
    logger.info(f"STT 시작: {file_path}")
    
    # [TODO] 여기서 whisper 모델 로드 및 변환 로직 구현
    # 예: model = whisper.load_model("base") / result = model.transcribe(file_path)
    
    return "이것은 Whisper를 통해 변환된 테스트 텍스트입니다."

def summarize_meeting(text: str) -> str:
    """
    [LLM 엔진] 프롬프트 엔지니어링을 통해 회의 내용을 요약하고 티켓을 추출합니다.
    """
    if not text:
        return "요약할 텍스트가 없습니다."

    logger.info("LLM 요약 및 티켓 추출 시작")
    
    # [TODO] 여기서 LangChain/OpenAI API 호출 로직 구현
    # 예: prompt = f"다음 회의록을 요약하고 Action Item을 추출해줘: {text}"
    
    return f"AI 요약본: {text[:100]}... [Action Item: 티켓 추출 데이터]"

def extract_tickets(summary: str) -> list:
    """
    [데이터 처리] 요약된 내용에서 Jira/Notion용 티켓 정보를 추출합니다.
    """
    logger.info("티켓 추출 로직 실행")
    
    # [TODO] 요약본에서 티켓 리스트 파싱 로직
    return [{"title": "티켓 테스트", "status": "To Do"}]