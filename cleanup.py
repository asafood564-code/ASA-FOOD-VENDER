import os

with open('script.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines are 1-indexed in view_file, so 1261-1278 means indices 1260 to 1277
new_lines = lines[:1260] + lines[1278:]

with open('script.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Cleaned up script.js")
