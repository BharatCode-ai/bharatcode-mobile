import 'dart:io';

import 'package:bharatcode_mobile/app.dart';
import 'package:bharatcode_mobile/controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'paired_desktop_test.dart' show waitFor;

// Provision this short-lived payload with adb exec-in/run-as through stdin,
// never a command-line define. The test deletes its private input before use.
// Approve the matching confirmation on the actual Desktop while it waits.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native paste pairing waits for Desktop approval and persists', (
    tester,
  ) async {
    final c = AppController();
    addTearDown(c.dispose);
    await tester.pumpWidget(BharatCodeApp(controller: c));
    await c.restore();
    await tester.pumpAndSettle();
    expect(
      c.device == null && c.devices.isEmpty,
      true,
      reason: 'Use an unpaired qualification phone.',
    );
    final input = File(
      '/data/user/0/ai.bharatcode.bharatcode_mobile/files/bc-e2e-pairing.json',
    );
    final payload = await input.readAsString();
    await input.delete();
    expect(payload.isNotEmpty && payload.length < 4096, true);
    final paste = find.text('Paste a pairing code');
    await tester.ensureVisible(paste);
    await tester.tap(paste);
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), payload);
    await tester.tap(find.widgetWithText(FilledButton, 'Pair'));
    await waitFor(
      tester,
      () => c.confirmation != null,
      'Receive the Desktop pairing confirmation',
    );
    expect(
      c.device == null,
      true,
      reason: 'The phone must wait for Desktop approval.',
    );
    debugPrint('BC_E2E native_pairing_waiting_for_desktop');
    await waitFor(
      tester,
      () => c.device != null && c.online,
      'Approve this phone on Desktop',
      timeout: const Duration(minutes: 3),
    );
    await tester.pumpAndSettle();
    expect(c.previewMode, false);
    final saved = await c.store.load();
    expect(
      saved.length == 1 &&
          saved.single.id == c.device!.id &&
          saved.single.token.isNotEmpty,
      true,
    );
    expect(find.byKey(const Key('session-search')), findsOneWidget);
    debugPrint('BC_E2E native_pairing_approval_and_secure_restore passed');
  });
}
