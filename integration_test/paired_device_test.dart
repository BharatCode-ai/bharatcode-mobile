import 'package:bharatcode_mobile/app.dart';
import 'package:bharatcode_mobile/connection/api_client.dart';
import 'package:bharatcode_mobile/controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'paired_desktop_test.dart' show waitFor;

// Explicitly removes this test phone's pairing. Re-pair the normal app after
// running it. The old credential stays in memory and is never printed or saved.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('removing a paired computer revokes the old credential', (
    tester,
  ) async {
    final c = AppController();
    addTearDown(c.dispose);
    await tester.pumpWidget(BharatCodeApp(controller: c));
    await c.restore();
    await tester.pumpAndSettle();
    expect(c.online && c.devices.length == 1, true);
    expect(
      c.sessions.any(
        (s) =>
            s.title == 'BC Mobile qualification baseline' &&
            s.directory.endsWith('/mobile-qualification-project'),
      ),
      true,
    );
    final device = c.device!;
    final oldClient = ApiClient(Uri.parse(device.origin), device.token);
    addTearDown(oldClient.close);
    final before = await oldClient.request('GET', '/mobile/v1/health');
    expect(before['protocol'] == 1, true);

    await tester.tap(find.text('Devices'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Computer details'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Remove computer'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Remove'));
    await waitFor(
      tester,
      () => c.device == null && c.devices.isEmpty,
      'Remove the computer on this phone',
    );
    await tester.pumpAndSettle();
    expect(find.text('Continue from your computer'), findsOneWidget);
    expect((await c.store.load()).isEmpty, true);
    try {
      await oldClient.request('GET', '/mobile/v1/health');
      fail('The revoked credential must not remain authorized.');
    } on ApiException catch (error) {
      expect(error.status, 401);
    }
    debugPrint('BC_E2E native_remove_computer_and_revoked_credential passed');
  });
}
