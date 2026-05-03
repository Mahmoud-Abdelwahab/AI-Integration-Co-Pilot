#!/usr/bin/env python3
"""
CLI script to ingest and index Moyasar docs into ChromaDB.

Usage:
    python scripts/ingest.py
    python scripts/ingest.py --docs-dir /path/to/docs
    python scripts/ingest.py --no-reset  # incremental update
"""
import sys
import argparse
from pathlib import Path

# Ensure project root is in path
sys.path.insert(0, str(Path(__file__).parents[1]))

from app.services.index_service import run_indexing
from app.config.settings import settings
from app.utils.logger import get_logger

logger = get_logger("ingest")


def main():
    parser = argparse.ArgumentParser(description="Index Moyasar docs into ChromaDB")
    parser.add_argument(
        "--docs-dir",
        default=settings.docs_dir,
        help=f"Path to docs directory (default: {settings.docs_dir})",
    )
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help="Skip collection reset (incremental update)",
    )
    args = parser.parse_args()

    logger.info(f"Starting ingestion from: {args.docs_dir}")
    logger.info(f"Reset collection: {not args.no_reset}")

    result = run_indexing(docs_dir=args.docs_dir, reset=not args.no_reset)

    print("\n" + "=" * 50)
    print("INDEXING RESULTS")
    print("=" * 50)
    print(f"  Status        : {result['status']}")
    print(f"  Docs indexed  : {result.get('docs_indexed', 0)}")
    print(f"  Chunks stored : {result.get('chunks_stored', 0)}")
    print(f"  Total in DB   : {result.get('total_in_db', 0)}")
    print("=" * 50)

    if result["status"] != "success":
        sys.exit(1)


if __name__ == "__main__":
    main()
