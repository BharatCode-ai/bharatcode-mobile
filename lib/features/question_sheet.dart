import 'package:flutter/material.dart';

import '../controller.dart';
import '../design/theme.dart';
import '../models/models.dart';

class QuestionSheet extends StatefulWidget {
  final AppController controller;
  final AgentRequest request;
  const QuestionSheet({
    super.key,
    required this.controller,
    required this.request,
  });
  @override
  State<QuestionSheet> createState() => _QuestionState();
}

class _QuestionState extends State<QuestionSheet> {
  late final questions = (widget.request.raw['questions'] as List? ?? [])
      .map((q) => Map<String, dynamic>.from(q))
      .toList();
  late final selected = List.generate(questions.length, (_) => <String>{});
  late final inputs = List.generate(
    questions.length,
    (_) => TextEditingController(),
  );
  bool saving = false;
  String? error;
  @override
  void dispose() {
    for (final input in inputs) {
      input.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        0,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * .8,
        ),
        child: ListView(
          shrinkWrap: true,
          children: [
            const Text(
              'A question for you',
              style: TextStyle(fontSize: 23, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 20),
            ...List.generate(questions.length, (index) {
              final question = questions[index];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${question['question']}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...(question['options'] as List? ?? []).map((option) {
                    final label = '${option['label']}';
                    return CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(label, style: const TextStyle(fontSize: 14)),
                      subtitle: Text(
                        '${option['description'] ?? ''}',
                        style: const TextStyle(fontSize: 12, color: BC.muted),
                      ),
                      value: selected[index].contains(label),
                      onChanged: saving
                          ? null
                          : (value) => setState(() {
                              if (question['multiple'] != true) {
                                selected[index].clear();
                              }
                              if (value == true) {
                                selected[index].add(label);
                              } else {
                                selected[index].remove(label);
                              }
                            }),
                    );
                  }),
                  if (question['custom'] != false)
                    TextField(
                      controller: inputs[index],
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        hintText: 'Or write your answer',
                      ),
                    ),
                  const SizedBox(height: 24),
                ],
              );
            }),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(error!, style: const TextStyle(color: BC.orange)),
              ),
            FilledButton(
              onPressed:
                  saving ||
                      questions.isEmpty ||
                      List.generate(
                        questions.length,
                        (i) =>
                            selected[i].isNotEmpty ||
                            inputs[i].text.trim().isNotEmpty,
                      ).contains(false)
                  ? null
                  : () async {
                      setState(() {
                        saving = true;
                        error = null;
                      });
                      final ok = await widget.controller.answer(
                        widget.request,
                        List.generate(
                          questions.length,
                          (i) => [
                            if (questions[i]['multiple'] == true ||
                                inputs[i].text.trim().isEmpty)
                              ...selected[i],
                            if (inputs[i].text.trim().isNotEmpty)
                              inputs[i].text.trim(),
                          ],
                        ),
                      );
                      if (!context.mounted) return;
                      if (ok) {
                        Navigator.pop(context);
                      } else {
                        setState(() {
                          saving = false;
                          error =
                              widget.controller.error ??
                              'Answer could not be sent. Try again.';
                        });
                      }
                    },
              child: Text(saving ? 'Sending…' : 'Send answer'),
            ),
          ],
        ),
      ),
    ),
  );
}
