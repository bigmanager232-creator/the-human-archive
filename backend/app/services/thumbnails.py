"""Service de génération de thumbnails pour vidéos et images."""

import asyncio
import json
import logging
import subprocess
import tempfile
import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.core.config import get_settings
from app.core.storage_dispatch import upload_file

logger = logging.getLogger(__name__)
settings = get_settings()

THUMB_WIDTH = 640
THUMB_HEIGHT = 360


async def _extract_video_duration(video_path: Path) -> float | None:
    """Extraire la durée d'une vidéo avec ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        str(video_path),
    ]

    try:
        proc = await asyncio.to_thread(
            subprocess.run, cmd,
            capture_output=True, timeout=15,
        )
        if proc.returncode != 0:
            logger.warning("ffprobe a échoué : %s", proc.stderr.decode(errors="replace"))
            return None

        info = json.loads(proc.stdout)
        duration = float(info["format"]["duration"])
        return duration
    except (KeyError, ValueError, json.JSONDecodeError) as e:
        logger.warning("Impossible de lire la durée vidéo : %s", e)
        return None
    except subprocess.TimeoutExpired:
        logger.warning("ffprobe timeout")
        return None


async def generate_video_thumbnail(file_data: bytes, object_key_prefix: str) -> dict:
    """Extraire une frame de la vidéo avec ffmpeg et l'uploader comme thumbnail.

    Retourne {"thumbnail_key": str|None, "duration_seconds": float|None}.
    """
    thumb_key = f"thumbnails/{object_key_prefix}/{uuid.uuid4().hex}.jpg"
    result = {"thumbnail_key": None, "duration_seconds": None}

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = Path(tmpdir) / "input"
        thumb_path = Path(tmpdir) / "thumb.jpg"

        video_path.write_bytes(file_data)

        # Extraire la durée
        result["duration_seconds"] = await _extract_video_duration(video_path)

        # Calculer le timestamp de capture (1s ou 10% de la durée, min 0)
        if result["duration_seconds"] and result["duration_seconds"] > 2:
            seek = min(1.0, result["duration_seconds"] * 0.1)
        else:
            seek = 0

        quality = max(2, min(10, 11 - settings.thumbnail_quality // 10))

        # -ss avant -i = input seek (rapide)
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(seek),
            "-i", str(video_path),
            "-frames:v", "1",
            "-vf", f"scale={THUMB_WIDTH}:{THUMB_HEIGHT}:force_original_aspect_ratio=decrease,"
                   f"pad={THUMB_WIDTH}:{THUMB_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black",
            "-q:v", str(quality),
            str(thumb_path),
        ]

        try:
            proc = await asyncio.to_thread(
                subprocess.run, cmd,
                capture_output=True, timeout=30,
            )
        except subprocess.TimeoutExpired:
            logger.error("ffmpeg timeout pour le thumbnail de %s", object_key_prefix)
            return result

        if proc.returncode != 0 or not thumb_path.exists():
            logger.warning(
                "ffmpeg thumbnail échoué (code %d) : %s",
                proc.returncode,
                proc.stderr.decode(errors="replace")[:500],
            )
            return result

        thumb_data = thumb_path.read_bytes()

    await upload_file(thumb_data, thumb_key, "image/jpeg")
    result["thumbnail_key"] = thumb_key
    logger.info("Thumbnail vidéo généré : %s (durée: %s s)", thumb_key, result["duration_seconds"])
    return result


async def generate_image_thumbnail(file_data: bytes, object_key_prefix: str) -> dict:
    """Créer un thumbnail redimensionné à partir d'une image avec Pillow.

    Retourne {"thumbnail_key": str|None, "duration_seconds": None}.
    """
    thumb_key = f"thumbnails/{object_key_prefix}/{uuid.uuid4().hex}.jpg"

    def _resize():
        img = Image.open(BytesIO(file_data))
        img.thumbnail((THUMB_WIDTH, THUMB_HEIGHT))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=settings.thumbnail_quality)
        return buf.getvalue()

    try:
        thumb_data = await asyncio.to_thread(_resize)
    except Exception:
        logger.warning("Échec de la génération du thumbnail image pour %s", object_key_prefix)
        return {"thumbnail_key": None, "duration_seconds": None}

    await upload_file(thumb_data, thumb_key, "image/jpeg")
    logger.info("Thumbnail image généré : %s", thumb_key)
    return {"thumbnail_key": thumb_key, "duration_seconds": None}


async def generate_thumbnail(media_type: str, file_data: bytes, object_key: str) -> dict:
    """Point d'entrée : générer un thumbnail selon le type de média.

    Retourne {"thumbnail_key": str|None, "duration_seconds": float|None}.
    """
    prefix = object_key.rsplit(".", 1)[0] if "." in object_key else object_key

    if media_type == "video":
        return await generate_video_thumbnail(file_data, prefix)
    if media_type == "image":
        return await generate_image_thumbnail(file_data, prefix)

    return {"thumbnail_key": None, "duration_seconds": None}
