"""One-off indexer for the ShefGuide knowledge base.

Run after editing anything in backend/knowledge/:

    ./venv/Scripts/python.exe index_knowledge.py

It re-chunks every markdown file, embeds the chunks, and replaces the
contents of the knowledge_chunks collection. Embedding a corpus this size
costs a fraction of a penny, so a full rebuild is simpler and safer than
trying to update incrementally.
"""

from database import knowledge_collection
from rag import load_knowledge_files, embed_texts


def main() -> None:
    records = load_knowledge_files()
    if not records:
        print("No markdown files found in backend/knowledge/ — nothing to index.")
        return

    print(f"Chunked {len(records)} passages from the knowledge base.")
    texts = [r["text"] for r in records]

    # Batch so a large corpus doesn't hit the request size limit.
    vectors: list[list[float]] = []
    BATCH = 64
    for i in range(0, len(texts), BATCH):
        vectors.extend(embed_texts(texts[i:i + BATCH]))
        print(f"  embedded {min(i + BATCH, len(texts))}/{len(texts)}")

    for rec, vec in zip(records, vectors):
        rec["embedding"] = vec

    knowledge_collection.delete_many({})
    knowledge_collection.insert_many(records)

    print(f"\nIndexed {len(records)} chunks into knowledge_chunks.")
    by_file: dict[str, int] = {}
    for r in records:
        by_file[r["file"]] = by_file.get(r["file"], 0) + 1
    for f, n in sorted(by_file.items()):
        print(f"  {f:38} {n:>3} chunks")


if __name__ == "__main__":
    main()
