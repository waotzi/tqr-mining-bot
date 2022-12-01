from sqlalchemy.orm import Session
from sqlalchemy.sql import exists    

import webapp.models as models
import webapp.schemas as schemas

def get_item(db: Session, id: int):
    return db.query(models.Review).filter(models.Review.id == id).first()

def set_item_status(db: Session, id: int, status: str):
    item = get_item(db, id)
    if item is not None:
        item.status=status
        db.commit()
        db.refresh(item)
    return item

def delete_item(db: Session, id: int):
    db.query(models.Review).filter(models.Review.id == id).delete()
    db.commit()

def get_user(db:Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def exists_user(db:Session, user_id: int):
    return db.query(exists().where(models.User.id == user_id)).scalar()

def update_user_wallet(db:Session, user: schemas.UserWallet, user_id: int):
    if(exists_user(db, user_id)):
        db_user = get_user(db, user_id)
        db_user.wallet = user.wallet
        db_user.chat_id = user.chat_id
        db_user.sender_name = user.sender_name
        db.commit()
        db.refresh(db_user)
        return db_user
    else:
        return create_user(db, user)

def get_review(db:Session, status: str):
    db_review = db.query(models.Review).filter(models.Review.status == status).all()
    return db_review

def add_review(db: Session, rev: schemas.Review):
    db_review = models.Review(id = rev.id, sender_id = rev.sender_id, sender_name = rev.sender_name, date = rev.date, status = rev.status, file_ext = rev.file_ext, chat_user_count = rev.chat_user_count)
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserWallet):
    db_user = models.User(id = user.id, wallet = user.wallet, chat_id = user.chat_id, red_card = 0, sender_name = user.sender_name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def reset_red_cards(db: Session, id: int):
    user = get_user(db, id)
    if user is not None:
        user.red_card = 0
        db.commit()

