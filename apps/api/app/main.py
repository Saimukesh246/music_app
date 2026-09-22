from fastapi import FastAPI

app = FastAPI(title="AURA API")


@app.get("/health")
def health():
    return {"status": "ok"}
