"""Bundle the dependency-free app; keep source and verification with delivery."""
from pathlib import Path
import json
import zipfile

app = Path(__file__).resolve().parent
root = app.parent
html = (app / 'index.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + (app / 'style.css').read_text(encoding='utf-8') + '\n</style>')
# External deferred scripts execute after the DOM. Inline equivalents go before </body>.
html = html.replace('<script src="core.js" defer></script>', '').replace('<script src="app.js" defer></script>', '')
scripts = '\n'.join('<script>\n' + (app / name).read_text(encoding='utf-8') + '\n</script>' for name in ['core.js', 'app.js'])
html = html.replace('</body>', scripts + '\n</body>')
assert 'src="app.js"' not in html and 'href="style.css"' not in html
standalone = root / 'Memory-Grid.html'
standalone.write_text(html, encoding='utf-8')
archive = root / 'Memory-Grid.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(standalone, standalone.name)
    for path in sorted(app.rglob('*')):
        if path.is_file() and '__pycache__' not in path.parts:
            z.write(path, path.relative_to(root))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    entries = z.namelist()
print(json.dumps({'standalone': str(standalone), 'standalone_bytes': standalone.stat().st_size, 'archive': str(archive), 'archive_bytes': archive.stat().st_size, 'entries': entries}, indent=2))
