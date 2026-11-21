import sys

def clean_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # We want to delete from line 1370 to 1701 (0-indexed: 1369 to 1700)
    # Actually let's use a more robust way: find the second occurrence of the onboarding header
    # and the first occurrence of renderStatusScreen after it.
    
    header = "// Sophisticated Onboarding & Authorization Flow"
    status_screen_func = "function renderStatusScreen() {"
    
    first_header_idx = -1
    second_header_idx = -1
    status_screen_idx = -1
    
    for i, line in enumerate(lines):
        if header in line:
            if first_header_idx == -1:
                first_header_idx = i
            else:
                second_header_idx = i
        if status_screen_func in line and second_header_idx != -1 and status_screen_idx == -1:
            status_screen_idx = i
            
    if second_header_idx != -1 and status_screen_idx != -1:
        print(f"Deleting lines from {second_header_idx+1} to {status_screen_idx}")
        new_lines = lines[:second_header_idx] + lines[status_screen_idx:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print("Successfully cleaned.")
    else:
        print(f"Could not find indices: second_header={second_header_idx}, status_screen={status_screen_idx}")

if __name__ == "__main__":
    clean_file('script.js')
