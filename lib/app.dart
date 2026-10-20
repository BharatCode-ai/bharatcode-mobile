import 'package:flutter/material.dart';

import 'controller.dart';
import 'design/theme.dart';
import 'features/pairing_screen.dart';
import 'features/sessions_screen.dart';
import 'features/conversation_screen.dart';

class BharatCodeApp extends StatefulWidget {
  final AppController? controller;
  final double? textScale;
  const BharatCodeApp({super.key, this.controller, this.textScale});
  @override
  State<BharatCodeApp> createState() => _AppState();
}

class _AppState extends State<BharatCodeApp> with WidgetsBindingObserver {
  late final AppController controller = widget.controller ?? AppController();
  ThemeMode mode = ThemeMode.dark;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) controller.resume();
    if (state == AppLifecycleState.paused) controller.suspend();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (widget.controller == null) controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'BharatCode',
    debugShowCheckedModeBanner: false,
    theme: BC.theme(Brightness.light),
    darkTheme: BC.theme(Brightness.dark),
    themeMode: mode,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(
        textScaler: widget.textScale == null
            ? MediaQuery.textScalerOf(context)
            : TextScaler.linear(widget.textScale!),
      ),
      child: ColoredBox(
        color: const Color(0xFF10100F),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: child,
          ),
        ),
      ),
    ),
    home: AnimatedBuilder(
      animation: controller,
      builder: (context, _) => controller.device == null
          ? PairingScreen(controller: controller)
          : controller.selected != null
          ? ConversationScreen(controller: controller)
          : SessionsScreen(
              controller: controller,
              onTheme: (value) => setState(() => mode = value),
            ),
    ),
  );
}
