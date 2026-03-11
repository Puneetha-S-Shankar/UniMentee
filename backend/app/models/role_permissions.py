from sqlalchemy import Column, BigInteger, ForeignKey
from app.database import Base

class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_permission_id = Column(BigInteger, primary_key=True)
    role_id = Column(BigInteger, ForeignKey("roles.role_id"))
    permission_id = Column(BigInteger, ForeignKey("permissions.permission_id"))