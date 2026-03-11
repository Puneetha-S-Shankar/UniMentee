from app.database import SessionLocal
from app.core.security import hash_password
from models.users import User

def create_user():
    db = SessionLocal()

    # Change these values if needed
    email = "admin@test.com"
    password = "Admin123"
    university_id = 1

    hashed = hash_password(password)

    user = User(
        university_id=university_id,
        full_name="Test Admin",
        email=email,
        password_hash=hashed,
        status="ACTIVE"
    )

    db.add(user)
    db.commit()
    db.close()

    print("User created successfully!")

if __name__ == "__main__":
    create_user()