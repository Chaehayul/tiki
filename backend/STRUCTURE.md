# TIKI Backend Structure

FastAPI와 PostgreSQL을 기준으로 한 백엔드 작업 구조입니다.

## 담당 영역

### 역할 1: AI 엔진 & 데이터 처리

주 작업 폴더:

- `app/services/ai/`

담당 기능:

- Whisper 기반 STT 처리
- LLM 요약 및 티켓 추출
- 프롬프트 템플릿, AI 결과 후처리

주의:

- FastAPI 라우터, DB 세션 생성, 외부 API 토큰 관리는 직접 수정하지 않습니다.
- DB 저장이 필요하면 `schemas` 또는 `models` 변경이 필요한지 역할 2와 먼저 맞춥니다.

### 역할 2: 데이터 파이프라인 & 비동기 큐

주 작업 폴더:

- `app/api/`
- `app/db/`
- `app/models/`
- `app/schemas/`
- `app/services/pipeline/`
- `app/integrations/`
- `app/workers/`

담당 기능:

- FastAPI 엔드포인트 설계
- PostgreSQL 스키마와 SQLAlchemy 모델
- BackgroundTasks, Celery/Redis 큐 흐름
- Jira, Notion API 연동
- 개인정보 마스킹 게이트웨이

## 공용 규칙

- API 라우터는 `app/api/v1/` 아래에 둡니다.
- DB 연결은 `app/db/database.py`의 `get_db`를 사용합니다.
- ORM 모델은 `app/models/`, 요청/응답 스키마는 `app/schemas/`에 분리합니다.
- AI 로직은 FastAPI 라우터 안에 직접 작성하지 않고 `app/services/ai/`에서 호출합니다.
- 개인정보 마스킹은 AI 처리 전 파이프라인 단계에서 먼저 수행합니다.

## 환경 변수

`.env`에 PostgreSQL 접속 정보를 설정합니다.

```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/tiki
```

## 마이그레이션

PostgreSQL 스키마 변경은 Alembic으로 관리합니다.

```bash
alembic revision --autogenerate -m "create initial tables"
alembic upgrade head
```

## 상태 확인

- `GET /api/v1/health`: FastAPI 서버 상태 확인
- `GET /api/v1/health/db`: PostgreSQL 연결 상태 확인

## 프론트 업로드 연동 계약

현재 프론트의 `/upload` 화면은 Jira 프로젝트를 먼저 선택한 뒤 여러 오디오 파일을 업로드하는 흐름입니다.

- `POST /api/v1/uploads`
- 요청 형식: `multipart/form-data`
- 파일 필드명: `files`
- 프로젝트 필드명: `project_id`, `project_key`, `project_name`
- 현재 허용 확장자: `mp3`, `wav`, `m4a`, `aac`, `ogg`, `flac`
- 최대 파일 크기: 파일당 1GB
- 업로드 결과 조회: `GET /api/v1/uploads/{file_id}`

## 프론트 인증 연동 계약

현재 프론트의 `/login`, `/signup` 화면은 아직 mock 처리만 하므로 아래 API에 연결하면 됩니다.

- `POST /api/v1/auth/signup`
  - JSON: `name`, `email`, `password`, `role`
- `POST /api/v1/auth/login`
  - JSON: `email`, `password`
- `GET /api/v1/auth/me`
  - Header: `Authorization: Bearer <access_token>`

로그인과 회원가입 응답은 모두 `access_token`, `token_type`, `user`를 반환합니다.

## 공통 예외와 응답

- 공통 예외 처리는 `app/core/exceptions.py`에서 등록합니다.
- 공통 응답 스키마는 `app/schemas/common.py`에 둡니다.
