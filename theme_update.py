import os

replacements = {
    'red-50': 'amber-50',
    'red-100': 'amber-100',
    'red-200': 'amber-200',
    'red-500': 'amber-500',
    'red-600': 'amber-600',
    'red-700': 'amber-700',
    'red-800': 'amber-800',
    'red-900': 'amber-900',
    'shadow-red-': 'shadow-amber-',
    'ring-red-': 'ring-amber-',
    'hover:bg-red-700': 'hover:bg-amber-600',
    '#D32F2F': '#FFC107',
    'rgba(211, 47, 47': 'rgba(255, 193, 7',
    'toggle-red-switch': 'toggle-yellow-switch',
    'red-slider': 'yellow-slider'
}

files = ['script.js', 'style.css', 'index.html']

for filename in files:
    if not os.path.exists(filename):
        continue
        
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Updated {filename}")
