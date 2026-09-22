"""
Tests for the /ia proxy router.

The Internet Archive API is mocked using httpx's respx-compatible approach
(via unittest.mock.patch) so no real network calls are made.
"""

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers — build fake httpx responses
# ---------------------------------------------------------------------------


def _make_httpx_response(body: dict, status_code: int = 200) -> MagicMock:
    mock = MagicMock()
    mock.is_success = 200 <= status_code < 300
    mock.status_code = status_code
    mock.json.return_value = body
    return mock


IA_SEARCH_BODY = {
    "response": {
        "docs": [
            {
                "identifier": "gd1977-05-08.flac16",
                "title": "Grateful Dead Live at Barton Hall",
                "creator": "Grateful Dead",
            }
        ],
        "numFound": 1,
    }
}

IA_ITEM_BODY = {
    "metadata": {
        "identifier": "gd1977-05-08.flac16",
        "title": "Grateful Dead Live at Barton Hall 1977",
        "creator": "Grateful Dead",
    },
    "files": [
        {"name": "gd77.flac", "format": "Flac", "length": "5:30", "size": "24000000"},
        {"name": "gd77.mp3", "format": "VBR MP3", "length": "5:30", "bitrate": "192"},
    ],
}

IA_ITEM_MP3_ONLY = {
    "metadata": {"identifier": "mp3-only-item", "title": "MP3 Only", "creator": "Some Artist"},
    "files": [{"name": "track.mp3", "format": "128Kbps MP3", "length": "3:00", "bitrate": "128"}],
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_ia_search_returns_tracks(client, auth_headers):
    with patch("httpx.get", return_value=_make_httpx_response(IA_SEARCH_BODY)):
        response = client.get("/ia/search", params={"q": "grateful dead"}, headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert len(body["tracks"]) == 1
    assert body["tracks"][0]["id"] == "gd1977-05-08.flac16"
    assert body["tracks"][0]["artist_name"] == "Grateful Dead"


def test_ia_search_requires_auth(client):
    response = client.get("/ia/search", params={"q": "test"})
    assert response.status_code == 401


def test_ia_search_returns_502_when_ia_is_down(client, auth_headers):
    with patch("httpx.get", return_value=_make_httpx_response({}, status_code=503)):
        response = client.get("/ia/search", params={"q": "test"}, headers=auth_headers)
    assert response.status_code == 502


def test_ia_search_requires_q_param(client, auth_headers):
    # q is required (min_length=1), omitting it should return 422
    response = client.get("/ia/search", headers=auth_headers)
    assert response.status_code == 422


def test_ia_item_returns_detail_with_best_audio(client, auth_headers):
    with patch("httpx.get", return_value=_make_httpx_response(IA_ITEM_BODY)):
        response = client.get("/ia/item/gd1977-05-08.flac16", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "gd1977-05-08.flac16"
    assert body["artist_name"] == "Grateful Dead"
    # FLAC should be preferred over MP3
    assert body["best_audio_file"]["format"] == "Flac"
    assert "gd77.flac" in body["best_audio_file"]["stream_url"]


def test_ia_item_falls_back_to_mp3_when_no_flac(client, auth_headers):
    with patch("httpx.get", return_value=_make_httpx_response(IA_ITEM_MP3_ONLY)):
        response = client.get("/ia/item/mp3-only-item", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["best_audio_file"]["format"] == "128Kbps MP3"


def test_ia_item_returns_404_when_ia_returns_404(client, auth_headers):
    with patch("httpx.get", return_value=_make_httpx_response({}, status_code=404)):
        response = client.get("/ia/item/does-not-exist", headers=auth_headers)
    assert response.status_code == 404


def test_ia_item_requires_auth(client):
    response = client.get("/ia/item/any-item")
    assert response.status_code == 401
