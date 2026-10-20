import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/theme.dart';

class ChangesScreen extends StatefulWidget {
  const ChangesScreen({super.key});
  @override
  State<ChangesScreen> createState() => _ChangesState();
}

class _ChangesState extends State<ChangesScreen> {
  int file = 0;
  bool wrap = false;
  static const files = ['address.ts', 'address.test.ts'];
  static const code = [
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
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'Changes',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
      ),
    ),
    body: Column(
      children: [
        const PreviewNotice(),
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
                        2,
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
                    ? MediaQuery.sizeOf(context).width.clamp(0, 720).toDouble()
                    : 640,
                child: Column(
                  children: List.generate(code[file].length, (index) {
                    final line = code[file][index];
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
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                OutlinedButton.icon(
                  onPressed: () {
                    Clipboard.setData(
                      ClipboardData(text: code[file].join('\n')),
                    );
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
