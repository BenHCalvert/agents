#!/usr/bin/env python3
"""
Pre-processes raw Jira CSV exports for the customer intelligence agent.

- Keeps only columns useful for analysis
- Consolidates repeated Comment columns into a single "Comments" field
- Consolidates repeated Label columns into a single "Labels" field
- Typically achieves 90%+ file size reduction
"""

import csv
import os
import sys

KEEP_COLUMNS = {
    "summary",
    "issue key",
    "issue id",
    "issue type",
    "status",
    "priority",
    "resolution",
    "reporter",
    "assignee",
    "created",
    "updated",
    "resolved",
    "description",
    "components",
    "status category",
}

KEEP_CUSTOM_FIELD_PATTERNS = [
    "arr impacted",
    "companies / accounts",
    "customer name/district name",
    "customer impact",
    "product area",
    "severity",
    "zendesk ticket count",
    "zendesk ticket ids",
    "district name",
    "district id",
    "district url",
    "account type",
    "user tier",
    "sentiment",
    "issue tier",
    "client temperature",
    "product ",
    "feedback category",
    "source",
    "revenue impact",
    "company name",
    "issue reason",
    "root cause",
    "workaround",
    "affected services",
    "affected user impact",
    "incident severity",
    "sis vendor",
    "sis",
]

COMMENT_SEPARATOR = "\n---\n"
LABEL_SEPARATOR = "; "

csv.field_size_limit(sys.maxsize)


def should_keep(header: str) -> bool:
    lower = header.lower().strip()
    if lower in KEEP_COLUMNS:
        return True
    if lower.startswith("custom field ("):
        field_name = lower[len("custom field (") : -1]
        return any(p in field_name for p in KEEP_CUSTOM_FIELD_PATTERNS)
    return False


def preprocess_file(input_path: str, output_dir: str) -> None:
    filename = os.path.basename(input_path)
    output_path = os.path.join(output_dir, filename)

    print(f"Processing {filename}...")

    with open(input_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        headers = next(reader)

        # Identify columns to consolidate (Comment, Labels)
        comment_indices = [i for i, h in enumerate(headers) if h.strip() == "Comment"]
        label_indices = [i for i, h in enumerate(headers) if h.strip() == "Labels"]
        consolidated_indices = set(comment_indices + label_indices)

        # Identify columns to keep as-is
        keep_indices = [
            i
            for i, h in enumerate(headers)
            if i not in consolidated_indices and should_keep(h)
        ]

        # Build output headers
        out_headers = [headers[i].strip() for i in keep_indices]
        if comment_indices:
            out_headers.append("Comments")
        if label_indices:
            out_headers.append("Labels")

        input_size = os.path.getsize(input_path)
        row_count = 0

        with open(output_path, "w", encoding="utf-8", newline="") as out_f:
            writer = csv.writer(out_f)
            writer.writerow(out_headers)

            for row in reader:
                out_row = [row[i].strip() if i < len(row) else "" for i in keep_indices]

                if comment_indices:
                    comments = [
                        row[i].strip()
                        for i in comment_indices
                        if i < len(row) and row[i].strip()
                    ]
                    out_row.append(COMMENT_SEPARATOR.join(comments))

                if label_indices:
                    labels = [
                        row[i].strip()
                        for i in label_indices
                        if i < len(row) and row[i].strip()
                    ]
                    # Deduplicate labels while preserving order
                    seen = set()
                    unique_labels = []
                    for label in labels:
                        if label not in seen:
                            seen.add(label)
                            unique_labels.append(label)
                    out_row.append(LABEL_SEPARATOR.join(unique_labels))

                writer.writerow(out_row)
                row_count += 1

    output_size = os.path.getsize(output_path)
    reduction = (1 - output_size / input_size) * 100

    print(f"  {len(headers)} columns -> {len(out_headers)} columns")
    print(f"  {row_count} data rows")
    print(
        f"  {input_size / 1024 / 1024:.1f} MB -> {output_size / 1024 / 1024:.1f} MB ({reduction:.1f}% reduction)"
    )
    print(f"  Output: {output_path}")


def main():
    if len(sys.argv) < 3:
        print(
            "Usage: python3 scripts/preprocess-jira-csv.py <output-dir> <input-file1> [input-file2] ..."
        )
        print()
        print("Example:")
        print(
            "  python3 scripts/preprocess-jira-csv.py ./data/jira ~/Downloads/bugs-2026-03-02.csv ~/Downloads/requests-2026-03-02.csv"
        )
        sys.exit(1)

    output_dir = sys.argv[1]
    input_files = sys.argv[2:]

    os.makedirs(output_dir, exist_ok=True)

    print(f"Output directory: {output_dir}")
    print(f"Processing {len(input_files)} file(s)...\n")

    for input_file in input_files:
        preprocess_file(input_file, output_dir)
        print()

    print("Done.")


if __name__ == "__main__":
    main()
