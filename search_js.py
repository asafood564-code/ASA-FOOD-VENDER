import re

file_path = "script.js"
query = "sendOTP"

print(f"Searching for '{query}' in {file_path}...")
with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_num, line in enumerate(f, 1):
        if re.search(query, line, re.IGNORECASE):
            print(f"Line {line_num}: {line.strip()}")
