from sqlalchemy import Column, BigInteger, ForeignKey
from app.database import Base

class UserRole(Base):
    __tablename__ = "user_roles"

    user_role_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id"))
    role_id = Column(BigInteger, ForeignKey("roles.role_id"))