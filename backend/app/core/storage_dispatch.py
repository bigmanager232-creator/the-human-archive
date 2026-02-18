"""Dispatcher de stockage – sélectionne le backend selon STORAGE_BACKEND."""

from app.core.config import get_settings

settings = get_settings()

if settings.storage_backend == "local":
    from app.core.storage_local import (  # noqa: F401
        ensure_bucket_exists,
        upload_file,
        get_file_object,
        get_presigned_url,
        delete_file,
        generate_upload_url,
    )
else:
    from app.core.storage import (  # noqa: F401
        ensure_bucket_exists,
        upload_file,
        get_file_object,
        get_presigned_url,
        delete_file,
        generate_upload_url,
    )
