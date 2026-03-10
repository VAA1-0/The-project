# create_req.py
import re

# Read environment.yml manually
with open('environment.yml', 'r') as f:
    content = f.read()

# Extract pip section using regex
pip_section_match = re.search(r'- pip:(.*?)(?=\n\s*\n|\n\s*-|\Z)', content, re.DOTALL)
if pip_section_match:
    pip_section = pip_section_match.group(1)
    # Extract package names
    packages = re.findall(r'^\s+-\s+(.+)$', pip_section, re.MULTILINE)
else:
    packages = []

# Essential packages (add these first)
essential_packages = [
    'torch==2.9.0',
    'torchaudio==2.9.0', 
    'torchvision==0.24.0',
    'numpy==2.2.6',
    'pandas==2.3.3',
    'scipy==1.15.3',
    'matplotlib==3.10.7',
    'pillow==12.0.0',
    'opencv-python==4.12.0.88',
    'opencv-python-headless==4.12.0.88'
]

# Combine packages
all_packages = essential_packages + packages

# Remove duplicates
unique_packages = []
seen = set()
for pkg in all_packages:
    # Extract package name (without version specifiers)
    pkg_name = re.split(r'[<>=!~]', pkg)[0].strip()
    if pkg_name not in seen:
        unique_packages.append(pkg)
        seen.add(pkg_name)

# Write to requirements.txt
with open('requirements.txt', 'w') as f:
    for pkg in unique_packages:
        f.write(pkg + '\n')

print(f"Created requirements.txt with {len(unique_packages)} packages")