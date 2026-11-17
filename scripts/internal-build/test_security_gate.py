from datetime import date
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('gate', Path(__file__).with_name('security_gate.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class SecurityGate(unittest.TestCase):
    def setUp(self):
        self.audit = {'auditReportVersion': 2, 'metadata': {'vulnerabilities': {'high': 2}}, 'vulnerabilities': {
            'picomatch': {'severity': 'high', 'nodes': ['node_modules/picomatch'], 'via': [
                {'name': 'picomatch', 'severity': 'high', 'url': gate.ADVISORY}]},
            'tool': {'severity': 'high', 'via': ['picomatch']}}}
        self.lock = {'packages': {'node_modules/picomatch': {'version': '4.0.7'}}}
        self.today = date(2026, 11, 18)

    def check(self, enabled=True):
        return gate.assess(self.audit, self.lock, enabled, self.today)

    def test_exact_advisory_and_inherited_findings(self):
        self.assertEqual(self.check()['exception'], gate.EXCEPTION)

    def test_no_exception_outside_internal_build(self):
        with self.assertRaises(ValueError): self.check(False)

    def test_expiry(self):
        self.today = date(2026, 12, 3)
        with self.assertRaises(ValueError): self.check()

    def test_different_high_advisory_fails(self):
        self.audit['vulnerabilities']['picomatch']['via'][0]['url'] = 'https://example.com/new'
        with self.assertRaises(ValueError): self.check()

    def test_critical_fails_even_same_package(self):
        self.audit['vulnerabilities']['picomatch']['via'][0]['severity'] = 'critical'
        with self.assertRaises(ValueError): self.check()

    def test_new_version_requires_review(self):
        self.lock['packages']['node_modules/picomatch']['version'] = '5.0.0'
        with self.assertRaises(ValueError): self.check()

    def test_broken_report_fails(self):
        for item in ({}, {'error': {}}, {'auditReportVersion': 2}):
            with self.assertRaises(ValueError): gate.assess(item, self.lock, True, self.today)

    def test_cycle_without_advisory_fails(self):
        self.audit['vulnerabilities']['picomatch']['via'] = ['tool']
        with self.assertRaises(ValueError): self.check()

    def test_incomplete_high_severity_report_fails(self):
        self.audit['metadata']['vulnerabilities']['high'] = 3
        with self.assertRaises(ValueError): self.check()

    def mapping(self):
        return {'version': 3, 'sources': ['/src/app.ts', '/node_modules/react-native/index.js'] +
                [f'/node_modules/safe/file{i}.js' for i in range(100)]}

    def test_flat_and_indexed_maps(self):
        self.assertEqual(gate.runtime(self.mapping())['sourceCount'], 102)
        self.assertEqual(gate.runtime({'version': 3, 'sections': [{'map': self.mapping()}]})['sourceCount'], 102)

    def test_runtime_dependency_fails_on_both_path_styles(self):
        for name in gate.BLOCKED:
            for slash in ('/', '\\'):
                mapping = self.mapping()
                mapping['sources'].append(f'/node_modules/{name}/index.js'.replace('/', slash))
                with self.assertRaises(ValueError): gate.runtime(mapping)

    def test_missing_or_empty_map_fails(self):
        for mapping in ({}, {'version': 3, 'sources': []}, {'version': 3, 'sections': [{'url': 'missing'}]}):
            with self.assertRaises(ValueError): gate.runtime(mapping)

    def test_ios_approval_has_same_advisory_versions_and_expiry(self):
        report = gate.assess(self.audit, self.lock, True, self.today, platform='ios')
        self.assertEqual(report['scope'], 'iOS TestFlight internal-test build only')
        self.assertEqual(report['exception'], gate.EXCEPTION)
        self.assertEqual(report['expires'], '2026-12-02')
        self.assertTrue(report['runtimeVerificationRequired'])
        with self.assertRaises(ValueError):
            gate.assess(self.audit, self.lock, True, date(2026, 12, 3), platform='ios')
        self.lock['packages']['node_modules/picomatch']['version'] = '4.0.8'
        with self.assertRaises(ValueError):
            gate.assess(self.audit, self.lock, True, self.today, platform='ios')

    def test_ios_does_not_accept_another_high_or_critical_advisory(self):
        for severity in ('high', 'critical'):
            self.audit['vulnerabilities']['picomatch']['via'].append(
                {'name': 'other', 'severity': severity, 'url': 'https://example.com/not-approved'})
            with self.assertRaises(ValueError):
                gate.assess(self.audit, self.lock, True, self.today, platform='ios')
            self.audit['vulnerabilities']['picomatch']['via'].pop()
        with self.assertRaises(ValueError):
            gate.assess(self.audit, self.lock, False, self.today, platform='ios')
        with self.assertRaises(ValueError):
            gate.assess(self.audit, self.lock, True, self.today, platform='both')


if __name__ == '__main__':
    unittest.main()
