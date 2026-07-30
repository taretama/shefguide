import re
import time
from collections import defaultdict

_INJECTION_PATTERNS = [
    r"ignore (all )?(previous|prior|above) instructions",
    r"disregard (the )?(above|previous|prior)",
    r"you are now",
    r"system prompt",
    r"reveal your (instructions|prompt)",
    r"act as (a|an)?",
    r"new instructions\s*:",
]
_INJECTION_RE = re.compile("|".join(_INJECTION_PATTERNS), re.IGNORECASE)

_PII_PATTERNS = {
    "email": r"[\w.+-]+@[\w-]+\.[\w.-]+",
    "phone": r"(?:\+?\d{1,3}[\s-]?)?(?:\(0\)|0)?\d{9,10}\b",
    "ni_number": r"\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b",
    "passport": r"\b[A-Z]{1,2}\d{6,7}\b",
    "long_digits": r"\b\d{8,}\b",
}
_PII_RE = re.compile("|".join(f"(?P<{name}>{pattern})" for name, pattern in _PII_PATTERNS.items()))


def check_prompt_injection(text: str) -> bool:
    return bool(_INJECTION_RE.search(text or ""))


def redact_pii(text: str) -> tuple[str, int]:
    count = 0

    def _replace(match):
        nonlocal count
        count += 1
        return "[REDACTED]"

    clean_text = _PII_RE.sub(_replace, text or "")
    return clean_text, count


# In-memory per-user request timestamps, keyed by (user_id, endpoint).
# Resets on server restart — fine for a single-instance dissertation deployment.
_request_log: dict[tuple[str, str], list[float]] = defaultdict(list)

RATE_LIMIT = 10          # max requests
RATE_WINDOW_SECONDS = 60 # per this many seconds


def check_rate_limit(user_id: str, endpoint: str,
                      limit: int = RATE_LIMIT,
                      window_seconds: int = RATE_WINDOW_SECONDS) -> bool:
    """Returns True if the request is allowed, False if the user is over the limit."""
    now = time.time()
    key = (user_id, endpoint)
    recent = [t for t in _request_log[key] if now - t < window_seconds]
    if len(recent) >= limit:
        _request_log[key] = recent
        return False
    recent.append(now)
    _request_log[key] = recent
    return True
