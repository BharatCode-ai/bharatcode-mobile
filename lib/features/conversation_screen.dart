import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../controller.dart';
import '../design/theme.dart';
import '../models/models.dart';
import 'changes_screen.dart';
import 'files_screen.dart';
import 'question_sheet.dart';

class ConversationScreen extends StatefulWidget {
  final AppController controller;
  const ConversationScreen({super.key, required this.controller});
  @override
  State<ConversationScreen> createState() => _ConversationState();
}

class _ConversationState extends State<ConversationScreen> {
  late final TextEditingController composer = TextEditingController(
    text: widget.controller.draft,
  );
  final scroll = ScrollController();
  bool nearBottom = true, _scrollScheduled = false;
  AppController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    _followTail();
    scroll.addListener(() {
      final next = !scroll.hasClients || scroll.position.extentAfter < 120;
      if (next != nearBottom) setState(() => nearBottom = next);
    });
  }

  @override
  void didUpdateWidget(covariant ConversationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    _followTail();
    if (composer.text != c.draft) {
      composer.value = TextEditingValue(
        text: c.draft,
        selection: TextSelection.collapsed(offset: c.draft.length),
      );
    }
  }

  void _followTail() {
    if (!nearBottom || _scrollScheduled) return;
    _scrollScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollScheduled = false;
      if (mounted && nearBottom && scroll.hasClients) {
        scroll.jumpTo(scroll.position.maxScrollExtent);
      }
    });
  }

  @override
  void dispose() {
    composer.dispose();
    scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = c.selected!;
    final requests = c.pendingRequests
        .where((r) => r.sessionID == session.id)
        .toList();
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) c.backToChats();
      },
      child: Scaffold(
        appBar: AppBar(
          toolbarHeight: 72,
          leading: IconButton(
            tooltip: 'Back to chats',
            onPressed: c.backToChats,
            icon: const Icon(Icons.chevron_left, size: 29),
          ),
          leadingWidth: 43,
          titleSpacing: 4,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                session.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  StatusDot(online: c.online),
                  const SizedBox(width: 7),
                  Flexible(
                    child: Text(
                      c.device?.name ?? 'BharatCode Desktop',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: BC.muted),
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            if (!c.previewMode)
              IconButton(
                tooltip: 'Browse project files',
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => FilesScreen(load: c.loadFile),
                  ),
                ),
                icon: const Icon(Icons.folder_open_outlined, size: 21),
              ),
            IconButton(
              tooltip: 'Conversation information',
              onPressed: () => _information(context),
              icon: const Icon(Icons.more_horiz),
            ),
          ],
        ),
        body: Column(
          children: [
            if (c.previewMode) const PreviewNotice(),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 6),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 11,
                ),
                decoration: BoxDecoration(
                  border: Border.all(color: BC.border),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.folder_outlined,
                      size: 17,
                      color: BC.muted,
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        session.project,
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                    if (c.previewMode) ...[
                      Container(width: 1, height: 15, color: BC.border),
                      const SizedBox(width: 14),
                      const Icon(
                        Icons.alt_route_rounded,
                        size: 16,
                        color: BC.muted,
                      ),
                      const SizedBox(width: 7),
                      const Flexible(
                        child: Text(
                          'fix/checkout',
                          style: TextStyle(fontSize: 11, color: BC.muted),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (c.error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: BC.orange.withValues(alpha: .09),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          c.error!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFFFFC1A8),
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: c.unconfirmedText != null
                            ? c.restoreUnconfirmedDraft
                            : c.resume,
                        child: Text(
                          c.unconfirmedText != null
                              ? 'Restore message'
                              : 'Retry',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Expanded(
              child: Stack(
                children: [
                  c.busy && c.messages.isEmpty
                      ? const Center(child: CircularProgressIndicator())
                      : c.messages.isEmpty
                      ? const EmptyState(
                          icon: Icons.auto_awesome_outlined,
                          title: 'What are we building?',
                          message: 'Start a conversation with your project’s context.',
                        )
                      : ListView(
                          controller: scroll,
                          padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                          children: [
                            if (c.messageCursor != null)
                              TextButton(
                                onPressed: c.loadOlder,
                                child: const Text('Load earlier messages'),
                              ),
                            ...c.messages.map((m) => _message(m)),
                            ...requests.map(
                              (r) => r.question
                                  ? Padding(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 16,
                                      ),
                                      child: OutlinedButton.icon(
                                        onPressed: () => showModalBottomSheet(
                                          context: context,
                                          isScrollControlled: true,
                                          builder: (_) => QuestionSheet(
                                            controller: c,
                                            request: r,
                                          ),
                                        ),
                                        icon: const Icon(Icons.help_outline),
                                        label: Text(r.title),
                                      ),
                                    )
                                  : _approval(r),
                            ),
                            if (c.resolution.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Text(
                                  c.resolution,
                                  style: const TextStyle(color: BC.green),
                                ),
                              ),
                            if (!c.previewMode)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 20,
                                ),
                                child: OutlinedButton.icon(
                                  onPressed: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          ChangesScreen(load: c.loadChanges),
                                    ),
                                  ),
                                  icon: const Icon(
                                    Icons.difference_outlined,
                                    size: 18,
                                  ),
                                  label: const Text('View working changes'),
                                ),
                              ),
                            if (c.previewMode && requests.isEmpty) ...[
                              const SizedBox(height: 2),
                              const Row(
                                children: [
                                  BrandMark(size: 25),
                                  SizedBox(width: 9),
                                  Expanded(
                                    child: Text(
                                      'Running validation tests…',
                                      style: TextStyle(fontSize: 13),
                                    ),
                                  ),
                                  Icon(
                                    Icons.autorenew,
                                    color: BC.orange,
                                    size: 17,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),
                              OutlinedButton.icon(
                                onPressed: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => const ChangesScreen(),
                                  ),
                                ),
                                icon: const Icon(
                                  Icons.difference_outlined,
                                  size: 18,
                                ),
                                label: const Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '2 files changed',
                                        style: TextStyle(fontSize: 13),
                                      ),
                                    ),
                                    Expanded(
                                      child: Text(
                                        'View changes',
                                        style: TextStyle(
                                          color: BC.orange,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                  if (!nearBottom)
                    Positioned(
                      bottom: 12,
                      right: 10,
                      child: FilledButton.tonalIcon(
                        onPressed: () => scroll.animateTo(
                          scroll.position.maxScrollExtent,
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOut,
                        ),
                        icon: const Icon(Icons.arrow_downward, size: 15),
                        label: const Text(
                          'Latest',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            _composer(context),
          ],
        ),
      ),
    );
  }

  Widget _message(ChatMessage message) {
    if (message.role == 'user') {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 440),
          margin: const EdgeInsets.only(left: 38, bottom: 26),
          padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 14),
          decoration: BoxDecoration(
            color: BC.raised,
            borderRadius: BorderRadius.circular(19),
            border: Border.all(color: BC.border.withValues(alpha: .6)),
          ),
          child: SelectableText(
            message.text,
            style: const TextStyle(fontSize: 15, height: 1.55),
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              BrandMark(size: 31),
              SizedBox(width: 8),
              Text(
                'BharatCode',
                style: TextStyle(
                  color: BC.muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          MarkdownBody(
            data: message.text,
            selectable: true,
            styleSheet: MarkdownStyleSheet(
              p: TextStyle(
                fontSize: 15,
                height: 1.7,
                color: Theme.of(context).colorScheme.onSurface,
              ),
              code: const TextStyle(
                fontFamily: 'JetBrainsMono',
                fontSize: 12,
                color: Color(0xFFD9CCF5),
              ),
              codeblockDecoration: BoxDecoration(
                color: const Color(0xFF20201E),
                borderRadius: BorderRadius.circular(13),
                border: Border.all(color: BC.border),
              ),
              codeblockPadding: const EdgeInsets.all(16),
              blockSpacing: 18,
            ),
            onTapLink: (_, href, _) {
              if (href != null) _copy(href);
            },
          ),
          if (message.text.isNotEmpty)
            Align(
              alignment: Alignment.centerRight,
              child: IconButton(
                tooltip: 'Copy response',
                onPressed: () => _copy(message.text),
                icon: const Icon(
                  Icons.copy_outlined,
                  size: 15,
                  color: BC.faint,
                ),
              ),
            ),
          ...message.tools.map(
            (tool) => Container(
              margin: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(
                border: Border.all(color: BC.border),
                borderRadius: BorderRadius.circular(12),
              ),
              child: ExpansionTile(
                shape: const Border(),
                collapsedShape: const Border(),
                leading: Icon(
                  tool.status == 'completed' ? Icons.task_alt : Icons.terminal,
                  color: BC.muted,
                  size: 18,
                ),
                title: Text(tool.name, style: const TextStyle(fontSize: 13)),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                children: [
                  SelectableText(
                    '${tool.input}\n\n${tool.output}',
                    style: const TextStyle(
                      fontFamily: 'JetBrainsMono',
                      fontSize: 11,
                      color: BC.muted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _approval(AgentRequest request) => Container(
    margin: const EdgeInsets.only(top: 10, bottom: 18),
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: BC.orange.withValues(alpha: .05),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: BC.orange.withValues(alpha: .4)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.shield_outlined, size: 17, color: Color(0xFFE9BC72)),
            SizedBox(width: 8),
            Text(
              'Approval needed',
              style: TextStyle(
                color: Color(0xFFE9BC72),
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          request.title,
          style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 14),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: BC.surface,
            borderRadius: BorderRadius.circular(10),
          ),
          child: SelectableText(
            request.command,
            style: const TextStyle(fontFamily: 'JetBrainsMono', fontSize: 12),
          ),
        ),
        if (request.directory.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              request.directory,
              style: const TextStyle(color: BC.muted, fontSize: 11),
            ),
          ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: FilledButton(
                onPressed: c.busy ? null : () => c.resolve(request, true),
                child: const Text('Allow once'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton(
                onPressed: c.busy ? null : () => c.resolve(request, false),
                child: const Text('Deny'),
              ),
            ),
          ],
        ),
      ],
    ),
  );
  Widget _composer(BuildContext context) => Container(
    decoration: const BoxDecoration(
      border: Border(top: BorderSide(color: BC.border, width: .5)),
    ),
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 3),
    child: SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            decoration: BoxDecoration(
              color: BC.surface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: BC.border),
            ),
            padding: const EdgeInsets.fromLTRB(6, 4, 6, 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  tooltip: 'Attach context',
                  onPressed: () => _attachment(context),
                  icon: const Icon(
                    Icons.attach_file_rounded,
                    size: 21,
                    color: BC.muted,
                  ),
                ),
                Expanded(
                  child: TextField(
                    key: const Key('composer'),
                    controller: composer,
                    onChanged: (value) {
                      c.setDraft(value);
                      setState(() {});
                    },
                    minLines: 1,
                    maxLines: 5,
                    style: const TextStyle(fontSize: 14),
                    decoration: const InputDecoration(
                      hintText: 'Message BharatCode…',
                      filled: false,
                      contentPadding: EdgeInsets.symmetric(vertical: 12),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                    ),
                  ),
                ),
                IconButton.filled(
                  tooltip: c.sending ? 'Sending message' : 'Send message',
                  onPressed:
                      c.sending || !c.online || composer.text.trim().isEmpty
                      ? null
                      : () async {
                          await c.send();
                          if (mounted && scroll.hasClients) {
                            scroll.animateTo(
                              scroll.position.maxScrollExtent,
                              duration: const Duration(milliseconds: 180),
                              curve: Curves.easeOut,
                            );
                          }
                        },
                  style: IconButton.styleFrom(
                    backgroundColor: BC.orange,
                    foregroundColor: const Color(0xFF26160E),
                    disabledBackgroundColor: BC.raised,
                  ),
                  icon: Icon(
                    c.sending ? Icons.more_horiz : Icons.arrow_upward_rounded,
                    size: 20,
                  ),
                ),
              ],
            ),
          ),
          Row(
            children: [
              Flexible(
                child: TextButton.icon(
                  onPressed: () => _model(context, kind: 'agent'),
                  icon: const Icon(
                    Icons.auto_awesome_outlined,
                    size: 14,
                    color: BC.muted,
                  ),
                  label: Text(
                    c.agentName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: BC.muted, fontSize: 11),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: TextButton(
                  onPressed: () => _model(context),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          c.modelName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11, color: BC.muted),
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.keyboard_arrow_down,
                        size: 15,
                        color: BC.muted,
                      ),
                    ],
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Stop task',
                onPressed: c.stop,
                icon: const Icon(
                  Icons.stop_circle_outlined,
                  size: 18,
                  color: BC.faint,
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
  void _copy(String text) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Copied'), duration: Duration(seconds: 1)),
    );
  }

  Future<void> _model(BuildContext context, {String kind = 'model'}) =>
      showModalBottomSheet(
        context: context,
        builder: (context) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: FutureBuilder(
              future: c.configuration(kind),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return const EmptyState(
                    icon: Icons.cloud_off,
                    title: 'Configuration unavailable',
                    message: 'Check your Desktop connection and try again.',
                  );
                }
                if (!snapshot.hasData) {
                  return const SizedBox(
                    height: 160,
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                return ListView(
                  shrinkWrap: true,
                  children: [
                    Text(
                      kind == 'agent' ? 'Choose an agent' : 'Choose a model',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...snapshot.data!.map(
                      (item) => ListTile(
                        title: Text('${item['name'] ?? item['id']}'),
                        subtitle: item['providerID'] == null
                            ? null
                            : Text(
                                '${item['providerID']}',
                                style: const TextStyle(
                                  color: BC.muted,
                                  fontSize: 12,
                                ),
                              ),
                        onTap: () {
                          Navigator.pop(context);
                          c.switchConfiguration(kind, item);
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Configured on your computer. Provider credentials stay there.',
                      style: TextStyle(fontSize: 12, color: BC.faint),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      );
  Future<void> _attachment(BuildContext context) => showModalBottomSheet(
    context: context,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Add context',
              style: TextStyle(fontSize: 21, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            const Text(
              'Paste a code snippet or file reference into your message. Files remain on your computer.',
              style: TextStyle(color: BC.muted),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () async {
                Navigator.pop(context);
                final data = await Clipboard.getData('text/plain');
                if (data?.text != null) {
                  composer.text =
                      '${composer.text}${composer.text.isEmpty ? '' : '\n'}${data!.text}';
                  c.setDraft(composer.text);
                }
              },
              icon: const Icon(Icons.content_paste, size: 17),
              label: const Text('Paste from clipboard'),
            ),
          ],
        ),
      ),
    ),
  );
  Future<void> _information(BuildContext context) => showModalBottomSheet(
    context: context,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              c.selected!.title,
              style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 14),
            SelectableText(
              c.selected!.id,
              style: const TextStyle(
                fontFamily: 'JetBrainsMono',
                fontSize: 12,
                color: BC.muted,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Project: ${c.selected!.project}',
              style: const TextStyle(color: BC.muted),
            ),
            const SizedBox(height: 18),
            const Text(
              'This is the same conversation on your computer. Your phone does not run a separate agent.',
              style: TextStyle(color: BC.muted, height: 1.7),
            ),
          ],
        ),
      ),
    ),
  );
}
