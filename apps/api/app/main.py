from fastapi import FastAPI

from app.routers import auth, catalog, playlists, search

app = FastAPI(title="AURA API")
app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(search.router)
app.include_router(playlists.router)


@app.get("/health")
def health():
    return {"status": "ok"}
