from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client["shefguide"]

users_collection      = db["users"]
sessions_collection   = db["sessions"]
checklists_collection = db["checklists"]
posts_collection = db["posts"]