from sqlalchemy import Column, BigInteger, String, Date, Boolean, Text, Integer
from sqlalchemy import ForeignKey
from sqlalchemy import TIMESTAMP
from app.database import Base
import uuid

class PortfolioItem(Base):
    __tablename__ = 'portfolio_items'
    item_id           = Column(BigInteger, primary_key=True, index=True)
    student_id        = Column(BigInteger, ForeignKey('students.student_id'))
    university_id = Column(BigInteger, nullable=False, index=True)
    item_type         = Column(String(30), nullable=False, index=True)
    title             = Column(String(255), nullable=False)
    issuing_org       = Column(String(255))
    issue_date        = Column(Date, nullable=False)
    description       = Column(Text)
    file_url          = Column(String(500), nullable=False)
    file_key          = Column(String(500), nullable=False)
    uploaded_by       = Column(BigInteger, ForeignKey('users.user_id'), index=True) 
    verification_code = Column(String(100), nullable=False, index=True)
    status            = Column(String(20), default='PENDING')
    verified_by       = Column(BigInteger)
    version           = Column(Integer, default=1)
