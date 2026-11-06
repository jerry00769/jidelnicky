"""Public Strava.cz 5948 -> complete, archived source weeks. No shared-state writes."""
import json
import re
import sys
import unicodedata
import argparse
import gzip
import hashlib
from urllib.request import Request, urlopen
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path('strava_5948.json')
FIELDS = ('soup', 'main', 'main2')

def folded(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.casefold()) if not unicodedata.combining(c))

def organization(name):
    value = folded(name.strip())
    return re.fullmatch(r'p\s*r\s*a\s*z\s*d\s*n\s*i\s*n\s*y|reditelske\s+volno|nevari\s+se|statni\s+svatek', value) is not None

def valid_day(day):
    if not isinstance(day, dict) or any(not isinstance(day.get(f, ''), str) for f in FIELDS):
        return False
    if day.get('closed') is True:
        return True
    names = [day.get(f, '').strip() for f in FIELDS]
    actual = [n for n in names if n and not organization(n)]
    if any(organization(n) for n in names):
        return not actual
    return bool(names[0] and names[1])

def parse_menu(raw):
    dates = defaultdict(lambda: {'values': dict.fromkeys(FIELDS, ''), 'expected': set(), 'conflict': False, 'closed': False})
    for group in raw if isinstance(raw, list) else [raw]:
        if not isinstance(group, dict):
            continue
        for rows in group.values():
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                try:
                    date = datetime.strptime(str(row.get('datum', '')), '%d.%m.%Y').date()
                except ValueError:
                    continue
                if date.weekday() > 4:
                    continue
                label = folded(str(row.get('druh_popis') or row.get('druh_chod') or ''))
                kind = str(row.get('druh') or '')
                name = str(row.get('nazev') or '').strip()
                if 'polevka' in label or kind == 'P':
                    field = 'soup'
                elif 'obed 2' in label:
                    field = 'main2'
                elif 'obed 1' in label or kind == '4':
                    field = 'main'
                elif organization(name):
                    field = 'soup'
                else:
                    continue
                slot = dates[date]
                slot['expected'].add(field)
                slot['closed'] |= row.get('closed') is True
                if not name or folded(name) in {'polevka', 'obed 1', 'obed 2'}:
                    continue
                if slot['values'][field] and slot['values'][field] != name:
                    slot['conflict'] = True
                slot['values'][field] = name
    weeks = defaultdict(lambda: [None] * 5)
    reasons = defaultdict(set)
    for date, slot in dates.items():
        monday = (date - timedelta(days=date.weekday())).isoformat()
        day = slot['values'].copy()
        actual = [n for n in day.values() if n and not organization(n)]
        marker = any(organization(n) for n in day.values())
        if slot['closed'] or (marker and not actual):
            day['closed'] = True
        if slot['conflict'] or (marker and actual):
            reasons[monday].add('conflicting_rows')
        elif 'main2' in slot['expected'] and not day['main2'] and not day.get('closed'):
            reasons[monday].add('missing_announced_lunch2')
        elif valid_day(day):
            weeks[monday][date.weekday()] = day
        else:
            weeks[monday]  # Explicit incomplete week, never infer a closure.
    complete, skipped = [], []
    for monday in sorted(set(weeks) | set(reasons)):
        days = weeks[monday]
        if all(days) and not reasons[monday]:
            complete.append({'week': monday, 'days': days})
        else:
            skipped.append({'week': monday, 'complete_days': sum(d is not None for d in days), 'reasons': sorted(reasons[monday]) or ['missing_days_or_meals']})
    return complete, skipped

