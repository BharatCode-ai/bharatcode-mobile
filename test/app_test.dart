import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bharatcode_mobile/app.dart';
import 'package:bharatcode_mobile/controller.dart';
import 'package:bharatcode_mobile/models/models.dart';

void main() {
  Future<void> phoneSize(WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets(
    'first launch pairs without an account and preview is explicitly labelled',
    (tester) async {
      await phoneSize(tester);
      await tester.pumpWidget(BharatCodeApp(controller: AppController()));
      await tester.pumpAndSettle();
      expect(find.text('Continue from your computer'), findsOneWidget);
      expect(find.text('Scan Desktop QR'), findsOneWidget);
      await tester.ensureVisible(find.text('Explore a sample workspace'));
      await tester.tap(find.text('Explore a sample workspace'));
      await tester.pumpAndSettle();
      expect(find.text('Preview workspace'), findsOneWidget);
      expect(find.text('Fix checkout validation'), findsOneWidget);
    },
  );
  testWidgets('paste dialog can close and show a recoverable pairing error', (
    tester,
  ) async {
    await phoneSize(tester);
    final controller = AppController();
    await tester.pumpWidget(BharatCodeApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Paste a pairing code'));
    await tester.tap(find.text('Paste a pairing code'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'invalid pairing data');
    await tester.tap(find.widgetWithText(FilledButton, 'Pair'));
    await tester.pumpAndSettle();
    expect(find.text('Continue from your computer'), findsOneWidget);
    expect(controller.error, isNotNull);
    controller.dispose();
  });
  testWidgets(
    'chat filtering and navigation work and a draft survives returning to chats',
    (tester) async {
      await phoneSize(tester);
      final controller = AppController.preview();
      await tester.pumpWidget(BharatCodeApp(controller: controller));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('session-search')),
        'checkout',
      );
      await tester.pumpAndSettle();
      expect(find.text('Add dark mode'), findsNothing);
      await tester.tap(find.text('Fix checkout validation'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('composer')),
        'Also check billing',
      );
      await tester.tap(find.byTooltip('Back to chats'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fix checkout validation'));
      await tester.pumpAndSettle();
      expect(find.text('Also check billing'), findsOneWidget);
    },
  );
  testWidgets('typing and Send submit the visible composer draft', (
    tester,
  ) async {
    await phoneSize(tester);
    final controller = AppController.preview();
    await controller.selectSession(controller.sessions.first);
    await tester.pumpWidget(BharatCodeApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('composer')),
      'A visible draft',
    );
    await tester.pumpAndSettle();
    expect(controller.draft, 'A visible draft');
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    expect(
      controller.messages.any(
        (m) => m.role == 'user' && m.text == 'A visible draft',
      ),
      true,
    );
    expect(controller.draft, isEmpty);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('composer')))
          .controller!
          .text,
      isEmpty,
    );
    controller.dispose();
  });
  testWidgets('incoming replies follow the bottom without moving a reader', (
    tester,
  ) async {
    await phoneSize(tester);
    final controller = AppController.preview();
    await controller.selectSession(controller.sessions.first);
    await tester.pumpWidget(BharatCodeApp(controller: controller));
    await tester.pumpAndSettle();
    controller.messages = [
      ChatMessage(
        id: 'long_reply',
        role: 'assistant',
        text: List.filled(80, 'A line of the reply.').join('\n\n'),
      ),
    ];
    controller.changed();
    await tester.pumpAndSettle();
    final list = find.byType(ListView).first;
    final scrollable = find
        .descendant(of: list, matching: find.byType(Scrollable))
        .first;
    final position = tester.state<ScrollableState>(scrollable).position;
    expect(position.extentAfter, lessThan(1));
    position.jumpTo(0);
    await tester.pumpAndSettle();
    controller.messages.add(
      const ChatMessage(
        id: 'next_reply',
        role: 'assistant',
        text: 'Another reply',
      ),
    );
    controller.changed();
    await tester.pumpAndSettle();
    expect(position.pixels, 0);
    controller.dispose();
  });
  testWidgets(
    'approval resolves through the controller and clears attention count',
    (tester) async {
      await phoneSize(tester);
      final controller = AppController.preview();
      await tester.pumpWidget(BharatCodeApp(controller: controller));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Activity'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Review auth middleware'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Allow once'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(find.text('Allow once'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Allow once'));
      await tester.pumpAndSettle();
      expect(controller.pendingRequests, isEmpty);
      expect(find.text('Allowed once'), findsOneWidget);
    },
  );
  testWidgets(
    'pairing and chats reflow at large text without render overflow',
    (tester) async {
      await phoneSize(tester);
      await tester.pumpWidget(
        BharatCodeApp(controller: AppController.preview(), textScale: 2),
      );
      await tester.pumpAndSettle();
      expect(find.text('Chats'), findsWidgets);
    },
  );
}
