import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../controller.dart';
import '../design/theme.dart';

class PairingScreen extends StatelessWidget {
  final AppController controller;
  const PairingScreen({super.key, required this.controller});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Row(
                    children: [
                      BrandMark(size: 40),
                      SizedBox(width: 8),
                      Text(
                        'BharatCode',
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 64),
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: BrandMark(size: 74),
                  ),
                  const SizedBox(height: 26),
                  Text(
                    controller.confirmation == null
                        ? 'Continue from your computer'
                        : 'One last step.\nApprove on Desktop.',
                    style: const TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.w600,
                      height: 1.17,
                      letterSpacing: -1.1,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    controller.confirmation == null
                        ? 'Your projects. Your conversations.\nThe same BharatCode, wherever you are.'
                        : 'Match this code with the one shown on your computer, then approve this phone.',
                    style: const TextStyle(
                      color: BC.muted,
                      fontSize: 16,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 40),
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: BC.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: BC.border),
                    ),
                    child: controller.confirmation == null
                        ? const Column(
                            children: [
                              Icon(
                                Icons.qr_code_scanner_rounded,
                                size: 62,
                                color: BC.muted,
                              ),
                              SizedBox(height: 18),
                              Text(
                                'Pair once. Pick up anywhere.',
                                style: TextStyle(fontWeight: FontWeight.w500),
                              ),
                              SizedBox(height: 8),
                              Text(
                                'In Desktop, open Mobile devices\nand choose Connect phone.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: BC.muted,
                                  fontSize: 13,
                                  height: 1.6,
                                ),
                              ),
                            ],
                          )
                        : Column(
                            children: [
                              const Icon(
                                Icons.desktop_windows_rounded,
                                color: BC.orange,
                                size: 36,
                              ),
                              const SizedBox(height: 16),
                              SelectableText(
                                controller.confirmation!,
                                style: const TextStyle(
                                  fontFamily: 'JetBrainsMono',
                                  fontSize: 36,
                                  letterSpacing: 6,
                                ),
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Waiting for Desktop approval',
                                style: TextStyle(color: BC.muted),
                              ),
                            ],
                          ),
                  ),
                  if (controller.error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 20),
                      child: Text(
                        controller.error!,
                        style: const TextStyle(color: Color(0xFFFFB199)),
                      ),
                    ),
                  const SizedBox(height: 28),
                  FilledButton.icon(
                    onPressed: controller.busy
                        ? null
                        : () {
                            if (controller.confirmation != null) {
                              controller.cancelPairing();
                              controller.changed();
                            } else {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      ScannerScreen(controller: controller),
                                ),
                              );
                            }
                          },
                    icon: Icon(
                      controller.confirmation == null
                          ? Icons.qr_code_scanner
                          : Icons.close,
                      size: 20,
                    ),
                    label: Text(
                      controller.confirmation == null
                          ? (controller.busy
                                ? 'Connecting…'
                                : 'Scan Desktop QR')
                          : 'Cancel pairing',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => _paste(context),
                    child: const Text(
                      'Paste a pairing code',
                      style: TextStyle(color: BC.muted),
                    ),
                  ),
                  const SizedBox(height: 26),
                  const Divider(),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: controller.enterPreview,
                    child: const Text(
                      'Explore a sample workspace',
                      style: TextStyle(color: BC.muted, fontSize: 13),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Your computer runs the work.\nOpenTunnel keeps the connection encrypted.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: BC.faint,
                      fontSize: 11,
                      height: 1.6,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
  Future<void> _paste(BuildContext context) async {
    final input = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Paste Desktop pairing code'),
        content: TextField(
          controller: input,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Copy the pairing code from Desktop',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, input.text),
            child: const Text('Pair'),
          ),
        ],
      ),
    );
    input.dispose();
    if (value?.isNotEmpty ?? false) await controller.pair(value!);
  }
}

class ScannerScreen extends StatefulWidget {
  final AppController controller;
  const ScannerScreen({super.key, required this.controller});
  @override
  State<ScannerScreen> createState() => _ScannerState();
}

class _ScannerState extends State<ScannerScreen> {
  final scanner = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
  );
  bool scanned = false;
  @override
  void dispose() {
    scanner.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Scan Desktop QR')),
    body: Column(
      children: [
        const Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Open Mobile devices in BharatCode Desktop and choose Connect phone.',
            textAlign: TextAlign.center,
            style: TextStyle(color: BC.muted),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: MobileScanner(
              controller: scanner,
              onDetect: (capture) {
                final text = capture.barcodes.firstOrNull?.rawValue;
                if (scanned || text == null) return;
                scanned = true;
                scanner.stop();
                Navigator.pop(context);
                widget.controller.pair(text);
              },
              errorBuilder: (context, error) => const EmptyState(
                icon: Icons.camera_alt_outlined,
                title: 'Camera unavailable',
                message: 'Allow camera access in your phone settings, or go back and paste the pairing code.',
              ),
            ),
          ),
        ),
        const Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'The QR expires after five minutes.',
            style: TextStyle(color: BC.muted, fontSize: 13),
          ),
        ),
      ],
    ),
  );
}
