import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/theme.dart';

class ChangesScreen extends StatefulWidget {
  final Future<List<Map<String, dynamic>>> Function()? load;
  const ChangesScreen({super.key, this.load});
  @override
  State<ChangesScreen> createState() => _ChangesState();
}

class _ChangesState extends State<ChangesScreen> {
  int file = 0;
  bool wrap = false;
  static const sampleFiles = ['address.ts', 'address.test.ts'];
  static const sampleCode = [
    [
      '  export function validateAddress(',
      '    address: AddressInput,',
      '  ): ValidationResult {',
      '    const apartment = address.apartment?.trim();',
      '-   if (!apartment) {',
      '-     return invalid("Apartment is required");',
      '+   // Apartment is optional.',
      '+   if (apartment && apartment.length > 100) {',
      '+     return invalid("Apartment is too long");',
      '    }',
      '    return valid();',
      '  }',
    ],
    [
      '+ describe("optional apartment", () => {',
      '+   it("accepts an empty value", () => {',
      '+     const result = validateAddress({',
      '+       ...validAddress, apartment: "",',
      '+     });',
      '+     expect(result.valid).toBe(true);',
      '+   });',
      '+ });',
    ],
  ];
  List<String> files = [], patches = [];
  bool loading = false;
  String? error;
  @override
  void initState() {
    super.initState();
    if (widget.load == null) {
      files = sampleFiles;
      patches = sampleCode.map((lines) => lines.join('\n')).toList();
    } else {
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final changes = await widget.load!();
      if (!mounted) return;
      setState(() {
        files = changes.map((f) => '${f['file']}').toList();
        patches = changes.map((f) => '${f['patch'] ?? ''}').toList();
        file = 0;
      });
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'Working changes could not be loaded. Keep your computer online and try again.',
        );
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  List<String> get lines => patches[file].split('\n');
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'Working changes',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
      ),
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : error != null
        ? EmptyState(
            icon: Icons.cloud_off_outlined,
            title: 'Changes unavailable',
            message: error!,
            action: OutlinedButton(
              onPressed: _load,
              child: const Text('Try again'),
            ),
          )
        : files.isEmpty
        ? const EmptyState(
            icon: Icons.check_circle_outline,
            title: 'Working tree is clear',
            message: 'There are no uncommitted changes in this project.',
          )
        : Column(
            children: [
              if (widget.load == null) const PreviewNotice(),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: BC.border),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const SizedBox(width: 14),
                      const Icon(
                        Icons.description_outlined,
                        size: 18,
                        color: BC.muted,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            value: file,
                            isExpanded: true,
                            items: List.generate(
                              files.length,
                              (i) => DropdownMenuItem(
                                value: i,
                                child: Text(
                                  files[i],
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ),
                            onChanged: (value) => setState(() => file = value!),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    physics: wrap ? const NeverScrollableScrollPhysics() : null,
                    child: SizedBox(
                      width: wrap
                          ? MediaQuery.sizeOf(context).width
                                .clamp(0, 720)
                                .toDouble()
                          : 640,
                      child: Column(
                        children: List.generate(lines.length, (index) {
                          final line = patches[file].isEmpty
                              ? 'No text diff available. This file may be binary.'
                              : lines[index];
                          final added = line.startsWith('+'),
                              removed = line.startsWith('-');
                          return Container(
                            width: double.infinity,
                            color: added
                                ? BC.green.withValues(alpha: .09)
                                : removed
                                ? const Color(0xFFFF8B81).withValues(alpha: .09)
                                : null,
                            padding: const EdgeInsets.symmetric(
                              vertical: 4,
                              horizontal: 15,
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                SizedBox(
                                  width: 27,
                                  child: Text(
                                    '${index + 1}',
                                    style: const TextStyle(
                                      fontFamily: 'JetBrainsMono',
                                      fontSize: 11,
                                      color: BC.faint,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: SelectableText(
                                    line,
                                    style: TextStyle(
                                      fontFamily: 'JetBrainsMono',
                                      fontSize: 12,
                                      height: 1.7,
                                      color: added
                                          ? const Color(0xFFA3D8AD)
                                          : removed
                                          ? const Color(0xFFEBA59D)
                                          : BC.text,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ),
                    ),
                  ),
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                  child: Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: patches[file]));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Diff copied')),
                          );
                        },
                        icon: const Icon(Icons.copy, size: 15),
                        label: const Text('Copy'),
                      ),
                      const Spacer(),
                      const Text(
                        'Wrap lines',
                        style: TextStyle(fontSize: 12, color: BC.muted),
                      ),
                      Switch(
                        value: wrap,
                        onChanged: (value) => setState(() => wrap = value),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
  );
}
