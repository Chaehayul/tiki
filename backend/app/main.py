from fastapi import FastAPI

app = FastAPI(title="TIKI Backend")


@app.get("/")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
