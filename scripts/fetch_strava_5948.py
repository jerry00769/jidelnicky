"""Read-only public menu -> safe weekly candidate JSON. Never modifies shared history."""
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path('strava_5948.json')

def main():
    from strava_cz_api import Public
    raw = Public.getJidelnicek('5948')
    groups = raw if isinstance(raw, list) else [raw]
    bydate = defaultdict(lambda: {'soup': '', 'main': '', 'main2': ''})
    for group in groups:
        if not isinstance(group, dict):
            continue
        for rows in group.values():
            if not isinstance(rows, list):
                continue
            for item in rows:
                if not isinstance(item, dict):
                    continue
                try:
                    day = datetime.strptime(str(item.get('datum', '')), '%d.%m.%Y').date()
                except ValueError:
                    continue
                if day.weekday() > 4:
                    continue
                name = str(item.get('nazev') or '').strip()
                if not name or name.casefold() in {'oběd 1', 'oběd 2', 'polévka', 'obed 1', 'obed 2'}:
                    continue
                label = str(item.get('druh_popis') or item.get('druh_chod') or '').casefold()
                kind = str(item.get('druh') or '')
                if 'polévka' in label or kind == 'P':
                    key = 'soup'
                elif 'oběd 2' in label:
                    key = 'main2'
                elif 'oběd 1' in label or kind == '4':
                    key = 'main'
                else:
                    continue  # beverages, supplements and unknown types
                previous = bydate[day][key]
                if previous and previous != name:
                    raise ValueError(f'Konflikt {day} {key}: {previous!r} / {name!r}')
                bydate[day][key] = name
    weeks = defaultdict(lambda: [None] * 5)
    for day, values in bydate.items():
        monday = day - timedelta(days=day.weekday())
        if values['soup'] and values['main']:
            weeks[monday.isoformat()][day.weekday()] = values
    candidates = [{'week': week, 'days': days} for week, days in sorted(weeks.items()) if all(days)]
    skipped = [{'week': week, 'complete_days': sum(bool(d) for d in days)} for week, days in sorted(weeks.items()) if not all(days)]
    # Zachovej kompletní týdny z předchozích běhů pro návrat po dovolené.
    # Již archivovaný týden nikdy automaticky nepřepisuj novější verzí.
    archived = {}
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding='utf-8'))
            if old.get('cafeteria') == '5948':
                archived = {w['week']: w for w in old.get('weeks', []) if isinstance(w, dict) and isinstance(w.get('week'), str) and isinstance(w.get('days'), list) and len(w['days']) == 5}
        except (ValueError, OSError, TypeError, KeyError):
            archived = {}
    # Aktuální zveřejněné týdny aktualizuj, historické ponech v archivu.
    for w in candidates:
        archived[w['week']] = w
    candidates = [archived[key] for key in sorted(archived)]
    report = {'cafeteria': '5948', 'checked_at_utc': datetime.now(timezone.utc).isoformat(),
              'status': 'received', 'weeks': candidates, 'skipped_incomplete_weeks': skipped,
              'note': 'Archiv úplných zveřejněných týdnů. Historii mění až WEB po kontrole kategorií.'}
    if not candidates:
        raise ValueError('Zdroj neobsahuje žádný úplný zveřejněný týden. Původní soubor zůstává beze změny.')
    # Nezapisovat timestamp: jinak by se commitovalo při každé kontrole.
    report.pop('checked_at_utc', None)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Připraveno {len(candidates)} úplných týdnů, vynecháno {len(skipped)} neúplných.')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        # Při chybě nikdy nepřepisovat poslední platný soubor.
        print(f'CHYBA: {type(exc).__name__}: {exc}', file=sys.stderr)
        sys.exit(1)
