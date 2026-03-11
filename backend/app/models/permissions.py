from sqlalchemy import Column, BigInteger, String
from app.database import Base

class Permission(Base):
    __tablename__ = "permissions"

    permission_id = Column(BigInteger, primary_key=True)
    key = Column(String)
    module = Column(String)