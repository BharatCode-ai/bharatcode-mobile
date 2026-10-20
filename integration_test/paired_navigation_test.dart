import 'package:bharatcode_mobile/app.dart';
import 'package:bharatcode_mobile/controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'paired_desktop_test.dart' show waitFor;

// Uses the real paired Desktop, but sends no model prompts. Prepare a tracked
// README.md working change containing BC_NATIVE_DIFF_OK in the isolated fixture.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('paired project navigation and native controls', (tester) async {
    final c = AppController();
    addTearDown(c.dispose);
    await tester.pumpWidget(BharatCodeApp(controller: c));
    await c.restore();
    await tester.pumpAndSettle();
    expect(c.online && c.device != null, true);
    const title = 'BC Mobile qualification baseline';
    final fixtureTitle = find.byWidgetPredicate(
      (widget) => widget is Text && widget.data == title,
    );
    final fixture = c.sessions.where((s) => s.title == title).single;
    expect(fixture.directory.endsWith('/mobile-qualification-project'), true);

    await tester.enterText(find.byKey(const Key('session-search')), title);
    await tester.pump(const Duration(milliseconds: 400));
    await waitFor(tester, () => !c.loadingSessions, 'Search Desktop chats');
    expect(c.visibleSessions.every((s) => s.title.contains(title)), true);
    expect(fixtureTitle, findsOneWidget);
    await tester.tap(find.text('All projects'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ListTile, fixture.project));
    await tester.pumpAndSettle();
    expect(c.projectFilter == fixture.project, true);
    await tester.tap(fixtureTitle);
    await waitFor(tester, () => !c.busy && c.selected != null, 'Open fixture');
    await tester.pumpAndSettle();

    const retainedDraft = 'BC_NATIVE_RESTART_DRAFT';
    if (const bool.fromEnvironment('BC_E2E_VERIFY_RESTART_DRAFT')) {
      expect(c.draft == retainedDraft, true);
      expect(
        tester
                .widget<TextField>(find.byKey(const Key('composer')))
                .controller!
                .text ==
            retainedDraft,
        true,
      );
      await tester.enterText(find.byKey(const Key('composer')), '');
      expect(await c.store.draft(c.device!.id, fixture.id) == '', true);
      debugPrint('BC_E2E native_restart_pairing_and_draft passed');
      return;
    }

    final savedDraft = c.draft;
    const draft = 'BC_NATIVE_NAVIGATION_DRAFT';
    await tester.enterText(find.byKey(const Key('composer')), draft);
    await tester.tap(find.byTooltip('Back to chats'));
    await tester.pumpAndSettle();
    await tester.tap(fixtureTitle);
    await waitFor(
      tester,
      () => !c.busy && c.selected != null,
      'Reopen fixture',
    );
    await tester.pumpAndSettle();
    expect(c.draft == draft, true);
    expect(await c.store.draft(c.device!.id, fixture.id) == draft, true);
    await tester.enterText(find.byKey(const Key('composer')), savedDraft);

    final models = await c.configuration('model');
    expect(models.any((m) => '${m['name']}'.contains('Qwen')), true);
    expect(models.any((m) => '${m['name']}'.contains('DeepSeek')), true);
    for (final match in ['DeepSeek', 'Qwen']) {
      final model = models.where((m) => '${m['name']}'.contains(match)).single;
      await tester.tap(find.text(c.modelName));
      await waitFor(
        tester,
        () => find.text('Choose a model').evaluate().isNotEmpty,
        'Open model picker',
      );
      final choice = find.widgetWithText(ListTile, '${model['name']}');
      await waitFor(
        tester,
        () => choice.evaluate().isNotEmpty,
        'Load model choice',
      );
      await tester.ensureVisible(choice);
      await tester.tap(choice);
      await waitFor(tester, () => c.modelName == model['name'], 'Choose model');
      await tester.pumpAndSettle();
    }
    final agents = await c.configuration('agent');
    for (final id in ['plan', 'build']) {
      final agent = agents.where((a) => a['id'] == id).single;
      await tester.tap(find.text(c.agentName));
      await waitFor(
        tester,
        () => find
            .widgetWithText(ListTile, '${agent['name']}')
            .evaluate()
            .isNotEmpty,
        'Load agent picker',
      );
      await tester.tap(find.widgetWithText(ListTile, '${agent['name']}'));
      await waitFor(tester, () => c.agentName == agent['name'], 'Choose agent');
      await tester.pumpAndSettle();
    }
    debugPrint('BC_E2E native_search_project_draft_model_agent passed');

    await tester.tap(find.byTooltip('Browse project files'));
    final readme = find.widgetWithText(ListTile, 'README.md');
    await waitFor(
      tester,
      () => readme.evaluate().isNotEmpty,
      'List project files',
    );
    await tester.tap(readme);
    await waitFor(
      tester,
      () => find.text('Wrap lines').evaluate().isNotEmpty,
      'Read README',
    );
    expect(
      tester
          .widgetList<SelectableText>(find.byType(SelectableText))
          .any((t) => t.data?.contains('BC_NATIVE_DIFF_OK') == true),
      true,
    );
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(tester.widget<Switch>(find.byType(Switch)).value, true);
    await tester.tap(find.widgetWithText(TextButton, 'Copy'));
    await tester.pumpAndSettle();
    expect(
      (await Clipboard.getData('text/plain'))?.text
              ?.contains('BC_NATIVE_DIFF_OK') ==
          true,
      true,
    );
    await tester.pageBack();
    await tester.pumpAndSettle();

    final changes = find.text('View working changes');
    await tester.ensureVisible(changes);
    await tester.tap(changes);
    await waitFor(
      tester,
      () => find.byType(DropdownButton<int>).evaluate().isNotEmpty,
      'Load working changes',
    );
    expect(
      tester
          .widgetList<Text>(find.byType(Text))
          .any((t) => t.data?.contains('BC_NATIVE_DIFF_OK') == true),
      true,
    );
    await tester.pageBack();
    await tester.pumpAndSettle();
    debugPrint('BC_E2E native_files_copy_wrap_changes passed');

    await tester.tap(find.byTooltip('Back to chats'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('session-search')), '');
    await tester.pump(const Duration(milliseconds: 400));
    await waitFor(tester, () => !c.loadingSessions, 'Clear chat search');
    await tester.tap(find.byTooltip('New chat'));
    await waitFor(
      tester,
      () => c.selected != null && c.selectedID != fixture.id && !c.busy,
      'Create a chat in the selected project',
    );
    expect(c.selected!.directory == fixture.directory, true);
    expect(c.messages.isEmpty, true);
    await tester.tap(find.byTooltip('Back to chats'));
    await tester.pumpAndSettle();
    debugPrint('BC_E2E native_new_chat passed');
    await tester.ensureVisible(fixtureTitle);
    await tester.tap(fixtureTitle);
    await waitFor(
      tester,
      () => c.selectedID == fixture.id && !c.busy,
      'Reopen the draft fixture',
    );
    await tester.pumpAndSettle();
    expect(
      c.draft.isEmpty,
      true,
      reason: 'Keep any existing fixture draft before seeding a restart check.',
    );
    await tester.enterText(find.byKey(const Key('composer')), retainedDraft);
    expect(
      await c.store.draft(c.device!.id, fixture.id) == retainedDraft,
      true,
    );
    debugPrint('BC_E2E native_restart_draft_seeded passed');
  });
}
