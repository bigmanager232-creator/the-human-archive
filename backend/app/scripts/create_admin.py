"""Script de création du premier administrateur."""

import asyncio
import getpass
from sqlalchemy import select
from app.core.database import async_session
from app.core.security import hash_password
from app.models.user import User

# Importer pour enregistrer les modèles
from app.models.archive import Archive  # noqa
from app.models.territory import Territory  # noqa


async def create_admin():
    print("\n🔐 Création d'un compte administrateur\n")

    email = input("Email : ").strip()
    full_name = input("Nom complet : ").strip()
    password = getpass.getpass("Mot de passe : ")
    confirm = getpass.getpass("Confirmer : ")

    if password != confirm:
        print("❌ Les mots de passe ne correspondent pas")
        return

    async with async_session() as session:
        # Vérifier si l'email existe
        result = await session.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print("❌ Un utilisateur avec cet email existe déjà")
            return

        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            role="admin",
            is_active=True,
        )
        session.add(user)
        await session.commit()

    print(f"\n✅ Admin créé : {full_name} ({email})")


if __name__ == "__main__":
    asyncio.run(create_admin())
