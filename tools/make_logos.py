"""Genera i loghi in pixel art del sito.

    python3 tools/make_logos.py

Scrive:
  - assets/logo.svg            logo generale "The Library" (scaffale), angoli arrotondati
  - assets/icon.svg            lo stesso a tutto quadrato, per le icone (iPhone, Android)
  - assets/sections/<nome>.svg logo di ogni sezione (manga, libri, film, serie)
Il logo della sezione Videogiochi (assets/sections/games.svg) sono le cartucce disegnate in precedenza
e non viene rigenerato qui.
Le icone PNG (favicon, apple-touch-icon, icon-192/512) si ricavano da assets/icon.svg.
"""
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

LOGOS = {
    'library': ('#232b52', {
        'O': '#9a6a44', 'o': '#6e4a30', 'd': '#151a33', 'R': '#f25f6e', 'r': '#ff9aa5', 'B': '#6c8cff', 'b': '#9db2ff',
        'P': '#ff8fc8', 'p': '#ffc4e1', 'G': '#4fd18b', 'g': '#9bebc0', 'C': '#c3cadb', 'L': '#6c8cff', 'M': '#2a2f45',
        'm': '#ff7a7a', 'Y': '#f2c14e', 'y': '#ffe08f',
    }, [
        '................',
        '.OOOOOOOOOOOOOO.',
        '.OddddddddddddO.',
        '.OdRRdddPPddddO.',
        '.OdRRdBBPPdGGdO.',
        '.OdrrdbbppdggdO.',
        '.OdRRdBBPPdGGdO.',
        '.OdRRdBBPPdGGdO.',
        '.OooooooooooooO.',
        '.OdCCCddMMdYYdO.',
        '.OdCLLCdMMdYYdO.',
        '.OdCLLCdmmdyydO.',
        '.OdCCCCdMMdYYdO.',
        '.OdCCCCdMMdYYdO.',
        '.OOOOOOOOOOOOOO.',
        '.oo..........oo.',
    ]),
    'manga': ('#3a1f36', {'K': '#14101a', 'p': '#c94f8c', 'P': '#ff8fc8', 'W': '#fff4fa', 'D': '#2a2030', 'Y': '#f2c14e', 'w': '#e9d4e0'}, [
        '................',
        '...KKKKKKKKKKKK.',
        '...KpPPPPPPPPPK.',
        '...KpPWWWWWWWPK.',
        '...KpPWDWDWDWPK.',
        '...KpPWWWWWWWPK.',
        '...KpPPWWPPPPPK.',
        '...KpPPWPPPPPPK.',
        '...KpPPPPPPPPPK.',
        '...KpYYYYYYYYYK.',
        '...KpPPPPPPPPPK.',
        '...KpPDDDDDPPPK.',
        '...KpPPPPPPPPPK.',
        '...KKKKKKKKKKKK.',
        '....Kwwwwwwwwww.',
        '................',
    ]),
    'books': ('#3a3016', {'K': '#16120a', 'W': '#fff8e6', 'g': '#c9b68a', 'Y': '#d99a2b', 'R': '#ff6b7a'}, [
        '................',
        '................',
        '................',
        '..KKKKK..KKKKK..',
        '.KWWWWWK.KWWWWWK',
        'KWWWWWWKKWWWWWWK',
        'KWggggWKKWggggWK',
        'KWWWWWWKKWWWWWWK',
        'KWgggWWKKWgggWWK',
        'KWWWWWWKKWWWWWWK',
        'KWggggWKKWggggWK',
        'KWWWWWWKRWWWWWWK',
        'KYYYYYYKRYYYYYYK',
        '.KKKKKKKRKKKKKK.',
        '........R.......',
        '................',
    ]),
    'movies': ('#3a1c22', {'K': '#110c0e', 'W': '#f2f5fb', 'D': '#3a3340', 'R': '#ff6b7a', 'g': '#8e99b0'}, [
        '................',
        '................',
        '.KKKKKKKKKKKKKK.',
        '.KWWKKWWKKWWKKK.',
        '.KKKKKKKKKKKKKK.',
        '.KDDDDDDDDDDDDK.',
        '.KDWWWWWWWWWWDK.',
        '.KDDDDDDDDDDDDK.',
        '.KDggggggDDDDDK.',
        '.KDDDDDDDDDDDDK.',
        '.KDggggDDDDRRDK.',
        '.KDDDDDDDDDRRDK.',
        '.KKKKKKKKKKKKKK.',
        '................',
        '................',
        '................',
    ]),
    'series': ('#163636', {'K': '#0b1414', 'G': '#4fd1c5', 'g': '#2f9e94', 'S': '#1a2a4a', 's': '#6c8cff', 'O': '#f2c14e', 'a': '#c0c8d9'}, [
        '................',
        '....a.....a.....',
        '.....a...a......',
        '......a.a.......',
        '.KKKKKKKKKKKKKK.',
        '.KGGGGGGGGGGGGK.',
        '.KGKKKKKKKKGGGK.',
        '.KGKSsSSSSKGOGK.',
        '.KGKsSSSSSKGGGK.',
        '.KGKSSSSSSKGOGK.',
        '.KGKSSSSSSKGGGK.',
        '.KGKKKKKKKKGGGK.',
        '.KggggggggggggK.',
        '.KKKKKKKKKKKKKK.',
        '..KK........KK..',
        '................',
    ]),
}


def svg(name, rounded=True):
    bg, pal, rows = LOGOS[name]
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), name
    rects = []
    for y, row in enumerate(rows):
        x = 0
        while x < 16:
            c = row[x]
            if c == '.' or c not in pal:
                x += 1
                continue
            w = 1
            while x + w < 16 and row[x + w] == c:
                w += 1
            rects.append(f'<rect x="{x}" y="{y}" width="{w}" height="1" fill="{pal[c]}"/>')
            x += w
    back = f'<rect x="-1" y="-1" width="18" height="18" rx="3.5" fill="{bg}"/>' if rounded else f'<rect x="-1" y="-1" width="18" height="18" fill="{bg}"/>'
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 18 18" shape-rendering="crispEdges">'
            + back + ''.join(rects) + '</svg>\n')


def main():
    os.makedirs(os.path.join(ROOT, 'assets', 'sections'), exist_ok=True)
    open(os.path.join(ROOT, 'assets', 'logo.svg'), 'w').write(svg('library'))
    open(os.path.join(ROOT, 'assets', 'icon.svg'), 'w').write(svg('library', rounded=False))
    for name in ('manga', 'books', 'movies', 'series'):
        open(os.path.join(ROOT, 'assets', 'sections', f'{name}.svg'), 'w').write(svg(name))
    print('Loghi scritti in assets/ e assets/sections/')


if __name__ == '__main__':
    main()
