import 'package:flutter/material.dart';

import 'app.dart';
import 'controller.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final preview =
      const bool.fromEnvironment('BC_PREVIEW') ||
      Uri.base.queryParameters['preview'] == 'true';
  final controller = preview ? AppController.preview() : AppController();
  runApp(BharatCodeApp(controller: controller));
  if (!preview) controller.restore();
}
