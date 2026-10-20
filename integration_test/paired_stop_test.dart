import 'package:bharatcode_mobile/app.dart';
import 'package:bharatcode_mobile/connection/api_client.dart';
import 'package:bharatcode_mobile/controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'paired_desktop_test.dart' show waitFor;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('Stop interrupts the actual Desktop task waiting for an answer', (
    tester,
  ) async {
    final c = AppController();
    addTearDown(c.dispose);
    await tester.pumpWidget(BharatCodeApp(controller: c));
    await c.restore();
    await tester.pumpAndSettle();
    expect(c.online && c.device != null, true);
    const title = 'BC Mobile qualification baseline';
    final fixture = c.sessions.where((s) => s.title == title).single;
    expect(fixture.directory.endsWith('/mobile-qualification-project'), true);
    await tester.tap(find.text(title));
    await waitFor(
      tester,
      () => !c.busy && c.selected != null,
      'Open the Stop fixture',
    );
    await tester.pumpAndSettle();
    expect(
      c.draft.isEmpty && c.unconfirmedText == null && c.pendingRequests.isEmpty,
      true,
    );
    const prompt =
        'Use the question tool to ask "Stop check?" with options "Continue" and "Cancel". Wait for my answer. Do not run commands or modify files.';
    await tester.enterText(find.byKey(const Key('composer')), prompt);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Send message'));
    await waitFor(
      tester,
      () => c.pendingRequests.any((r) => r.question),
      'Wait for the real Desktop task',
      timeout: const Duration(minutes: 3),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Stop task'));
    await waitFor(
      tester,
      () => c.resolution == 'Stop requested',
      'Send the actual interrupt',
    );

    final device = c.device!;
    final api = ApiClient(Uri.parse(device.origin), device.token);
    addTearDown(api.close);
    var idle = false;
    final deadline = DateTime.now().add(const Duration(seconds: 30));
    while (DateTime.now().isBefore(deadline)) {
      final active = await api.request('GET', '/api/session/active');
      if ((active['data'] as Map?)?.containsKey(fixture.id) != true) {
        idle = true;
        break;
      }
      await tester.pump(const Duration(milliseconds: 500));
    }
    expect(idle, true, reason: 'Desktop must stop running this fixture.');
    await waitFor(
      tester,
      () => !c.pendingRequests.any((r) => r.sessionID == fixture.id),
      'Clear the interrupted question',
    );
    expect(c.online, true);
    debugPrint('BC_E2E native_stop_interrupt_and_idle passed');
  });
}
