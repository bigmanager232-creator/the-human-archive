"""Service de stockage local (filesystem) – alternative à MinIO/S3."""

import io
import os
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()
STORAGE_DIR = Path(settings.storage_local_dir)


def ensure_bucket_exists():
    """Créer le répertoire de stockage s'il n'existe pas."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)


async def upload_file(file_data: bytes, object_key: str, content_type: str) -> str:
    """Écrire un fichier sur le disque local."""
    file_path = STORAGE_DIR / object_key
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(file_data)
    return object_key


def get_file_object(object_key: str, range_header: str = None):
    """Lire un fichier depuis le disque local (compatible avec StreamingResponse)."""
    file_path = STORAGE_DIR / object_key
    if not file_path.exists():
        raise FileNotFoundError(f"Fichier non trouvé : {object_key}")
    data = file_path.read_bytes()
    total = len(data)

    if range_header:
        # Parser "bytes=start-end"
        range_spec = range_header.replace("bytes=", "")
        parts = range_spec.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else total - 1
        end = min(end, total - 1)
        return {
            "Body": io.BytesIO(data[start:end + 1]),
            "ContentLength": end - start + 1,
            "ContentRange": f"bytes {start}-{end}/{total}",
        }

    return {
        "Body": io.BytesIO(data),
        "ContentLength": total,
    }


async def get_presigned_url(object_key: str, expires_in: int = 3600) -> str:
    """Non supporté en stockage local – les fichiers sont servis via le proxy backend."""
    raise NotImplementedError("Les URLs pré-signées ne sont pas disponibles en stockage local")


async def delete_file(object_key: str):
    """Supprimer un fichier du disque local."""
    file_path = STORAGE_DIR / object_key
    if file_path.exists():
        os.remove(file_path)


async def generate_upload_url(object_key: str, content_type: str, expires_in: int = 3600) -> str:
    """Non supporté en stockage local."""
    raise NotImplementedError("L'upload par URL pré-signée n'est pas disponible en stockage local")
