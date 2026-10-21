"""Build the site font: a subset of jf open huninn (粉圓體) covering the characters the site uses.

OFL 1.1 treats a subset as a Modified Version, which may not use the Reserved Font Names
('open huninn', 'huninn', 'Varela'), so the subset is renamed "GuanXi Round".

Run after changing page text or spots.json:  npm run fonts
Requires: pip install fonttools brotli
"""
import glob
import json
import pathlib
import shutil

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'data-src/fonts/jf-openhuninn-2.0.ttf'
OUT = ROOT / 'assets/fonts/guanxi-round.woff2'
FAMILY = 'GuanXi Round'
PS_NAME = 'GuanXiRound-Regular'

# Words that arrive at runtime from CWA and the browser clock, beyond what the source files contain.
EXTRA = (
    '晴多雲陰時短暫陣雨雷午後有霧局部大豪雪山區偶降小中強颱風靄'
    '年月日時分秒星期一二三四五六日今昨明天早晚上下午'
    '東西南北偏風級每公尺攝氏度至舒適悶熱寒冷涼'
    '０１２３４５６７８９％°℃·・—–～「」『』（）、。，：；！？…'
)


def site_text() -> str:
    parts = [EXTRA]
    for pattern in ('index.html', 'src/**/*.js'):
        for path in glob.glob(str(ROOT / pattern), recursive=True):
            parts.append(pathlib.Path(path).read_text(encoding='utf-8'))
    data = json.loads((ROOT / 'data/spots.json').read_text(encoding='utf-8'))
    parts.append(json.dumps(data, ensure_ascii=False))
    parts.append(''.join(chr(c) for c in range(0x20, 0x7F)))
    return ''.join(parts)


def main() -> None:
    wanted = sorted({ch for ch in site_text() if ch.isprintable()})
    font = TTFont(SRC)
    cmap = font.getBestCmap()
    covered = [ch for ch in wanted if ord(ch) in cmap]

    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    sub = subset.Subsetter(options)
    sub.populate(unicodes=[ord(ch) for ch in covered])
    sub.subset(font)

    name = font['name']
    for rec in list(name.names):
        if rec.nameID in (1, 4, 16, 21):
            rec.string = FAMILY
        elif rec.nameID in (3, 6, 20):
            rec.string = PS_NAME
        elif rec.nameID == 2:
            rec.string = 'Regular'
    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = 'woff2'
    font.save(OUT)

    (OUT.parent / 'guanxi-round.chars.txt').write_text(''.join(covered), encoding='utf-8')
    shutil.copyfile(ROOT / 'data-src/fonts/OFL.txt', OUT.parent / 'OFL.txt')
    print(f'{OUT.name}: {len(covered)} glyphs, {OUT.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
