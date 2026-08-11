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
security_events_collection = db["security_events"]

# Embedded chunks of the curated ShefGuide knowledge base, rebuilt by
# index_knowledge.py. Retrieved from on every chat turn.
knowledge_collection = db["knowledge_chunks"]

# Embedded chunks of documents students have attached, one set per user.
document_chunks_collection = db["document_chunks"]