def merge_archive(old, current, skipped):
    if old and (old.get('cafeteria') != '5948' or not isinstance(old.get('weeks'), list)):
        raise ValueError('Původní archiv nemá platný původ 5948; nebyl změněn.')
    archived = {}
    for week in (old or {}).get('weeks', []):
        date = datetime.strptime(week['week'], '%Y-%m-%d').date()
        if date.weekday() != 0 or len(week.get('days', [])) != 5 or not all(valid_day(d) for d in week['days']):
            raise ValueError('Původní archiv obsahuje neúplný týden; nebyl změněn.')
        if week['week'] in archived and archived[week['week']] != week:
            raise ValueError('Původní archiv obsahuje rozporné týdny.')
        archived[week['week']] = week
    for week in current:
        archived[week['week']] = week  # A complete published correction wins.
    if not archived:
        raise ValueError('Zdroj neobsahuje žádný úplný týden. Původní soubor zůstává.')
    return {'cafeteria': '5948', 'status': 'received', 'fetched_at_utc': datetime.now(timezone.utc).isoformat(),
            'weeks': [archived[k] for k in sorted(archived)], 'skipped_incomplete_weeks': skipped,
            'note': 'Archiv úplných týdnů Strava.cz 5948. Úplné opravy aktualizují archiv; neúplné týdny jej nepřepisují.'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--from-month', help='YYYYMM; explicit historical audit')
    parser.add_argument('--to-month', help='YYYYMM; inclusive')
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    index = now.year * 12 + now.month - 1
    def month_index(value):
        date = datetime.strptime(value, '%Y%m')
        return date.year * 12 + date.month - 1
    indices = range(month_index(args.from_month), month_index(args.to_month or now.strftime('%Y%m')) + 1) if args.from_month else range(index - 1, index + 2)
    if len(indices) > 120:
        raise ValueError('Příliš dlouhý rozsah měsíčního auditu.')
    from strava_history import parse_month
    rows, documents, errors = [], [], []
    for value in indices:
        year, zero_month = divmod(value, 12)
        month = f'{year}{zero_month + 1:02d}'
        url = f'https://strava.cz/Strava/Stravnik/JidelnickyHistorie?zarizeni=5948&datum={month}'
        try:
            request = Request(url, headers={'User-Agent': 'Jidelnicky-5948-source', 'X-Requested-With': 'XMLHttpRequest'})
            with urlopen(request, timeout=25) as response:
                body = response.read(3_000_001)
            if len(body) > 3_000_000:
                raise ValueError('Příliš velký zdrojový měsíc.')
            if body.startswith(b'\x1f\x8b'):
                body = gzip.decompress(body)
            parsed, observed = parse_month(body.decode('utf-8-sig'), month)
            rows.extend(parsed)
            documents.append({'month': month, 'url': url, 'sha256': hashlib.sha256(body).hexdigest(), 'retrievedAt': now.isoformat(), 'days': len(observed)})
        except Exception as exc:
            errors.append({'month': month, 'error': str(exc)})
    groups = [{'table0': rows}]
    try:
        # The current public menu adds today and published future days, which
        # the historical endpoint may not yet contain.
        from strava_cz_api import Public
        raw = Public.getJidelnicek('5948')
        groups.extend(raw if isinstance(raw, list) else [raw])
    except Exception as exc:
        errors.append({'current_public_menu': str(exc)})
    if not documents:
        raise ValueError('Nepodařilo se získat žádný měsíční zdroj; archiv nebyl změněn.')
    current, skipped = parse_menu(groups)
    if not current:
        raise ValueError('Nový zdroj neobsahuje úplný týden; archiv nebyl změněn.')
    old = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else None
    report = merge_archive(old, current, skipped)
    old_documents = {d['month']: d for d in (old or {}).get('sourceDocuments', []) if 'month' in d}
    old_documents.update({d['month']: d for d in documents})
    report['sourceDocuments'] = list(old_documents.values())
    report['sourceErrors'] = errors
    if (old or {}).get('historicalAudit'):
        report['historicalAudit'] = old['historicalAudit']
    evidence = dict((old or {}).get('weekEvidence', {}))
    for week in current:
        start = datetime.strptime(week['week'], '%Y-%m-%d')
        months = {(start + timedelta(days=i)).strftime('%Y%m') for i in range(5)}
        evidence[week['week']] = [d for d in documents if d['month'] in months]
    report['weekEvidence'] = evidence
    temporary = OUT.with_suffix('.tmp')
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(OUT)
    print(f'Archiv: {len(report["weeks"])} týdnů, nyní úplných: {len(current)}, neúplných: {len(skipped)}.')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print(f'CHYBA: {type(exc).__name__}: {exc}', file=sys.stderr)
        sys.exit(1)
