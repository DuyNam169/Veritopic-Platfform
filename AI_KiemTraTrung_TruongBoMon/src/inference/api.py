from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from psycopg2 import Error as DatabaseError

from src.inference.database import get_existing_titles
from src.config import MODEL_PATH
from src.inference.embedding import encode_titles
from src.inference.predict import rank_title_candidates


class Candidate(BaseModel):
    topic_id: int | str | None = None
    title: str = Field(min_length=1, max_length=1000)
    embedding: list[float] | None = None


class CheckTitleRequest(BaseModel):
    title: str = Field(min_length=1, max_length=1000)
    top_k: int = Field(default=10, ge=1, le=100)
    candidates: list[Candidate] | None = None


class SimilarTitle(BaseModel):
    topic_id: int | str | None
    title: str
    similarity: float
    percent: float
    warning: str


class CheckTitleResponse(BaseModel):
    query: str
    count: int
    results: list[SimilarTitle]


class EncodeTitlesRequest(BaseModel):
    titles: list[str] = Field(min_length=1, max_length=500)


class EncodeTitlesResponse(BaseModel):
    model_name: str
    embeddings: list[list[float]]


app = FastAPI(
    title="AI Kiểm Tra Trùng Đề Tài",
    version="1.0.0"
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post(
    "/api/v1/check-title",
    response_model=CheckTitleResponse
)
def check_title(request: CheckTitleRequest):
    title = request.title.strip()
    if not title:
        raise HTTPException(
            status_code=422,
            detail="title không được để trống."
        )

    if request.candidates is None:
        try:
            candidates = get_existing_titles()
        except DatabaseError as error:
            raise HTTPException(
                status_code=503,
                detail="Không thể kết nối database."
            ) from error
    else:
        candidates = [
            {
                "topic_id": candidate.topic_id,
                "title": candidate.title.strip(),
                "embedding": candidate.embedding,
            }
            for candidate in request.candidates
        ]

    if any(not candidate["title"] for candidate in candidates):
        raise HTTPException(
            status_code=422,
            detail="title trong candidates không được để trống."
        )

    try:
        results = rank_title_candidates(
            title,
            candidates,
            request.top_k
        )
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=503,
            detail="Không tìm thấy checkpoint model đã huấn luyện."
        ) from error

    return {
        "query": title,
        "count": len(results),
        "results": results
    }


@app.post(
    "/api/v1/encode-titles",
    response_model=EncodeTitlesResponse,
)
def encode_title_batch(request: EncodeTitlesRequest):
    titles = [title.strip() for title in request.titles]
    if any(not title for title in titles):
        raise HTTPException(
            status_code=422,
            detail="Các tên đề tài không được để trống.",
        )
    try:
        embeddings = encode_titles(titles).detach().cpu().tolist()
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=503,
            detail="Không tìm thấy checkpoint model đã huấn luyện.",
        ) from error
    return {
        "model_name": MODEL_PATH.name,
        "embeddings": embeddings,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)