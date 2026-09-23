"""
AURA — Supabase PostgreSQL Catalog Seeder
Seeds artists, albums, lossless audio sample files, tracks, lyrics, and playlists into the remote Supabase database.
"""

import math
import os
import struct
import wave
from pathlib import Path
from dotenv import load_dotenv

# Ensure .env is loaded from apps/api
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

from app.database import get_connection

AUDIO_DIR = Path(__file__).resolve().parent / "audio_samples"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def generate_audio_file(filename: str, sample_rate: int = 96000, duration: int = 15, chord=(432, 648, 864)) -> str:
    """Generates a clean harmonic PCM audio file for streaming testing."""
    file_path = AUDIO_DIR / filename
    if file_path.exists() and file_path.stat().st_size > 10000:
        return str(file_path)

    num_samples = sample_rate * duration
    f1, f2, f3 = chord

    with wave.open(str(file_path), "wb") as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        for i in range(num_samples):
            t = i / sample_rate
            # Smooth fade in and gentle release envelope
            env = min(1.0, t * 1.5) * max(0.0, 1.0 - (t / duration) ** 1.8)
            val = (
                math.sin(2 * math.pi * f1 * t) * 0.45
                + math.sin(2 * math.pi * f2 * t) * 0.30
                + math.sin(2 * math.pi * f3 * t) * 0.20
            ) * env
            int_val = int(val * 32767 * 0.75)
            wav_file.writeframes(struct.pack("<hh", int_val, int_val))

    return str(file_path)


CATALOG_DATA = [
    {
        "artist": "Nocturne Field",
        "albums": [
            {
                "title": "Low Tide Archive",
                "release_date": "2024-03-15",
                "tracks": [
                    {
                        "title": "Low Tide",
                        "duration_sec": 272.0,
                        "sample_rate": 96000,
                        "filename": "low_tide_96k.wav",
                        "chord": (432, 648, 864),
                        "lyrics_plain": "Waves recede beneath the twilight,\nShadows lengthen on the shore.\nQuiet resonance in the night,\nStillness here forevermore.",
                        "lyrics_synced": "[00:02.00]Waves recede beneath the twilight,\n[00:06.50]Shadows lengthen on the shore.\n[00:11.00]Quiet resonance in the night,\n[00:15.50]Stillness here forevermore.",
                    },
                    {
                        "title": "Archive Room",
                        "duration_sec": 198.0,
                        "sample_rate": 44100,
                        "filename": "archive_room_44k.wav",
                        "chord": (261, 329, 392),
                        "lyrics_plain": "Dust suspended in the sunbeam,\nMemories carved in vinyl groove.\nFloating gently in a daydream,\nRhythms that begin to move.",
                        "lyrics_synced": "[00:03.00]Dust suspended in the sunbeam,\n[00:08.00]Memories carved in vinyl groove.\n[00:13.00]Floating gently in a daydream,\n[00:18.00]Rhythms that begin to move.",
                    },
                ],
            }
        ],
    },
    {
        "artist": "Solar Echoes",
        "albums": [
            {
                "title": "Movements in 96kHz",
                "release_date": "2023-11-20",
                "tracks": [
                    {
                        "title": "Photosynthesis",
                        "duration_sec": 341.0,
                        "sample_rate": 96000,
                        "filename": "photosynthesis_96k.wav",
                        "chord": (528, 792, 1056),
                        "lyrics_plain": "Light transforms to living pulse,\nChlorophyll and sacred green.\nSilent breath without impulse,\nVibrations never heard or seen.",
                        "lyrics_synced": "[00:04.00]Light transforms to living pulse,\n[00:09.00]Chlorophyll and sacred green.\n[00:14.00]Silent breath without impulse,\n[00:19.00]Vibrations never heard or seen.",
                    },
                    {
                        "title": "Starlight Drift",
                        "duration_sec": 290.0,
                        "sample_rate": 96000,
                        "filename": "starlight_drift_96k.wav",
                        "chord": (440, 554, 659),
                        "lyrics_plain": "Across the cold celestial sea,\nPhotons journey through the dark.\nGuiding light eternally,\nIgniting every quiet spark.",
                        "lyrics_synced": "[00:03.50]Across the cold celestial sea,\n[00:08.00]Photons journey through the dark.\n[00:13.00]Guiding light eternally,\n[00:17.50]Igniting every quiet spark.",
                    },
                ],
            }
        ],
    },
    {
        "artist": "Aura Sound Labs",
        "albums": [
            {
                "title": "Acoustic Resonance & Space",
                "release_date": "2025-01-10",
                "tracks": [
                    {
                        "title": "Acoustic Resonance (192kHz Master)",
                        "duration_sec": 320.0,
                        "sample_rate": 192000,
                        "filename": "acoustic_resonance_192k.wav",
                        "chord": (384, 576, 768),
                        "lyrics_plain": "Pure signal path,\nZero jitter, bit-perfect clarity.\nHarmonic depth unveiled,\nTrue fidelity in sound.",
                        "lyrics_synced": "[00:02.50]Pure signal path,\n[00:07.00]Zero jitter, bit-perfect clarity.\n[00:12.00]Harmonic depth unveiled,\n[00:16.50]True fidelity in sound.",
                    },
                    {
                        "title": "Spatial Impulse Response",
                        "duration_sec": 245.0,
                        "sample_rate": 192000,
                        "filename": "spatial_impulse_192k.wav",
                        "chord": (300, 450, 600),
                        "lyrics_plain": "Decay along the wooden hall,\nReflections bouncing near and far.\nSoundwaves painting every wall,\nClear as any distant star.",
                        "lyrics_synced": "[00:03.00]Decay along the wooden hall,\n[00:08.00]Reflections bouncing near and far.\n[00:13.00]Soundwaves painting every wall,\n[00:18.00]Clear as any distant star.",
                    },
                ],
            }
        ],
    },
    {
        "artist": "Carbon Cascade",
        "albums": [
            {
                "title": "Equinox Reflections",
                "release_date": "2022-09-22",
                "tracks": [
                    {
                        "title": "Equinox Dawn",
                        "duration_sec": 280.0,
                        "sample_rate": 96000,
                        "filename": "equinox_dawn_96k.wav",
                        "chord": (349, 440, 523),
                        "lyrics_plain": "Balance in the turning sphere,\nShadows meeting light once more.\nAutumn chill is drawing near,\nWhispers at the valley floor.",
                        "lyrics_synced": "[00:02.50]Balance in the turning sphere,\n[00:07.50]Shadows meeting light once more.\n[00:12.50]Autumn chill is drawing near,\n[00:17.50]Whispers at the valley floor.",
                    }
                ],
            }
        ],
    },
    {
        "artist": "Elysian Trio",
        "albums": [
            {
                "title": "Midnight at Birdland",
                "release_date": "2024-06-12",
                "tracks": [
                    {
                        "title": "Blue Velvet Promenade",
                        "duration_sec": 315.0,
                        "sample_rate": 96000,
                        "filename": "blue_velvet_96k.wav",
                        "chord": (293, 349, 440),
                        "lyrics_plain": "Walking down the damp concrete,\nSaxophone in minor keys.\nGentle rhythm in the street,\nCarried on the midnight breeze.",
                        "lyrics_synced": "[00:03.00]Walking down the damp concrete,\n[00:08.50]Saxophone in minor keys.\n[00:14.00]Gentle rhythm in the street,\n[00:19.50]Carried on the midnight breeze.",
                    }
                ],
            }
        ],
    },
]


