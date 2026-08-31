"""Test configuration.

The backend modules import each other flatly (`import auth`, `from database
import ...`), so the backend directory has to be on sys.path before any test
imports them.

JWT_SECRET is set here, before `auth` is imported, for two reasons: `auth`
reads the secret once at import time, and using a throwaway value keeps the
real deployment secret out of the test run entirely.
"""
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

os.environ.setdefault("JWT_SECRET", "test-only-secret-not-the-deployment-one")
