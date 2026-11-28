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

def parse_date(value):
    value = str(value or '').strip()
    if re.fullmatch(r'\d{1,2}\.\s*\d{1,2}\.\s*\d{4}', value):
        return datetime.strptime(re.sub(r'\s+', '', value), '%d.%m.%Y').date()
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:[T ].*)?', value):
        return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
    raise ValueError('Unrecognized date')


def parse_menu_details(raw):
    if isinstance(raw, str):
        raw = json.loads(raw)
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
                    date = parse_date(row.get('datum'))
                except ValueError:
                    continue
                if date.weekday() > 4:
                    continue
                label = ' '.join(folded(str(row.get('druh_popis') or row.get('druh_chod') or '')).split())
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
                slot['closed'] |= row.get('closed') is True
                if not name or ' '.join(folded(name).split()) in {'polevka', 'obed 1', 'obed 2'}:
                    continue
                slot['expected'].add(field)
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
        weeks[monday]  # Retain dates even when rejected.
        if slot['conflict'] or (marker and actual):
            reasons[monday].add('conflicting_rows')
            print(f'::warning::Strava {date}: conflicting_rows; den nepřevzat.', file=sys.stderr)
        elif 'main2' in slot['expected'] and not day['main2'] and not day.get('closed'):
            reasons[monday].add('missing_announced_lunch2')
        elif valid_day(day):
            weeks[monday][date.weekday()] = day
        else:
            weeks[monday]  # Explicit incomplete week, never infer a closure.
            print(f'Strava {date}: chybí polévka nebo Oběd 1.', file=sys.stderr)
    complete, skipped, partial = [], [], []
    for monday in sorted(set(weeks) | set(reasons)):
        days = weeks[monday]
        if all(days) and not reasons[monday]:
            complete.append({'week': monday, 'days': days})
        else:
            skipped.append({'week': monday, 'complete_days': sum(d is not None for d in days), 'reasons': sorted(reasons[monday]) or ['missing_days_or_meals']})
            if any(days):
                start = datetime.fromisoformat(monday)
                partial.append({'week': monday, 'days': days,
                                'missingDates': [(start + timedelta(days=i)).date().isoformat() for i, day in enumerate(days) if day is None]})
    return complete, skipped, partial

def parse_menu(raw):
    complete, skipped, _ = parse_menu_details(raw)
    return complete, skipped

def combine_sources(historical, public):
    """Validate each source separately. Current public menu wins per valid day.

    Never combine individual meal fields across conflicting sources. Missing
    or invalid rows are not closure evidence; valid history remains fallback.
    """
    def by_week(raw):
        full, skipped, partial = parse_menu_details(raw)
        return {w['week']: w['days'] for w in [*partial, *full]}, skipped
    old, old_skipped = by_week(historical)
    live, live_skipped = by_week(public) if public is not None else ({}, [])
    print('Historický zdroj:', len(old), 'týdnů; aktuální veřejný zdroj:', len(live), 'týdnů.')
    if public is not None and not live:
        print('::warning::Aktuální veřejný zdroj neobsahuje žádný rozpoznaný úplný den; použity pouze doložené historické dny.', file=sys.stderr)
    for key, days in sorted(live.items()):
        start = datetime.fromisoformat(key).date()
        print('Veřejný zdroj', key + ':', ', '.join(f'{start + timedelta(days=i)}={"OK" if day is not None else "CHYBÍ"}' for i,day in enumerate(days)))
    complete, skipped, partial = [], [], []
    for key in sorted(set(old) | set(live)):
        start = datetime.fromisoformat(key).date()
        days = []
        for i in range(5):
            h = old.get(key, [None]*5)[i]
            p = live.get(key, [None]*5)[i]
            if p is not None and h is not None and p != h:
                print(f'Strava {start + timedelta(days=i)}: rozdíl zdrojů, použit aktuální veřejný den.')
            days.append(p if p is not None else h)
        if all(d is not None for d in days):
            complete.append({'week': key, 'days': days})
        else:
            missing = [(start + timedelta(days=i)).isoformat() for i,d in enumerate(days) if d is None]
            skipped.append({'week': key, 'complete_days': 5-len(missing), 'reasons': ['missing_days_or_meals']})
            partial.append({'week': key, 'days': days, 'missingDates': missing})
            print(f'Strava týden {key}: chybí {", ".join(missing)}.')
    # Keep diagnostics for completely rejected weeks, without importing them.
    represented = set(old) | set(live)
    for item in old_skipped + live_skipped:
        if item['week'] not in represented and not any(w['week']==item['week'] for w in skipped):
            skipped.append(item)
    return complete, skipped, partial


