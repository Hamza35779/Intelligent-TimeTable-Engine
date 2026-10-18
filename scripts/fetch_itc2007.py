#!/usr/bin/env python3
"""
Fetch the official ITC-2007 Track 3 (Curriculum-Based Course Timetabling)
benchmark instances (comp01 to comp21) and the official problem description PDF.
"""

import os
import sys
import urllib.request
import urllib.error

BASE_DATASET_URL = (
    "https://raw.githubusercontent.com/Docheinstein/itc2007-cct/master/datasets/"
)
BASE_DOC_URL = (
    "https://raw.githubusercontent.com/Docheinstein/itc2007-cct/master/docs/itc2007.pdf"
)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INSTANCES_DIR = os.path.join(ROOT_DIR, "benchmarks", "itc2007", "instances")
DOCS_DIR = os.path.join(ROOT_DIR, "benchmarks", "itc2007", "docs")


def download_file(url: str, dest_path: str) -> bool:
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
        print(f"  [OK] Already exists: {os.path.basename(dest_path)}")
        return True

    print(f"  [..] Fetching {os.path.basename(dest_path)} from {url}...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ITC2007-Benchmark-Fetcher/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            with open(dest_path, "wb") as f:
                f.write(content)
        print(f"  [OK] Saved {os.path.basename(dest_path)} ({len(content)} bytes)")
        return True
    except urllib.error.URLError as err:
        print(f"  [FAIL] Could not fetch {url}: {err}")
        return False


def main():
    print("=" * 60)
    print("Fetching ITC-2007 Track 3 (CB-CTT) Benchmark Datasets")
    print("=" * 60)

    # 1. Download official document
    pdf_dest = os.path.join(DOCS_DIR, "itc2007_track3_description.pdf")
    download_file(BASE_DOC_URL, pdf_dest)

    # 2. Download comp01.ctt to comp21.ctt
    success_count = 0
    total_count = 21
    for i in range(1, total_count + 1):
        filename = f"comp{i:02d}.ctt"
        url = BASE_DATASET_URL + filename
        dest = os.path.join(INSTANCES_DIR, filename)
        if download_file(url, dest):
            success_count += 1

    print("-" * 60)
    print(f"Downloaded {success_count}/{total_count} benchmark instances into {INSTANCES_DIR}")
    if success_count < total_count:
        sys.exit(1)


if __name__ == "__main__":
    main()
