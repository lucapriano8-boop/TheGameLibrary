"""Aggiorna il numero di versione del sito.

Da eseguire PRIMA di ogni commit che modifica il codice (HTML, CSS, JS, immagini):
    python3 tools/bump_version.py

Cosa fa:
  - scrive la nuova versione in version.json
  - aggiorna ?v=... su CSS e JS in index.html, così il browser scarica i file nuovi
  - aggiorna <meta name="app-version">: il sito confronta questo valore con version.json
    e, se è uscita una versione nuova, si ricarica da solo.
I commit dei soli dati (data/*.json) non hanno bisogno di questo passaggio.
"""
import datetime
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def main():
    version = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')

    index = os.path.join(ROOT, 'index.html')
    html = open(index, encoding='utf-8').read()
    html, n_assets = re.subn(r'((?:href|src)="(?:css|js)/[\w.-]+\.(?:css|js))(?:\?v=[\w.-]+)?"', rf'\1?v={version}"', html)
    html, n_meta = re.subn(r'<meta name="app-version" content="[^"]*">', f'<meta name="app-version" content="{version}">', html)
    if n_meta != 1:
        raise SystemExit('meta app-version non trovato in index.html')
    open(index, 'w', encoding='utf-8').write(html)

    with open(os.path.join(ROOT, 'version.json'), 'w', encoding='utf-8') as f:
        json.dump({'version': version}, f)
        f.write('\n')
    print(f'Versione {version} ({n_assets} file CSS/JS aggiornati)')


if __name__ == '__main__':
    main()
