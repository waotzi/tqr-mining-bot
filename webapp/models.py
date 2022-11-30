from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class Review(Base):
    __tablename__ = "review"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer)
    sender_name = Column(String)
    date = Column(Integer)
    status = Column(String)
    file_ext = Column(String)
    chat_user_count = Column(Integer)
 

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    sender_name = Column(String)
    red_card = Column(Integer)
    wallet = Column(String)
    chat_id = Column(Integer)


class Transactions(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer)
