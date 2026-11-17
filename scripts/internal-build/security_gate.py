"""Narrow, expiring build-tool exception. Never authorizes public publication."""
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ADVISORY = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf'
EXCEPTION = '20261118-picomatch-internal'
EXPIRES = date(2026, 12, 2)
BLOCKED = {'picomatch', 'micromatch', 'anymatch', 'tinyglobby', 'glob', 'minimatch'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def assess(audit, lock, enabled=False, today=None, platform='android'):
    require(platform in ('android', 'ios'), 'Unknown internal-test platform')
    require(not audit.get('error') and audit.get('auditReportVersion') == 2, 'Invalid npm audit report')
    rows = audit.get('vulnerabilities')
    require(isinstance(rows, dict), 'Missing audit vulnerabilities')
    require(isinstance(audit.get('metadata', {}).get('vulnerabilities'), dict), 'Missing audit totals')
    for severity in ('high', 'critical'):
        require(audit['metadata']['vulnerabilities'].get(severity, 0) ==
                sum(row.get('severity') == severity for row in rows.values()), 'Inconsistent audit totals')
    used = set()

    def leaves(name, seen):
        require(name in rows, 'Unknown audit dependency: ' + name)
        if name in seen:
            return []
        via = rows[name].get('via')
        require(isinstance(via, list) and via, 'Missing advisory chain: ' + name)
        result = []
        for item in via:
            if isinstance(item, str):
                result.extend(leaves(item, seen | {name}))
            else:
                require(isinstance(item, dict) and item.get('severity'), 'Malformed advisory')
                result.append(item)
        return result

    for name, row in rows.items():
        if row.get('severity') not in ('high', 'critical'):
            continue
        require(row['severity'] != 'critical', 'Critical advisory is not excepted: ' + name)
        chain = leaves(name, set())
        high = [item for item in chain if item['severity'] in ('high', 'critical')]
        require(high, 'Unexplained high-severity dependency: ' + name)
        for item in high:
            require(enabled and item.get('name') == 'picomatch' and item.get('url') == ADVISORY
                    and item['severity'] == 'high', 'Unapproved high-severity advisory: ' + name)
            used.add(ADVISORY)
    if used:
        require((today or datetime.now(timezone.utc).date()) <= EXPIRES, 'Internal-test exception expired')
        nodes = rows.get('picomatch', {}).get('nodes', [])
        require(nodes, 'Missing picomatch dependency locations')
        for node in nodes:
            require(lock.get('packages', {}).get(node, {}).get('version') in ('2.3.2', '4.0.7'),
                    'Unreviewed picomatch version: ' + node)
    return {'exception': EXCEPTION if used else None, 'expires': EXPIRES.isoformat() if used else None,
            'advisories': sorted(used), 'scope': ('Android internal-test build only' if platform == 'android'
                                               else 'iOS TestFlight internal-test build only'),
            'runtimeVerificationRequired': bool(used), 'totals': audit['metadata']['vulnerabilities']}


def sources(mapping):
    require(isinstance(mapping, dict) and mapping.get('version') == 3, 'Invalid source map')
    result = list(mapping.get('sources', []))
    for section in mapping.get('sections', []):
        require('map' in section, 'External source-map section is unsupported')
        result.extend(sources(section['map']))
    require(all(isinstance(item, str) for item in result), 'Invalid source paths')
    return result


def runtime(mapping):
    paths = [item.replace('\\', '/') for item in sources(mapping)]
    require(len(paths) >= 100, 'Missing or unexpectedly small release source map')
    require(any('/src/' in item for item in paths), 'App sources missing from release map')
    require(any('/node_modules/react-native/' in item for item in paths), 'React Native sources missing')
    hits = sorted({item for item in paths if any(name in item.split('/') for name in BLOCKED)})
    require(not hits, 'Build-tool dependency entered runtime bundle: ' + ', '.join(hits))
    return {'sourceCount': len(paths), 'excludedPackages': sorted(BLOCKED), 'matches': hits}


def main():
    command = sys.argv[1]
    if command == 'audit':
        folder = Path('build/security')
        folder.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(['npm.cmd' if os.name == 'nt' else 'npm', 'audit', '--package-lock-only',
                                 '--ignore-scripts', '--json'], capture_output=True)
        (folder / 'npm-audit.json').write_bytes(result.stdout)
        require(result.returncode in (0, 1), 'npm audit could not complete')
        report = assess(json.loads(result.stdout), json.loads(Path('package-lock.json').read_text()),
                        os.environ.get('BC_INTERNAL_SECURITY_EXCEPTION') == EXCEPTION,
                        platform=os.environ.get('BC_INTERNAL_SECURITY_PLATFORM', 'android'))
        report['lockSha256'] = hashlib.sha256(Path('package-lock.json').read_bytes()).hexdigest()
        (folder / 'audit-decision.json').write_text(json.dumps(report, indent=2) + '\n')
        if report['exception']:
            print('::warning::Unpatched picomatch advisory retained under approved temporary internal-test exception; runtime exclusion must pass.')
        print(json.dumps(report))
    elif command in ('runtime', 'runtime-ios'):
        path = Path(sys.argv[2])
        report = runtime(json.loads(path.read_text()))
        report['sourceMapSha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        report['exceptionPolicy'] = EXCEPTION
        report['publicReleaseApproved'] = False
        platform = 'ios' if command == 'runtime-ios' else 'android'
        output = Path(f'build/internal-artifacts/{platform}/runtime-exclusion.json')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report))
    else:
        raise ValueError('Unknown command')


if __name__ == '__main__':
    main()