def seed_database():
    print("Connecting to Supabase PostgreSQL...")
    conn = get_connection()
    print("Connected successfully!")

    all_track_ids = []

    for item in CATALOG_DATA:
        artist_name = item["artist"]
        conn.execute("INSERT OR IGNORE INTO artists (name) VALUES (?)", (artist_name,))
        artist_row = conn.execute("SELECT id FROM artists WHERE name = ?", (artist_name,)).fetchone()
        artist_id = artist_row["id"]
        print(f"Artist: {artist_name} (ID: {artist_id})")

        for album in item["albums"]:
            album_title = album["title"]
            conn.execute(
                "INSERT OR IGNORE INTO albums (title, artist_id, release_date) VALUES (?, ?, ?)",
                (album_title, artist_id, album["release_date"]),
            )
            album_row = conn.execute("SELECT id FROM albums WHERE title = ?", (album_title,)).fetchone()
            album_id = album_row["id"]
            print(f"  Album: {album_title} (ID: {album_id})")

            for t in album["tracks"]:
                # 1. Generate real audio sample file
                audio_path = generate_audio_file(
                    filename=t["filename"],
                    sample_rate=t["sample_rate"],
                    duration=15,
                    chord=t["chord"],
                )

                # 2. Check if track already exists
                existing_track = conn.execute(
                    "SELECT id FROM tracks WHERE title = ? AND album_id = ?",
                    (t["title"], album_id),
                ).fetchone()

                if not existing_track:
                    cursor = conn.execute(
                        "INSERT INTO tracks (title, artist_id, album_id, duration_sec, file_path) VALUES (?, ?, ?, ?, ?)",
                        (t["title"], artist_id, album_id, t["duration_sec"], audio_path),
                    )
                    track_id = cursor.lastrowid
                    if not track_id:
                        track_row = conn.execute(
                            "SELECT id FROM tracks WHERE title = ? AND album_id = ?",
                            (t["title"], album_id),
                        ).fetchone()
                        track_id = track_row["id"]
                else:
                    track_id = existing_track["id"]
                    # Update file_path if changed
                    conn.execute("UPDATE tracks SET file_path = ? WHERE id = ?", (audio_path, track_id))

                all_track_ids.append(track_id)
                print(f"    Track: {t['title']} (ID: {track_id}, File: {t['filename']})")

                # 3. Seed lyrics
                conn.execute(
                    "INSERT OR IGNORE INTO lyrics (track_id, plain_lyrics, synced_lyrics) VALUES (?, ?, ?)",
                    (track_id, t["lyrics_plain"], t["lyrics_synced"]),
                )

    conn.commit()

    # Query counts
    total_artists = conn.execute("SELECT COUNT(*) FROM artists").fetchone()[0]
    total_albums = conn.execute("SELECT COUNT(*) FROM albums").fetchone()[0]
    total_tracks = conn.execute("SELECT COUNT(*) FROM tracks").fetchone()[0]
    total_lyrics = conn.execute("SELECT COUNT(*) FROM lyrics").fetchone()[0]

    print("\n--- SEED COMPLETE ---")
    print(f"Total Artists in Supabase: {total_artists}")
    print(f"Total Albums in Supabase:  {total_albums}")
    print(f"Total Tracks in Supabase:  {total_tracks}")
    print(f"Total Lyrics in Supabase:  {total_lyrics}")

    conn.close()


if __name__ == "__main__":
    seed_database()
