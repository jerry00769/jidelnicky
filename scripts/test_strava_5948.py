"""Read-only sample of public menu rows; no credentials or personal information."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

OUT = Path('strava_5948_diagnostika.json')
FIELDS = ('datum', 'chod', 'druh', 'druh_popis', 'nazev', 'polevka', 'druh_chod', 'multipleNazev')

def main():
    try:
        from strava_cz_api import Public
        data = Public.getJidelnicek('5948')
        if not isinstance(data, (list, dict)) or not data:
            raise ValueError('Odpověď je prázdná nebo nemá očekávaný formát')
        groups = data if isinstance(data, list) else [data]
        tables = []
        for group in groups:
            if not isinstance(group, dict):
                continue
            for key, rows in group.items():
                if not isinstance(rows, list):
                    continue
                samples = [{field: str(row.get(field, ''))[:250] for field in FIELDS if field in row}
                           for row in rows[:3] if isinstance(row, dict)]
                tables.append({'table': str(key), 'count': len(rows), 'samples': samples})
        report = {'checked_at_utc': datetime.now(timezone.utc).isoformat(),
                  'cafeteria': '5948', 'status': 'received', 'tables': tables}
        OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'Načteno {len(tables)} tabulek, uloženy maximálně 3 veřejné položky z každé.')
        return 0 if tables else 2
    except Exception as exc:
        OUT.write_text(json.dumps({'cafeteria':'5948','status':'failed','error_type':type(exc).__name__},indent=2),encoding='utf-8')
        print(f'CHYBA: {type(exc).__name__}: {exc}', file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
