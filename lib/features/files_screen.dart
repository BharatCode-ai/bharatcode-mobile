import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/theme.dart';

class FilesScreen extends StatefulWidget {
  final Future<Map<String, dynamic>> Function(String path) load;
  const FilesScreen({super.key, required this.load});
  @override
  State<FilesScreen> createState() => _FilesState();
}

class _FilesState extends State<FilesScreen> {
  String path = '';
  Map<String, dynamic>? value;
  String? error;
  bool loading = true, wrap = false;
  int generation = 0;
  @override
  void initState() {
    super.initState();
    _open('');
  }

  Future<void> _open(String next) async {
    final current = ++generation;
    setState(() {
      loading = true;
      error = null;
      path = next;
    });
    try {
      final result = await widget.load(next);
      if (mounted && current == generation) setState(() => value = result);
    } catch (_) {
      if (mounted && current == generation) {
        setState(
          () => error = 'This path could not be opened. It may be unavailable or outside the project.',
        );
      }
    } finally {
      if (mounted && current == generation) setState(() => loading = false);
    }
  }

  String get parent =>
      path.contains('/') ? path.substring(0, path.lastIndexOf('/')) : '';
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Project files', style: TextStyle(fontSize: 20)),
    ),
    body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              IconButton(
                tooltip: 'Project root',
                onPressed: () => _open(''),
                icon: const Icon(Icons.home_outlined, size: 20),
              ),
              Expanded(
                child: Text(
                  path.isEmpty ? 'Project root' : path,
                  style: const TextStyle(
                    fontFamily: 'JetBrainsMono',
                    fontSize: 12,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (path.isNotEmpty)
                IconButton(
                  tooltip: 'Parent folder',
                  onPressed: () => _open(parent),
                  icon: const Icon(Icons.arrow_upward, size: 20),
                ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : error != null
              ? EmptyState(
                  icon: Icons.folder_off_outlined,
                  title: 'Path unavailable',
                  message: error!,
                  action: OutlinedButton(
                    onPressed: () => _open(path),
                    child: const Text('Try again'),
                  ),
                )
              : value?['type'] == 'directory'
              ? _directory()
              : value?['binary'] == true
              ? const EmptyState(
                  icon: Icons.image_outlined,
                  title: 'Binary file',
                  message: 'Text preview is unavailable for this file.',
                )
              : value?['tooLarge'] == true
              ? const EmptyState(
                  icon: Icons.description_outlined,
                  title: 'File is too large',
                  message: 'Open files larger than 256 KB on your computer.',
                )
              : _source(),
        ),
      ],
    ),
  );
  Widget _directory() {
    final entries = value!['entries'] as List? ?? [];
    if (entries.isEmpty) {
      return const EmptyState(
        icon: Icons.folder_outlined,
        title: 'Empty folder',
        message: 'There are no files in this folder.',
      );
    }
    return ListView(
      children: [
        if (value!['truncated'] == true)
          const Padding(
            padding: EdgeInsets.all(20),
            child: Text(
              'Showing the first 2,000 entries. Open a subfolder to continue.',
              style: TextStyle(color: BC.muted),
            ),
          ),
        ...entries.map(
          (entry) => ListTile(
            leading: Icon(
              entry['directory'] == true
                  ? Icons.folder_outlined
                  : entry['symlink'] == true
                  ? Icons.link
                  : Icons.description_outlined,
              color: BC.muted,
              size: 21,
            ),
            title: Text(
              '${entry['name']}',
              style: const TextStyle(fontSize: 14),
            ),
            trailing: const Icon(
              Icons.chevron_right,
              size: 18,
              color: BC.faint,
            ),
            onTap: () => _open(
              [if (path.isNotEmpty) path, '${entry['name']}'].join('/'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _source() {
    final text = value?['text'] as String? ?? '';
    return Column(
      children: [
        Row(
          children: [
            TextButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: text));
                ScaffoldMessenger.of(context)
                    .showSnackBar(const SnackBar(content: Text('File copied')));
              },
              icon: const Icon(Icons.copy, size: 16),
              label: const Text('Copy'),
            ),
            const Spacer(),
            const Text(
              'Wrap lines',
              style: TextStyle(fontSize: 12, color: BC.muted),
            ),
            Switch(
              value: wrap,
              onChanged: (next) => setState(() => wrap = next),
            ),
          ],
        ),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: wrap ? const NeverScrollableScrollPhysics() : null,
                child: SizedBox(
                  width: wrap ? constraints.maxWidth : 1000,
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: SelectableText(
                      text.isEmpty ? '(Empty file)' : text,
                      style: const TextStyle(
                        fontFamily: 'JetBrainsMono',
                        fontSize: 12,
                        height: 1.7,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
