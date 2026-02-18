"""Service de stockage S3-compatible (MinIO)."""

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from app.core.config import get_settings

settings = get_settings()


def get_s3_client():
    """Créer un client S3 pour MinIO (réseau interne Docker)."""
    return boto3.client(
        "s3",
        endpoint_url=f"{'https' if settings.minio_use_ssl else 'http'}://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_root_user,
        aws_secret_access_key=settings.minio_root_password,
        config=BotoConfig(signature_version="s3v4"),
        region_name="us-east-1",
    )


def get_s3_public_client():
    """Créer un client S3 avec l'endpoint public (pour URLs navigateur)."""
    return boto3.client(
        "s3",
        endpoint_url=f"{'https' if settings.minio_use_ssl else 'http'}://{settings.minio_public_endpoint}",
        aws_access_key_id=settings.minio_root_user,
        aws_secret_access_key=settings.minio_root_password,
        config=BotoConfig(signature_version="s3v4"),
        region_name="us-east-1",
    )


def ensure_bucket_exists():
    """Créer le bucket s'il n'existe pas."""
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.minio_bucket)
    except ClientError:
        client.create_bucket(Bucket=settings.minio_bucket)


async def upload_file(file_data: bytes, object_key: str, content_type: str) -> str:
    """Upload un fichier vers MinIO."""
    client = get_s3_client()
    client.put_object(
        Bucket=settings.minio_bucket,
        Key=object_key,
        Body=file_data,
        ContentType=content_type,
    )
    return object_key


async def get_presigned_url(object_key: str, expires_in: int = 3600) -> str:
    """Générer une URL pré-signée pour accéder à un fichier (accessible depuis le navigateur)."""
    client = get_s3_public_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket, "Key": object_key},
        ExpiresIn=expires_in,
    )


def get_file_object(object_key: str):
    """Récupérer un objet S3 depuis MinIO (pour streaming via le backend)."""
    client = get_s3_client()
    return client.get_object(Bucket=settings.minio_bucket, Key=object_key)


async def delete_file(object_key: str):
    """Supprimer un fichier de MinIO."""
    client = get_s3_client()
    client.delete_object(Bucket=settings.minio_bucket, Key=object_key)


async def generate_upload_url(object_key: str, content_type: str, expires_in: int = 3600) -> str:
    """Générer une URL pré-signée pour upload direct (chunked upload)."""
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
