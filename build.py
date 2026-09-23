#!/usr/bin/env python3
"""Build a completely offline, single-file browser instrument."""
from pathlib import Path
root = Path(__file__).resolve().parent
html = (root / 'index.template.html').read_text()
for marker, source in [('STYLE', 'style.css'), ('ENGINE', 'engine.js'), ('APP', 'app.js')]:
    html = html.replace('/* ' + marker + ' */', (root / source).read_text())
(root / 'Clockwork-Garden.html').write_text(html)
(root / 'index.html').write_text(html)
print(f'Built Clockwork-Garden.html and index.html ({len(html.encode())} bytes each)')
