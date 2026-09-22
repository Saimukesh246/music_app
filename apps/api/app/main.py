from fastapi import FastAPI

from app.routers import (
    auth,
    catalog,
    favorites,
    history,
    ia,
    lyrics,
    playlists,
    recommendations,
    search,
    stream,
)

app = FastAPI(title="AURA API")
app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(search.router)
app.include_router(playlists.router)
app.include_router(favorites.router)
app.include_router(history.router)
app.include_router(recommendations.router)
app.include_router(lyrics.router)
app.include_router(stream.router)
app.include_router(ia.router)


@app.get("/health")
def health():
    return {"status": "ok"}
