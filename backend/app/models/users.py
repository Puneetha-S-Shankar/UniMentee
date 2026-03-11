from sqlalchemy import Column, BigInteger, String, Boolean, ForeignKey
from app.database import Base
class User(Base):
    __tablename__ = "users"
    user_id = Column(BigInteger, primary_key=True, index=True)
    university_id = Column(BigInteger, nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    status = Column(String, default="ACTIVE")