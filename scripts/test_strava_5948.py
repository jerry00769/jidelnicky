"""Read-only diagnostic of public Strava.cz menu for cafeteria 5948."""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

OUTPUT = Path('strava_5948_diagnostika.json')


def shape(value, depth=0):
    """Return structure and limited, redacted examples, never credentials."""
    if depth >= 4:
        return type(value).__name__
    if isinstance(value, dict):
        return {str(k): shape(v, depth + 1) for k, v in list(value.items())[:30]}
    if isinstance(value, list):
        return {'type': 'list', 'count': len(value), 'first': shape(value[0], depth + 1) if value else None}
    if isinstance(value, str):
        return {'type': 'str', 'length': len(value), 'example': value[:120] if depth >= 2 else None}
    return value if isinstance(value, (int, float, bool)) or value is None else type(value).__name__


def main():
    try:
        from strava_cz_api import Public
        data = Public.getJidelnicek('5948')
        if not isinstance(data, (dict, list)):
            raise ValueError(f'Unexpected response type: {type(data).__name__}')
        report = {
            'checked_at_utc': datetime.now(timezone.utc).isoformat(),
            'cafeteria': '5948',
            'status': 'received',
            'structure': shape(data),
        }
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print('Strava.cz odpověděla. Struktura odpovědi uložena jako diagnostický artefakt.')
        if not data:
            print('VAROVÁNÍ: odpověď je prázdná.'); return 2
        return 0
    except Exception as exc:
        print(f'CHYBA: {type(exc).__name__}: {exc}', file=sys.stderr)
        OUTPUT.write_text(json.dumps({'cafeteria':'5948','status':'failed','error_type':type(exc).__name__}, ensure_ascii=False, indent=2), encoding='utf-8')
        return 1

if __name__ == '__main__':
    sys.exit(main())
