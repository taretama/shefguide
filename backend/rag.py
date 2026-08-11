"""Retrieval-augmented generation for ShefGuide.

Two retrieval sources feed a single answer:

  1. The curated ShefGuide knowledge base (backend/knowledge/*.md), indexed
     once into MongoDB. This is the assistant's own background knowledge.
  2. A document the student has attached, chunked and embedded per user.

Both are searched for the passages most relevant to the current question,
and only those passages are placed in the prompt. This replaces the earlier
approach of pasting a whole document into the system prompt, which did not
scale past a few pages and gave the model no way to tell which part of the
document mattered.

Similarity is plain cosine over OpenAI embeddings, computed in Python. At
this corpus size (hundreds of chunks) an exact scan is faster than the
round trip to a vector database would be, and it keeps the retrieval step
transparent enough to describe in the dissertation.
"""

from __future__ import annotations

import math
import os
import re
from pathlib import Path

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

EMBED_MODEL = "text-embedding-3-small"
KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"

# Chunk sizing is a trade-off: large chunks carry more context but dilute the
# embedding, small chunks match precisely but lose surrounding meaning. ~1200
# characters with overlap keeps most markdown sections whole.
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 200

# Retrieved passages below this cosine score are treated as irrelevant and
# dropped, so an unrelated question does not drag in arbitrary context.
#
# 0.40 was chosen by measuring the score distribution over this knowledge
# base: in-scope questions score 0.47-0.58 against their correct passage,
# while out-of-scope questions peak at 0.33 (the worst case being a query
# that shares a proper noun with the corpus, e.g. "weather in Sheffield").
# 0.40 sits in that gap.
MIN_SCORE = 0.40


# ── chunking ──────────────────────────────────────────────────────────────

def chunk_text(text: str, size: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks, preferring paragraph boundaries."""
    text = re.sub(r"\n{3,}", "\n\n", (text or "").strip())
    if not text:
        return []

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= size:
            current = f"{current}\n\n{para}" if current else para
            continue
        if current:
            chunks.append(current)
        # A single oversized paragraph is hard-split.
        while len(para) > size:
            chunks.append(para[:size])
            para = para[size - overlap:]
        current = para

    if current:
        chunks.append(current)

    # Re-introduce overlap between adjacent chunks for continuity.
    if overlap and len(chunks) > 1:
        overlapped = [chunks[0]]
        for prev, nxt in zip(chunks, chunks[1:]):
            overlapped.append(prev[-overlap:] + "\n" + nxt)
        return overlapped

    return chunks


# ── embeddings ────────────────────────────────────────────────────────────

def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings. Returns one vector per input, in order."""
    if not texts:
        return []
    resp = _client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [d.embedding for d in resp.data]


def embed_one(text: str) -> list[float]:
    return embed_texts([text])[0]


# ── similarity ────────────────────────────────────────────────────────────

def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if not na or not nb:
        return 0.0
    return dot / (na * nb)


def top_matches(query_vec: list[float], records: list[dict], k: int,
                min_score: float = MIN_SCORE) -> list[dict]:
    """Rank records (each with 'embedding' and 'text') against the query."""
    scored = []
    for r in records:
        emb = r.get("embedding")
        if not emb:
            continue
        s = cosine(query_vec, emb)
        if s >= min_score:
            scored.append({**r, "score": s})
    scored.sort(key=lambda r: r["score"], reverse=True)
    return scored[:k]


# ── knowledge base loading ────────────────────────────────────────────────

def load_knowledge_files() -> list[dict]:
    """Read backend/knowledge/*.md and chunk them, tagged with their source."""
    out: list[dict] = []
    if not KNOWLEDGE_DIR.exists():
        return out
    for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        # The Provenance block records who authored the file and what backs it
        # up. That belongs with the artefact, not in the model's context, so it
        # is stripped before chunking.
        raw = re.split(r"\n-{3,}\n+## Provenance\b", raw, maxsplit=1)[0]
        title = raw.lstrip().split("\n", 1)[0].lstrip("# ").strip() or path.stem
        for i, chunk in enumerate(chunk_text(raw)):
            out.append({
                "source": "shefguide_knowledge",
                "title": title,
                "file": path.name,
                "chunk_index": i,
                "text": chunk,
            })
    return out


def build_context_block(kb_hits: list[dict], doc_hits: list[dict]) -> str | None:
    """Format retrieved passages for injection, labelled by where they came from."""
    parts: list[str] = []

    if kb_hits:
        body = "\n\n".join(
            f"[ShefGuide guidance — {h.get('title', 'general')}]\n{h['text'].strip()}"
            for h in kb_hits
        )
        parts.append(body)

    if doc_hits:
        body = "\n\n".join(
            f"[From the student's attached document"
            f"{' — ' + h['filename'] if h.get('filename') else ''}]\n{h['text'].strip()}"
            for h in doc_hits
        )
        parts.append(body)

    if not parts:
        return None
    return "\n\n".join(parts)