def merge_archive(old, current, skipped, partial=None):
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
    partial_by_week = {w['week']: w for w in (old or {}).get('partialWeeks', [])}
    for week in partial or []:
        prior = partial_by_week.get(week['week'])
        days = [day or (prior['days'][i] if prior else None) for i, day in enumerate(week['days'])]
        start = datetime.fromisoformat(week['week'])
        partial_by_week[week['week']] = {**week, 'days': days,
            'missingDates': [(start + timedelta(days=i)).date().isoformat() for i, day in enumerate(days) if day is None]}
    if not archived and not partial_by_week:
        raise ValueError('Zdroj neobsahuje žádný úplný týden. Původní soubor zůstává.')
    return {'cafeteria': '5948', 'status': 'received', 'fetched_at_utc': datetime.now(timezone.utc).isoformat(),
            'weeks': [archived[k] for k in sorted(archived)], 'skipped_incomplete_weeks': skipped,
            'partialWeeks': [partial_by_week[k] for k in sorted(partial_by_week) if k not in archived],
            'calendarClosures': (old or {}).get('calendarClosures', {}),
            'note': 'Úplné týdny a doložené jednotlivé dny Strava.cz 5948. Chybějící menu není potvrzením uzavření.'}

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
    historical = {'table0': rows}
    public = None
    public_ok = False
    public_document = None
    try:
        # The current public menu adds today and published future days, which
        # the historical endpoint may not yet contain.
        from strava_cz_api import Public
        raw = Public.getJidelnicek('5948')
        if isinstance(raw, str):
            raw = json.loads(raw)
        public = raw
        if not isinstance(raw, (list, dict)):
            raise ValueError('Neočekávaný formát veřejného jídelníčku')
        public_ok = True
        public_document = {'url': 'https://app.strava.cz/api/jidelnicky', 'cafeteria': '5948',
                           'retrievedAt': now.isoformat(), 'sha256': hashlib.sha256(json.dumps(raw, ensure_ascii=False, sort_keys=True).encode()).hexdigest()}
    except Exception as exc:
        public = None
        errors.append({'current_public_menu': str(exc)})
        print(f'::warning::Aktuální veřejný zdroj Strava.cz: {exc}', file=sys.stderr)
    if not documents and not public_ok:
        raise ValueError('Nepodařilo se získat žádný měsíční zdroj; archiv nebyl změněn.')
    current, skipped, partial = combine_sources(historical, public)
    for error in errors:
        if 'month' in error:
            print(f'::warning::Strava měsíc {error["month"]}: {error["error"]}', file=sys.stderr)
    if not args.from_month:
        first_week = (now.date() - timedelta(days=now.weekday())).isoformat()
        partial = [w for w in partial if w['week'] >= first_week]
    if not current and not partial:
        raise ValueError('Nový zdroj neobsahuje úplný týden; archiv nebyl změněn.')
    old = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else None
    for week in partial:
        week['retrievedAt'] = now.isoformat()
        week['documents'] = [public_document] if public_document else [d for d in documents if d['month'] == week['week'][:7].replace('-', '')]
    report = merge_archive(old, current, skipped, partial)
    report['retrievedAt'] = report['fetched_at_utc']
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
        evidence[week['week']] = [d for d in documents if d['month'] in months] + ([public_document] if public_document else [])
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
