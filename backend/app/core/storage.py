"""Service de stockage S3-compatible (MinIO / Cloudflare R2)."""

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from app.core.config import get_settings

settings = get_settings()


def _build_endpoint_url(host: str) -> str:
    """Construire l'URL de l'endpoint S3 en évitant les doublons de protocole."""
    host = host.strip()
    if host.startswith("https://") or host.startswith("http://"):
        return host
    scheme = "https" if settings.minio_use_ssl else "http"
    return f"{scheme}://{host}"


def get_s3_client():
    """Créer un client S3 (MinIO local ou Cloudflare R2)."""
    return boto3.client(
        "s3",
        endpoint_url=_build_endpoint_url(settings.minio_endpoint),
        aws_access_key_id=settings.minio_root_user,
        aws_secret_access_key=settings.minio_root_password,
        config=BotoConfig(signature_version="s3v4"),
        region_name=settings.s3_region,
    )


def get_s3_public_client():
    """Créer un client S3 avec l'endpoint public (pour URLs navigateur)."""
    return boto3.client(
        "s3",
        endpoint_url=_build_endpoint_url(settings.minio_public_endpoint),
        aws_access_key_id=settings.minio_root_user,
        aws_secret_access_key=settings.minio_root_password,
        config=BotoConfig(signature_version="s3v4"),
        region_name=settings.s3_region,
    )


def ensure_bucket_exists():
    """Créer le bucket s'il n'existe pas."""
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.minio_bucket)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code in ("404", "NoSuchBucket"):
            client.create_bucket(Bucket=settings.minio_bucket)
        else:
            # R2 peut retourner 403 si le bucket existe mais les permissions sont limitées
            print(f"⚠️  Vérification bucket : {e}")


async def upload_file(file_data: bytes, object_key: str, content_type: str) -> str:
    """Upload un fichier vers le stockage S3."""
    client = get_s3_client()
    client.put_object(
        Bucket=settings.minio_bucket,
        Key=object_key,
        Body=file_data,
        ContentType=content_type,
    )
    return object_key


async def get_presigned_url(object_key: str, expires_in: int = 3600) -> str:
    """Générer une URL pré-signée pour accéder à un fichier."""
    client = get_s3_public_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket, "Key": object_key},
        ExpiresIn=expires_in,
    )


def get_file_object(object_key: str, range_header: str = None):
    """Récupérer un objet S3 (pour streaming via le backend)."""
    client = get_s3_client()
    params = {"Bucket": settings.minio_bucket, "Key": object_key}
    if range_header:
        params["Range"] = range_header
    return client.get_object(**params)


async def delete_file(object_key: str):
    """Supprimer un fichier du stockage S3."""
    client = get_s3_client()
    client.delete_object(Bucket=settings.minio_bucket, Key=object_key)


async def generate_upload_url(object_key: str, content_type: str, expires_in: int = 3600) -> str:
    """Générer une URL pré-signée pour upload direct."""
    client = get_s3_public_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.minio_bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
