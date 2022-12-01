from fastapi import Depends, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from os import listdir
from os.path import isfile, join
from datetime import datetime
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os
import webapp.crud as crud
import webapp.models as models
import webapp.schemas as schemas

from webapp.database import SessionLocal, engine
from fastapi.security import OAuth2PasswordBearer
from starlette import status
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

# Use token based authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# Ensure the request is authenticated
def auth_request(token: str = Depends(oauth2_scheme)) -> bool:
    authenticated = token == os.environ.get("SECRET_API_KEY")
    return authenticated


# setup tables and database
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


width = "300"
height = "220"

html_header = """
    <html>
        <head>
            <title>Review TQR Images</title>
            <link rel="stylesheet" href="/static/style.css">
        </head>
        <body>
        <nav>
            <h1>Review TQR Images</h1>
            <span class="menu">
                <button onclick='setApiKey()'>Set Api Key</button>
                <button onclick='approveSelected()' >Send to bot</button>
            </span>
        </nav>

        <main>
        """ 
html_footer = """
        </main>
        <script type="text/javascript" src='/static/logic.js'></script>

        </body>
    </html>
    """

review_path = "review"

if not os.path.isdir(review_path):
    os.mkdir(review_path)

app.mount("/review", StaticFiles(directory=review_path), name="review")
app.mount("/static", StaticFiles(directory="webapp/static"), name="static")


class ReviewData(BaseModel):
    selected: list
    cards: list
    rejected: list

@app.post("/transaction")
def add_transaction(tx: schemas.Transactions, db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    return crud.add_transaction(db = db, tx = tx)

@app.get("/trx/delete/{id}")
def delete_review(id: int, db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    crud.delete_trx(db, id)

@app.get("/transactions/", response_model=list[schemas.Transactions])
def read_review(db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    db_trx = crud.get_transactions(db)
    if not db_trx:
        raise HTTPException(status_code=404, detail="No transactions found")
    return db_trx


@app.get("/users/{user_id}/reset_red_cards")
def user_reset_red_cards(user_id: int, db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    crud.reset_red_cards(db, item.user_id)


@app.post("/users/{user_id}/wallet", response_model=schemas.UserWallet)
def update_user_wallet(user_id: int, user: schemas.UserWallet, db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    return crud.update_user_wallet(db, user, user_id = user_id)

@app.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    exists = crud.exists_user(db, user_id)
    if exists:
        return crud.get_user(db, user_id)
    else:
        raise HTTPException(status_code=404, detail="User not found")

@app.post("/rev/", response_model=schemas.Review)
def add_review(rev: schemas.Review, db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    return crud.add_review(db=db, rev=rev)

@app.get("/rev/delete/{id}")
def delete_review(id: int, db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    crud.delete_item(db, id)

@app.get("/rev/{status}", response_model=list[schemas.Review])
def read_review(status: str, db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    db_review = crud.get_review(db, status=status)
    if not db_review:
        raise HTTPException(status_code=404, detail="Nothing to review found")
    return db_review

@app.post("/reviewData")
async def review_data(data: ReviewData, db: Session = Depends(get_db), authenticated: bool = Depends(auth_request)):
    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated")
    for id in data.selected:
        item = crud.set_item_status(db, id, "approved")
        crud.reset_red_cards(db, item.sender_id)
        
    for id in data.rejected:
        item = crud.get_item(db, id)    
        if item is not None:
            file_path = review_path + "/" + str(item.id) + "." + item.file_ext
            os.remove(file_path)
            crud.reset_red_cards(db, item.sender_id)
            crud.delete_item(db, id)
    for id in data.cards:
        item = crud.set_item_status(db, id, "red_card")   
        if item is not None:
            file_path = review_path + "/" + str(item.id) + "." + item.file_ext
            os.remove(file_path)    

    return data


class Exists(BaseModel):
    title: str

@app.get("/", response_class=HTMLResponse)
async def root(db: Session = Depends(get_db)):
    dates = {}
    onlyfiles = [f for f in listdir(review_path) if isfile(join(review_path, f))]
    html = html_header
    for file in onlyfiles:
        msg_id = file.split('.')
        msg_id = msg_id[0]
        item = crud.get_item(db, msg_id)


        if item is None:
            file_path = review_path + "/" + file
            os.remove(file_path)
            continue

        if item.status != "waiting":
            continue

        date = item.date - item.date % 60

        if date in dates:
            dates[date].append(item)
        else:
            dates[date] = [item]
    
    if (len(dates.items()) == 0):
        html += "<center>"
        html += "<p>All items reviewed, refresh the page to fetch new items</p>"
        html += "<button onClick='window.location.reload();'>Refresh</button>"
        html += "</center>"
    for date, row  in dates.items():
        dt = datetime.fromtimestamp(date)
        time = dt.time().strftime('%H:%M')

        html += "<h1>" + format(time) + "</h1>"
        html += "<div class='group flex'>"
        for i, item in enumerate(row):
            html += "<div id='" + str(item.id) + "' class='item-container'>"
            html += "<h2 class='center'>" + str(i + 1) + "</h2>"
            html += "<div class='flex space-around'>"

            html += "<button class='light-red'>red card</button>"
            html += "</div><br>"

            html += "<div class='item'>"
            file_path = review_path + "/" + str(item.id) + "." + item.file_ext
            if (item.file_ext == "mp4"):
                html += "<video width='" + width + "' height='"+ height + "' controls>"
                html += "<source src=" + file_path+ " type='video/mp4'>"
                html += "Your browser does not support the video tag."
                html += "</video>"
            elif (item.file_ext == "jpg" or item.file_ext == "png"):
                html += "<img width='" + width + "' src='" + file_path + "' </img>"
           
            html += "</div>"
            html += "<br>"
      

            html += "</div>"
        html += "</div>"

    html += html_footer
    return html
