"""Routes d'authentification."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, create_reset_token,
    decode_token, get_current_user, require_admin,
)
from app.models.user import User
from app.schemas.schemas import (
    LoginRequest, TokenResponse, RefreshRequest,
    UserCreate, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, AdminResetPasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Inscription d'un nouvel utilisateur."""
    # Vérifier si l'email existe déjà
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte avec cet email existe déjà",
        )

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        organization=data.organization,
        language=data.language,
        role="contributor",  # Rôle par défaut
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Connexion et obtention des tokens."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )

    return TokenResponse(
        access_token=create_access_token({"sub": str(user.id)}),
        refresh_token=create_refresh_token({"sub": str(user.id)}),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Rafraîchir les tokens."""
    payload = decode_token(data.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de rafraîchissement invalide",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé",
        )

    return TokenResponse(
        access_token=create_access_token({"sub": str(user.id)}),
        refresh_token=create_refresh_token({"sub": str(user.id)}),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Récupérer le profil de l'utilisateur connecté."""
    return current_user


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Demander une réinitialisation de mot de passe."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    # Toujours retourner un succès pour ne pas révéler si l'email existe
    if not user:
        return {"message": "Si un compte existe avec cet email, un lien de réinitialisation a été généré."}

    token = create_reset_token({"sub": str(user.id)})

    # Email non configuré : afficher le lien dans les logs serveur
    print(f"\n{'='*60}")
    print(f"RÉINITIALISATION MOT DE PASSE")
    print(f"Utilisateur : {user.full_name} ({user.email})")
    print(f"Token : {token}")
    print(f"Lien : /reset-password?token={token}")
    print(f"{'='*60}\n")

    return {
        "message": "Si un compte existe avec cet email, un lien de réinitialisation a été généré.",
        "reset_token": token,
    }


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Réinitialiser le mot de passe avec un token."""
    payload = decode_token(data.token)

    if payload.get("type") != "reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de réinitialisation invalide",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé",
        )

    user.hashed_password = hash_password(data.new_password)
    await db.flush()

    return {"message": "Mot de passe réinitialisé avec succès."}


@router.post("/admin/reset-password")
async def admin_reset_password(
    data: AdminResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Réinitialiser le mot de passe d'un utilisateur (admin uniquement)."""
    result = await db.execute(select(User).where(User.id == data.user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé",
        )

    user.hashed_password = hash_password(data.new_password)
    await db.flush()

    return {"message": f"Mot de passe de {user.full_name} réinitialisé."}


@router.get("/admin/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Lister tous les utilisateurs (admin uniquement)."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()
