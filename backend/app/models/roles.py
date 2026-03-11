from sqlalchemy import Column, BigInteger, String
from app.database import Base

class Role(Base):
    __tablename__ = "roles"

    role_id = Column(BigInteger, primary_key=True)
    name = Column(String)
    display_name = Column(String)