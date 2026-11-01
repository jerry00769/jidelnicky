"""Read-only public menu -> safe weekly candidate JSON. Never modifies shared history."""
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path('strava_5948_kandidati.json')

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
    report = {'cafeteria': '5948', 'checked_at_utc': datetime.now(timezone.utc).isoformat(),
              'status': 'received', 'weeks': candidates, 'skipped_incomplete_weeks': skipped,
              'note': 'Pouze kandidáti. Žádný zápis do historie; vyžaduje schválení v aplikaci.'}
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Připraveno {len(candidates)} úplných týdnů, vynecháno {len(skipped)} neúplných.')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        OUT.write_text(json.dumps({'cafeteria': '5948', 'status': 'failed', 'error': str(exc)}, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'CHYBA: {type(exc).__name__}: {exc}', file=sys.stderr)
        sys.exit(1)
