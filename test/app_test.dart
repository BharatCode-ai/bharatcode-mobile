import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bharatcode_mobile/app.dart';
import 'package:bharatcode_mobile/controller.dart';

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
