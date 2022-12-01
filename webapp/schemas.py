from pydantic import BaseModel


class Review(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    date: int
    status: str
    file_ext: str
    chat_user_count: int
    class Config:
        orm_mode = True

class UserBase(BaseModel):
    id: int
    
class UserWallet(UserBase):
    wallet: str
    chat_id: int
    sender_name: str
    class Config:
        orm_mode = True

class User(UserBase):
    wallet: str
    chat_id: int
    sender_name: str
    red_card: int
    class Config:
        orm_mode = True
    
class Transactions(BaseModel):
    id: str
    sender_id: int
    class Config:
        orm_mode = True
