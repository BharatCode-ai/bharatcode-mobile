import 'package:bharatcode_mobile/app.dart';
import 'package:bharatcode_mobile/controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

// Explicit native qualification against an already paired Desktop. This sends
// real requests only in the dedicated qualification project; it creates no
// server, account, pairing credential, or mocked transport.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('paired Desktop receives native sends and streams replies', (
    tester,
  ) async {
    final controller = AppController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(BharatCodeApp(controller: controller));
    await controller.restore();
    await tester.pumpAndSettle();
    expect(controller.device, isNotNull, reason: 'Pair this emulator first.');
    expect(controller.online, true, reason: 'Desktop must be reachable.');
    const title = String.fromEnvironment(
      'BC_E2E_SESSION_TITLE',
      defaultValue: 'BC Mobile qualification baseline',
    );
    final fixture = controller.sessions.where((s) => s.title == title).single;
    expect(
      fixture.directory.endsWith('/mobile-qualification-project'),
      true,
      reason: 'Real prompts are restricted to the isolated fixture.',
    );
    await tester.ensureVisible(find.text(title));
    await tester.tap(find.text(title));
    await waitFor(
      tester,
      () => !controller.busy && controller.selected != null,
      'Open the paired conversation',
    );

    // Select through the actual picker, then verify its API selection completes.
    final choices = await controller.configuration('model');
    final qwen = choices.where((m) => '${m['name']}'.contains('Qwen')).single;
    await tester.tap(find.text(controller.modelName));
    await waitFor(
      tester,
      () => find.text('${qwen['name']}').evaluate().isNotEmpty,
      'Load the Desktop model picker',
    );
    await tester.tap(find.text('${qwen['name']}'));
    await waitFor(
      tester,
      () => controller.modelName == qwen['name'],
      'Select the Desktop model',
    );
    await tester.pumpAndSettle();

    final previous = controller.messages.map((m) => m.id).toSet();
    const marker = 'BC_NATIVE_LIVE_OK';
    const prompt = 'Reply exactly $marker.';
    await tester.enterText(find.byKey(const Key('composer')), prompt);
    await tester.pumpAndSettle();
    expect(
      controller.draft == prompt,
      true,
      reason: 'Typing must update the conversation draft.',
    );
    expect(controller.online, true, reason: 'Sending must remain online.');
    expect(controller.selectedID == fixture.id, true);
    expect(controller.sending, false);
    expect(
      tester
          .widget<IconButton>(
            find
                .ancestor(
                  of: find.byTooltip('Send message'),
                  matching: find.byType(IconButton),
                )
                .first,
          )
          .onPressed,
      isNotNull,
    );
    await tester.tap(find.byTooltip('Send message'));
    await waitFor(
      tester,
      () => controller.draft.isEmpty && !controller.sending,
      'Confirm native message admission',
    );
    expect(controller.unconfirmedText, isNull);
    expect(
      controller.messages.any((m) => m.role == 'user' && m.text == prompt),
      true,
    );
    await waitFor(
      tester,
      () => controller.messages.any(
        (m) =>
            !previous.contains(m.id) &&
            m.role == 'assistant' &&
            m.text.trim() == marker,
      ),
      'Receive the reply in the open conversation without refreshing',
      timeout: const Duration(minutes: 3),
    );
    final composer = tester.widget<TextField>(
      find.byKey(const Key('composer')),
    );
    expect(composer.controller!.text, isEmpty);
    debugPrint('BC_E2E native_send_and_live_reply passed');

    if (const bool.fromEnvironment('BC_E2E_CONTROLS')) {
      const controls =
          'First use the question tool to ask "Which check?" with '
          'options "Continue" and "Cancel". After I choose Continue, use bash '
          'to run exactly printf BC_PERMISSION_OK. Then read README.md. '
          'Finally reply exactly BC_NATIVE_CONTROLS_OK. Do not modify files.';
      await tester.enterText(find.byKey(const Key('composer')), controls);
      await tester.pump();
      await tester.tap(find.byTooltip('Send message'));
      await waitFor(
        tester,
        () => controller.pendingRequests.any((r) => r.question),
        'Receive the real model question',
        timeout: const Duration(minutes: 3),
      );
      await tester.ensureVisible(find.text('BharatCode has a question'));
      await tester.tap(find.text('BharatCode has a question'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(CheckboxListTile, 'Continue'));
      await tester.pump();
      await tester.tap(find.text('Send answer'));
      await waitFor(
        tester,
        () => !controller.pendingRequests.any((r) => r.question),
        'Resolve the question on Desktop',
      );
      await waitFor(
        tester,
        () => controller.pendingRequests.any((r) => !r.question),
        'Receive the real permission request',
        timeout: const Duration(minutes: 3),
      );
      await tester.ensureVisible(find.text('Allow once'));
      await tester.tap(find.text('Allow once'));
      await waitFor(
        tester,
        () => !controller.pendingRequests.any((r) => !r.question),
        'Approve the permission on Desktop',
      );
      await waitFor(
        tester,
        () => controller.messages.any(
          (m) =>
              m.role == 'assistant' && m.text.trim() == 'BC_NATIVE_CONTROLS_OK',
        ),
        'Complete the approved fixture task',
        timeout: const Duration(minutes: 3),
      );
      debugPrint('BC_E2E native_question_and_permission passed');
    }
  });
}

Future<void> waitFor(
  WidgetTester tester,
  bool Function() ready,
  String step, {
  Duration timeout = const Duration(seconds: 40),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (!ready()) {
    if (DateTime.now().isAfter(deadline)) fail('Timed out: $step');
    await tester.pump(const Duration(milliseconds: 200));
  }
  await tester.pump();
}
