import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os

SECRET = os.getenv("JWT_SECRET")

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def make_token(user_id: str, guest: bool = False) -> str:
    """Issue a session token.

    Guest tokens carry a 'guest' claim and a shorter life. The claim is only a
    convenience for the frontend — the backend re-checks the is_guest flag on
    the stored account before allowing anything a guest cannot do, so a forged
    claim gains nothing.
    """
    payload = {
        "sub": user_id,
        "guest": guest,
        "exp": datetime.utcnow() + timedelta(hours=6 if guest else 24)
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")

def decode_token(token: str):
    try:
        data = jwt.decode(token, SECRET, algorithms=["HS256"])
        return data["sub"]
    except JWTError:
        return None