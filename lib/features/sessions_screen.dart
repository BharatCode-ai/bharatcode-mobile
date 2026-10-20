import 'package:flutter/material.dart';

import '../controller.dart';
import '../design/theme.dart';
import '../models/models.dart';
import 'pairing_screen.dart';

class SessionsScreen extends StatelessWidget {
  final AppController controller;
  final ValueChanged<ThemeMode> onTheme;
  const SessionsScreen({
    super.key,
    required this.controller,
    required this.onTheme,
  });
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      toolbarHeight: 78,
      title: Padding(
        padding: const EdgeInsets.only(left: 4),
        child: Text(
          ['Chats', 'Activity', 'Devices'][controller.tab],
          style: const TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w600,
            letterSpacing: -.7,
          ),
        ),
      ),
      actions: [
        IconButton(
          tooltip: 'Preferences',
          onPressed: () => _preferences(context),
          icon: const Icon(Icons.tune_rounded, size: 22),
        ),
        if (controller.tab == 0)
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: IconButton.filledTonal(
              tooltip: 'New chat',
              onPressed: controller.newChat,
              icon: const Icon(Icons.add, color: BC.orange),
            ),
          ),
      ],
    ),
    body: Column(
      children: [
        if (controller.previewMode) const PreviewNotice(),
        if (controller.error != null) _error(),
        Expanded(
          child: switch (controller.tab) {
            1 => _activity(context),
            2 => _devices(context),
            _ => _chats(context),
          },
        ),
      ],
    ),
    bottomNavigationBar: Container(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: BC.border, width: .5)),
      ),
      child: NavigationBar(
        selectedIndex: controller.tab,
        onDestinationSelected: controller.setTab,
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline_rounded),
            selectedIcon: Icon(Icons.chat_bubble_rounded, color: BC.orange),
            label: 'Chats',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: controller.pendingRequests.isNotEmpty,
              backgroundColor: BC.orange,
              child: const Icon(Icons.timelapse_rounded),
            ),
            label: 'Activity',
          ),
          const NavigationDestination(
            icon: Icon(Icons.devices_outlined),
            selectedIcon: Icon(Icons.devices, color: BC.orange),
            label: 'Devices',
          ),
        ],
      ),
    ),
  );
  Widget _error() => Container(
    width: double.infinity,
    color: const Color(0xFF3A2A20),
    padding: const EdgeInsets.fromLTRB(20, 10, 8, 10),
    child: Row(
      children: [
        Expanded(
          child: Text(
            controller.error!,
            style: const TextStyle(fontSize: 12, color: Color(0xFFFFC8A5)),
          ),
        ),
        TextButton(
          onPressed: controller.refreshSessions,
          child: const Text('Retry'),
        ),
      ],
    ),
  );
  Widget _chats(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
        child: InkWell(
          onTap: () => _chooseDevice(context),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: BC.border),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.desktop_windows_outlined,
                  size: 19,
                  color: BC.muted,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    controller.device?.name ?? 'Your computer',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
                StatusDot(online: controller.online),
                const SizedBox(width: 8),
                const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  size: 18,
                  color: BC.muted,
                ),
              ],
            ),
          ),
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: TextField(
          key: const Key('session-search'),
          onChanged: controller.setSearch,
          decoration: const InputDecoration(
            hintText: 'Search conversations',
            prefixIcon: Icon(Icons.search, size: 20),
          ),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 12, 8),
        child: Row(
          children: [
            Expanded(
              child: TextButton.icon(
                onPressed: () => _chooseProject(context),
                icon: const Icon(
                  Icons.folder_outlined,
                  color: BC.muted,
                  size: 16,
                ),
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        controller.projectFilter,
                        style: const TextStyle(color: BC.muted, fontSize: 12),
                      ),
                    ),
                    const Icon(
                      Icons.keyboard_arrow_down,
                      size: 17,
                      color: BC.muted,
                    ),
                  ],
                ),
              ),
            ),
            IconButton(
              tooltip: 'Refresh chats',
              onPressed: controller.refreshSessions,
              icon: const Icon(Icons.refresh, color: BC.faint, size: 18),
            ),
          ],
        ),
      ),
      Expanded(
        child: controller.busy
            ? const Center(child: CircularProgressIndicator())
            : controller.visibleSessions.isEmpty
            ? EmptyState(
                icon: Icons.chat_bubble_outline,
                title: controller.search.isNotEmpty
                    ? 'No matching conversations'
                    : 'A fresh conversation',
                message: controller.search.isNotEmpty
                    ? 'Try a different search or project.'
                    : 'Start something in your project. It will appear on Desktop too.',
                action: controller.search.isNotEmpty
                    ? TextButton(
                        onPressed: () {
                          controller.setSearch('');
                          controller.setProject('All projects');
                        },
                        child: const Text('Clear filters'),
                      )
                    : FilledButton(
                        onPressed: controller.newChat,
                        child: const Text('New chat'),
                      ),
              )
            : RefreshIndicator(
                onRefresh: controller.refreshSessions,
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  itemCount:
                      controller.visibleSessions.length +
                      (controller.sessionCursor == null ? 0 : 1),
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) =>
                      index == controller.visibleSessions.length
                      ? Padding(
                          padding: const EdgeInsets.all(16),
                          child: OutlinedButton(
                            onPressed: controller.loadingSessions
                                ? null
                                : () => controller.refreshSessions(more: true),
                            child: Text(
                              controller.loadingSessions
                                  ? 'Loading…'
                                  : 'Load more conversations',
                            ),
                          ),
                        )
                      : _sessionRow(controller.visibleSessions[index]),
                ),
              ),
      ),
    ],
  );
  Widget _sessionRow(SessionSummary session) {
    final needs = controller.pendingRequests.any(
      (r) => r.sessionID == session.id,
    );
    return InkWell(
      onTap: () => controller.selectSession(session),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 39,
              height: 39,
              decoration: BoxDecoration(
                color: BC.surface,
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: BC.border),
              ),
              child: session.status == 'running'
                  ? const BrandMark(size: 28)
                  : const Icon(
                      Icons.chat_bubble_outline_rounded,
                      size: 18,
                      color: BC.muted,
                    ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    session.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w500,
                      fontSize: 15,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    session.project,
                    style: const TextStyle(fontSize: 12, color: BC.faint),
                  ),
                  if (needs || session.status == 'running')
                    Padding(
                      padding: const EdgeInsets.only(top: 7),
                      child: Row(
                        children: [
                          Icon(
                            needs ? Icons.error_outline : Icons.auto_awesome,
                            size: 12,
                            color: needs ? const Color(0xFFE9BC72) : BC.green,
                          ),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              needs ? 'Needs approval' : 'Working',
                              style: TextStyle(
                                fontSize: 11,
                                color: needs
                                    ? const Color(0xFFE9BC72)
                                    : BC.green,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              _ago(session.updated),
              style: const TextStyle(fontSize: 11, color: BC.faint),
            ),
          ],
        ),
      ),
    );
  }

  Widget _activity(BuildContext context) {
    final attention = sessionsForRequests();
    final running = controller.sessions
        .where((s) => s.status == 'running')
        .toList();
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 8),
        const Text(
          'Your work, at a glance.',
          style: TextStyle(color: BC.muted),
        ),
        const SizedBox(height: 28),
        if (attention.isNotEmpty) ...[
          const Text(
            'Needs your attention',
            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
          ),
          const SizedBox(height: 10),
          ...attention.map(_sessionRow),
          const SizedBox(height: 25),
        ],
        const Text(
          'In progress',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
        const SizedBox(height: 10),
        if (running.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Text(
              'No tasks running right now.',
              style: TextStyle(color: BC.faint),
            ),
          ),
        ...running.map(_sessionRow),
        const SizedBox(height: 32),
        const Divider(),
        const Padding(
          padding: EdgeInsets.only(top: 18),
          child: Text(
            'Activity refreshes while the app is open. Your computer keeps working when you leave.',
            style: TextStyle(color: BC.faint, fontSize: 12, height: 1.7),
          ),
        ),
      ],
    );
  }

  List<SessionSummary> sessionsForRequests() => controller.sessions
      .where((s) => controller.pendingRequests.any((r) => r.sessionID == s.id))
      .toList();
  Widget _devices(BuildContext context) => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      const SizedBox(height: 8),
      const Text(
        'Your computers run the work.\nThis phone keeps you connected.',
        style: TextStyle(color: BC.muted, fontSize: 16, height: 1.7),
      ),
      const SizedBox(height: 26),
      FilledButton.icon(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => AnimatedBuilder(
              animation: controller,
              builder: (_, _) => PairingScreen(controller: controller),
            ),
          ),
        ),
        icon: const Icon(Icons.add, size: 20),
        label: const Text('Add computer'),
      ),
      const SizedBox(height: 28),
      ...controller.devices.map(
        (device) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Container(
            decoration: BoxDecoration(
              color: BC.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BC.border),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 18,
                vertical: 10,
              ),
              leading: const Icon(Icons.computer, size: 25, color: BC.muted),
              title: Text(device.name, style: const TextStyle(fontSize: 15)),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Text(
                  '${device.platform}   ·   ${controller.online && controller.device?.id == device.id ? 'Connected' : 'Offline'}',
                  style: const TextStyle(fontSize: 12, color: BC.muted),
                ),
              ),
              trailing: IconButton(
                tooltip: 'Computer details',
                icon: const Icon(Icons.chevron_right, color: BC.muted),
                onPressed: () => _deviceDetails(context, device),
              ),
            ),
          ),
        ),
      ),
      const SizedBox(height: 24),
      const Text(
        'Connected through OpenTunnel',
        style: TextStyle(fontSize: 12, color: BC.faint),
      ),
      const SizedBox(height: 8),
      const Text(
        'Projects run on your computer. Model credentials stay there.',
        style: TextStyle(fontSize: 12, color: BC.faint),
      ),
    ],
  );
  Future<void> _chooseProject(BuildContext context) => showModalBottomSheet(
    context: context,
    builder: (context) => SafeArea(
      child: ListView(
        shrinkWrap: true,
        children: ['All projects', ...controller.projects]
            .map(
              (project) => ListTile(
                leading: const Icon(Icons.folder_outlined),
                title: Text(project),
                trailing: project == controller.projectFilter
                    ? const Icon(Icons.check, color: BC.orange)
                    : null,
                onTap: () {
                  controller.setProject(project);
                  Navigator.pop(context);
                },
              ),
            )
            .toList(),
      ),
    ),
  );
  Future<void> _chooseDevice(BuildContext context) => showModalBottomSheet(
    context: context,
    builder: (context) => SafeArea(
      child: ListView(
        shrinkWrap: true,
        children: controller.devices
            .map(
              (device) => ListTile(
                leading: const Icon(Icons.computer),
                title: Text(device.name),
                subtitle: Text(device.platform),
                onTap: () {
                  Navigator.pop(context);
                  if (!controller.previewMode) controller.connectDevice(device);
                },
              ),
            )
            .toList(),
      ),
    ),
  );
  Future<void> _deviceDetails(BuildContext context, DesktopDevice device) =>
      showModalBottomSheet(
        context: context,
        builder: (context) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  device.name,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                Text(device.platform, style: const TextStyle(color: BC.muted)),
                const SizedBox(height: 24),
                const Text(
                  'Removing this computer deletes its pairing and drafts on this phone. Desktop conversations stay on the computer.',
                  style: TextStyle(color: BC.muted, fontSize: 13),
                ),
                const SizedBox(height: 20),
                OutlinedButton(
                  onPressed: () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Remove computer?'),
                        content: const Text(
                          'You’ll need to scan a new QR to connect again.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('Keep computer'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('Remove'),
                          ),
                        ],
                      ),
                    );
                    if (confirmed == true) {
                      await controller.removeDevice(device);
                      if (context.mounted) Navigator.pop(context);
                    }
                  },
                  child: const Text(
                    'Remove computer',
                    style: TextStyle(color: Color(0xFFFF9A8E)),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
  Future<void> _preferences(BuildContext context) => showModalBottomSheet(
    context: context,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Make yourself at home',
              style: TextStyle(fontSize: 23, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 22),
            const Text('Appearance', style: TextStyle(color: BC.muted)),
            const SizedBox(height: 8),
            const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.dark_mode_outlined),
              title: Text('Dark'),
              subtitle: Text(
                'Warm surfaces, quiet contrast, and BharatCode orange.',
              ),
            ),
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 16),
            const Row(
              children: [
                BrandMark(),
                SizedBox(width: 10),
                Text(
                  'BharatCode Mobile',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Development preview · 0.1.0\nBuilt for the work you take with you.',
              style: TextStyle(fontSize: 12, color: BC.faint, height: 1.8),
            ),
          ],
        ),
      ),
    ),
  );
}

String _ago(DateTime value) {
  final diff = DateTime.now().difference(value);
  if (diff.inDays > 0) return '${diff.inDays}d';
  if (diff.inHours > 0) return '${diff.inHours}h';
  return diff.inMinutes > 0 ? '${diff.inMinutes}m' : 'Now';
}
