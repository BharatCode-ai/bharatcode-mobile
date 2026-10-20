import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import 'connection/api_client.dart';
import 'connection/device_store.dart';
import 'connection/pairing_payload.dart';
import 'models/models.dart';

class AppController extends ChangeNotifier {
  final DeviceStore store;
  bool previewMode = false, busy = false, online = false, sending = false;
  String? error, confirmation, selectedID, messageCursor;
  String search = '', projectFilter = 'All projects', resolution = '';
  String agentName = 'Build', modelName = 'Desktop model';
  int tab = 0, _generation = 0, _sequence = 0;
  List<DesktopDevice> devices = [];
  DesktopDevice? device;
  List<SessionSummary> sessions = [];
  List<ChatMessage> messages = [];
  List<AgentRequest> pendingRequests = [];
  final Map<String, String> _drafts = {};
  final Map<String, Map<String, dynamic>> _pendingPrompts = {};
  ApiClient? _api, _pairingApi;
  Timer? _pairTimer, _refreshTimer, _reconnectTimer;
  StreamSubscription<Map<String, dynamic>>? _subscription;
  int _pairGeneration = 0;
  bool _disposed = false;

  AppController({this.store = const DeviceStore()});
  AppController.preview({this.store = const DeviceStore()}) {
    enterPreview();
  }
  SessionSummary? get selected =>
      sessions.where((s) => s.id == selectedID).firstOrNull;
  String get _draftKey => '${device?.id ?? 'preview'}.$selectedID';
  String get draft => _drafts[_draftKey] ?? '';
  List<SessionSummary> get visibleSessions => sessions
      .where(
        (s) =>
            (projectFilter == 'All projects' || s.project == projectFilter) &&
            s.title.toLowerCase().contains(search.toLowerCase()),
      )
      .toList();
  List<String> get projects =>
      sessions.map((s) => s.project).toSet().toList()..sort();
  void changed() {
    if (!_disposed) notifyListeners();
  }

  void setSearch(String value) {
    search = value;
    changed();
  }

  void setProject(String value) {
    projectFilter = value;
    changed();
  }

  void setTab(int value) {
    tab = value;
    selectedID = null;
    changed();
  }

  void setDraft(String value) {
    _drafts[_draftKey] = value;
    if (!previewMode && device != null && selectedID != null) {
      unawaited(
        store.saveDraft(device!.id, selectedID!, value).catchError((Object _) {
          error = 'Your draft could not be saved on this phone. Keep the app open and retry.';
          changed();
        }),
      );
    }
  }

  void clearError() {
    error = null;
    changed();
  }

  Future<void> restore() async {
    try {
      devices = await store.load();
      if (devices.isNotEmpty) await connectDevice(devices.first);
    } catch (_) {
      error = 'Saved pairing could not be opened. You can pair your computer again.';
      changed();
    }
  }

  void enterPreview() {
    _subscription?.cancel();
    _api?.close();
    _api = null;
    previewMode = true;
    online = true;
    error = null;
    selectedID = null;
    device = const DesktopDevice(
      id: 'preview',
      name: 'My workstation',
      platform: 'Linux',
      origin: '',
      token: '',
      connected: true,
    );
    devices = [device!];
    final now = DateTime.now();
    sessions = [
      SessionSummary(
        id: 'ses_checkout',
        title: 'Fix checkout validation',
        project: 'storefront',
        status: 'running',
        updated: now.subtract(const Duration(minutes: 2)),
      ),
      SessionSummary(
        id: 'ses_theme',
        title: 'Add dark mode',
        project: 'mobile-app',
        updated: now.subtract(const Duration(hours: 1)),
      ),
      SessionSummary(
        id: 'ses_auth',
        title: 'Review auth middleware',
        project: 'api',
        status: 'attention',
        updated: now.subtract(const Duration(hours: 3)),
      ),
      SessionSummary(
        id: 'ses_docs',
        title: 'Write API documentation',
        project: 'docs',
        updated: now.subtract(const Duration(days: 1)),
      ),
    ];
    pendingRequests = [
      const AgentRequest(
        id: 'per_demo',
        sessionID: 'ses_auth',
        title: 'Run the regression tests?',
        command: 'npm test -- auth.test.ts',
        directory: '/projects/api',
      ),
    ];
    changed();
  }

  Future<void> selectSession(SessionSummary session) async {
    selectedID = session.id;
    resolution = '';
    messageCursor = null;
    _sequence = 0;
    final generation = ++_generation;
    await _subscription?.cancel();
    _refreshTimer?.cancel();
    _reconnectTimer?.cancel();
    if (previewMode) {
      messages = [
        const ChatMessage(
          id: 'msg_demo1',
          role: 'user',
          text: 'Fix the address validation and add a regression test.',
        ),
        ChatMessage(
          id: 'msg_demo2',
          role: 'assistant',
          text: session.id == 'ses_auth'
              ? 'I found a missing check in the authentication middleware. The fix is ready; I need your approval to run the regression tests.'
              : 'I found the issue. Empty apartment fields were being treated as invalid.\n\nThe validation was checking for a non-empty string instead of allowing an optional apartment field. I’ve updated the logic to only validate when a value is provided.\n\n```typescript\n// address.ts\nconst apartment = address.apartment?.trim();\n\nif (apartment && apartment.length > 100) {\n  return invalid("Apartment is too long");\n}\n```',
          tools: const [
            ToolActivity(
              'Read 3 files',
              'completed',
              'address.ts, checkout.ts, address.test.ts',
              'Located address validation and its tests.',
            ),
          ],
        ),
      ];
      changed();
      return;
    }
    messages = [];
    busy = true;
    changed();
    try {
      if (device != null) {
        final saved = await store.draft(device!.id, session.id);
        if (generation != _generation) return;
        _drafts.putIfAbsent(_draftKey, () => saved);
        final pending = await store.pending(device!.id, session.id);
        if (generation != _generation) return;
        if (pending != null) _pendingPrompts[_draftKey] = pending;
      }
      await _loadMessages(generation);
      if (generation == _generation) {
        await _loadRequests();
        _subscribe(generation);
      }
    } catch (e) {
      _failed(e);
    } finally {
      if (generation == _generation) {
        busy = false;
        changed();
      }
    }
  }

  void backToChats() {
    selectedID = null;
    ++_generation;
    _subscription?.cancel();
    _reconnectTimer?.cancel();
    changed();
  }

  Future<void> _loadMessages(int generation, {bool older = false}) async {
    final session = selectedID, api = _api;
    if (session == null || api == null) return;
    final page = await api.messagePage(
      session,
      cursor: older ? messageCursor : null,
    );
    if (generation != _generation) return;
    final list = (page['data'] as List)
        .map((e) => ChatMessage.fromJson(Map<String, dynamic>.from(e)))
        .toList()
        .reversed
        .toList();
    if (older) {
      final ids = messages.map((m) => m.id).toSet();
      messages = [...list.where((m) => !ids.contains(m.id)), ...messages];
    } else {
      messages = list;
    }
    messageCursor = (page['cursor'] as Map?)?['next'] as String?;
    online = true;
    changed();
  }

  Future<void> loadOlder() async {
    if (messageCursor != null) {
      try {
        await _loadMessages(_generation, older: true);
      } catch (e) {
        _failed(e);
      }
    }
  }

  Future<void> _loadRequests() async {
    if (_api == null || selectedID == null) return;
    final session = selectedID!;
    final value = await _api!.request(
      'GET',
      '/api/session/$session/permission',
    );
    if (selectedID != session) return;
    pendingRequests = (value['data'] as List? ?? []).map((e) {
      final j = Map<String, dynamic>.from(e);
      return AgentRequest(
        id: j['id'] as String,
        sessionID: session,
        title: 'Allow ${j['action']}?',
        command: (j['resources'] as List? ?? []).join('\n'),
        directory: selected?.directory ?? '',
        raw: j,
      );
    }).toList();
    final questions = await _api!.request(
      'GET',
      '/api/session/$session/question',
    );
    if (selectedID != session) return;
    pendingRequests.addAll(
      (questions['data'] as List? ?? []).map((e) {
        final j = Map<String, dynamic>.from(e);
        return AgentRequest(
          id: j['id'] as String,
          sessionID: session,
          title: 'BharatCode has a question',
          question: true,
          raw: j,
        );
      }),
    );
    changed();
  }

  Future<List<Map<String, dynamic>>> configuration(String kind) async {
    if (previewMode) {
      return kind == 'agent'
          ? [
              {'id': 'build', 'name': 'Build'},
              {'id': 'plan', 'name': 'Plan'},
            ]
          : [
              {
                'id': 'sample',
                'providerID': 'preview',
                'name': 'Sample Desktop model',
                'enabled': true,
              },
            ];
    }
    final result = await _api!.request(
      'GET',
      '/api/$kind',
      query: {
        if (selected?.directory.isNotEmpty ?? false)
          'location[directory]': selected!.directory,
      },
    );
    return (result['data'] as List)
        .map((v) => Map<String, dynamic>.from(v))
        .where((v) => v['enabled'] != false)
        .toList();
  }

  Future<void> switchConfiguration(
    String kind,
    Map<String, dynamic> item,
  ) async {
    try {
      if (!previewMode) {
        await _api!.request(
          'POST',
          '/api/session/$selectedID/$kind',
          body: kind == 'agent'
              ? {'agent': item['id']}
              : {
                  'model': {'id': item['id'], 'providerID': item['providerID']},
                },
        );
      }
      if (kind == 'agent') {
        agentName = '${item['name'] ?? item['id']}';
      } else {
        modelName = '${item['name'] ?? item['id']}';
      }
      changed();
    } catch (e) {
      _failed(e);
    }
  }

  Future<bool> answer(AgentRequest request, List<List<String>> answers) async {
    try {
      if (!previewMode) {
        await _api!.request(
          'POST',
          '/api/session/${request.sessionID}/question/${request.id}/reply',
          body: {'answers': answers},
        );
      }
      pendingRequests.removeWhere((r) => r.id == request.id);
      resolution = 'Answer sent';
      changed();
      return true;
    } catch (e) {
      _failed(e);
      return false;
    }
  }

  void _subscribe(int generation) {
    if (_api == null || selectedID == null) return;
    _subscription = _api!
        .events(selectedID!, after: _sequence)
        .listen(
          (event) {
            if (generation != _generation) return;
            // Durable stream envelopes use aggregateID/seq; transient events may omit it.
            final sequence = event['seq'] ?? (event['durable'] as Map?)?['seq'];
            if (sequence is int && sequence <= _sequence) return;
            online = true;
            _refreshTimer?.cancel();
            _refreshTimer = Timer(const Duration(milliseconds: 180), () async {
              try {
                await _loadMessages(generation);
                await _loadRequests();
                if (generation == _generation && sequence is int) {
                  _sequence = sequence;
                }
              } catch (e) {
                _failed(e);
              }
            });
          },
          onError: (Object error) => _lostStream(generation, error),
          onDone: () => _lostStream(
            generation,
            const ApiException(0, 'Connection interrupted.'),
          ),
        );
  }

  void _lostStream(int generation, Object e) {
    if (generation != _generation || _disposed) return;
    online = false;
    error = 'Reconnecting to your computer. Your draft is saved.';
    changed();
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 4), () async {
      if (generation != _generation) return;
      try {
        await _loadMessages(generation);
        await _loadRequests();
        error = null;
        _subscribe(generation);
      } catch (e) {
        _lostStream(generation, e);
      }
    });
  }

  Future<void> send() async {
    if (sending || draft.trim().isEmpty || selectedID == null || !online) {
      return;
    }
    final text = draft.trim(), session = selectedID!, key = _draftKey;
    sending = true;
    error = null;
    changed();
    if (previewMode) {
      messages = [
        ...messages,
        ChatMessage(id: 'msg_${const Uuid().v4()}', role: 'user', text: text),
        const ChatMessage(
          id: 'msg_preview_reply',
          role: 'assistant',
          text: 'This is a sample workspace. Pair your computer to run this task in your real project.',
        ),
      ];
      _drafts[key] = '';
      sending = false;
      changed();
      return;
    }
    // Keep the same ID and text until admission is known, even if the user edits a new draft.
    _pendingPrompts.putIfAbsent(
      key,
      () => {
        'session': session,
        'id': 'msg_${const Uuid().v4().replaceAll('-', '')}',
        'text': text,
      },
    );
    final pending = _pendingPrompts[key]!;
    if (pending['session'] != session || pending['text'] != text) {
      sending = false;
      error = 'A previous message has unconfirmed delivery. Restore its text and retry before sending another.';
      changed();
      return;
    }
    try {
      await store.savePending(device!.id, session, pending);
      await _api!.prompt(session, pending['id'] as String, text);
      _pendingPrompts.remove(key);
      await store.savePending(device!.id, session, null);
      if (_drafts[key]?.trim() == text) _drafts[key] = '';
      if (device != null) {
        await store.saveDraft(device!.id, session, _drafts[key] ?? '');
      }
      await _loadMessages(_generation);
    } catch (_) {
      error = 'Delivery is unconfirmed. Retry this message to check admission; it will use the same message ID.';
    } finally {
      sending = false;
      changed();
    }
  }

  Future<void> stop() async {
    try {
      if (!previewMode && selectedID != null) {
        await _api!.interrupt(selectedID!);
      }
      resolution = 'Stop requested';
      changed();
    } catch (e) {
      _failed(e);
    }
  }

  Future<void> resolve(AgentRequest request, bool allow) async {
    if (busy) return;
    busy = true;
    changed();
    try {
      if (!previewMode) {
        await _api!.request(
          'POST',
          '/api/session/${request.sessionID}/permission/${request.id}/reply',
          body: {'reply': allow ? 'once' : 'reject'},
        );
      }
      pendingRequests = pendingRequests
          .where((r) => r.id != request.id)
          .toList();
      resolution = allow ? 'Allowed once' : 'Denied';
    } on ApiException catch (e) {
      if (e.status == 404) {
        await _loadRequests();
        resolution = 'Resolved on Desktop';
      } else {
        _failed(e);
      }
    } catch (e) {
      _failed(e);
    } finally {
      busy = false;
      changed();
    }
  }

  Future<void> connectDevice(DesktopDevice next) async {
    ++_generation;
    await _subscription?.cancel();
    _api?.close();
    previewMode = false;
    device = next;
    selectedID = null;
    sessions = [];
    busy = true;
    changed();
    _api = ApiClient(Uri.parse(next.origin), next.token);
    try {
      final health = await _api!.request('GET', '/mobile/v1/health');
      if (health['protocol'] != 1 ||
          (health['desktop'] as Map)['id'] != next.id) {
        throw const ApiException(
          409,
          'Desktop identity or protocol changed. Pair this computer again.',
        );
      }
      await refreshSessions();
    } catch (e) {
      _failed(e);
    } finally {
      busy = false;
      changed();
    }
  }

  Future<void> refreshSessions() async {
    if (previewMode || _api == null) return;
    try {
      sessions = await _api!.sessions();
      online = true;
      error = null;
      changed();
    } catch (e) {
      _failed(e);
    }
  }

  Future<void> newChat() async {
    if (previewMode) {
      final session = SessionSummary(
        id: 'ses_${const Uuid().v4()}',
        title: 'New chat',
        project: projectFilter == 'All projects' ? 'storefront' : projectFilter,
        updated: DateTime.now(),
      );
      sessions.insert(0, session);
      await selectSession(session);
      messages = [];
      changed();
      return;
    }
    try {
      final directory = projectFilter == 'All projects'
          ? null
          : sessions
                .where((s) => s.project == projectFilter)
                .firstOrNull
                ?.directory;
      final data = await _api!.request(
        'POST',
        '/api/session',
        body: {
          if (directory != null) 'location': {'directory': directory},
        },
      );
      final session = SessionSummary.fromJson(
        Map<String, dynamic>.from(data['data']),
      );
      sessions.insert(0, session);
      await selectSession(session);
    } catch (e) {
      _failed(e);
    }
  }

  Future<void> pair(String value) async {
    cancelPairing();
    final generation = _pairGeneration;
    busy = true;
    error = null;
    changed();
    try {
      final payload = PairingPayload.parse(value);
      _pairingApi = ApiClient(payload.origin, '');
      final claim = await _pairingApi!.request(
        'POST',
        '/mobile/v1/claim',
        body: {
          'code': payload.code,
          'deviceName': defaultTargetPlatform == TargetPlatform.iOS
              ? 'iPhone'
              : 'Android phone',
        },
      );
      if (generation != _pairGeneration) return;
      confirmation = claim['confirmation'] as String;
      busy = false;
      changed();
      Future<void> poll() async {
        if (generation != _pairGeneration || _disposed) return;
        try {
          final result = await _pairingApi!.request(
            'POST',
            '/mobile/v1/claim/status',
            body: {
              'claimID': claim['claimID'],
              'claimSecret': claim['claimSecret'],
            },
          );
          if (generation != _pairGeneration) return;
          if (result['state'] == 'approved') {
            final desktop = result['desktop'] as Map;
            if (desktop['id'] != payload.desktopID) {
              throw const FormatException(
                'Computer identity did not match the scanned code.',
              );
            }
            final paired = DesktopDevice(
              id: desktop['id'],
              name: desktop['name'],
              platform: desktop['platform'],
              origin: payload.origin.toString(),
              token: result['token'],
              credentialID: (result['device'] as Map)['id'],
            );
            devices = [
              ...devices.where((d) => d.id != paired.id && d.id != 'preview'),
              paired,
            ];
            await store.save(devices);
            confirmation = null;
            _pairingApi?.close();
            _pairingApi = null;
            await connectDevice(paired);
            return;
          }
          if (result['state'] == 'declined') {
            throw const ApiException(
              403,
              'Connection declined on your computer.',
            );
          }
          _pairTimer = Timer(const Duration(seconds: 2), poll);
        } catch (e) {
          if (generation == _pairGeneration) {
            confirmation = null;
            _failed(e);
          }
        }
      }

      unawaited(poll());
    } catch (e) {
      _failed(e);
    } finally {
      busy = false;
      changed();
    }
  }

  void cancelPairing() {
    ++_pairGeneration;
    _pairTimer?.cancel();
    _pairingApi?.close();
    _pairingApi = null;
    confirmation = null;
  }

  Future<void> removeDevice(DesktopDevice target) async {
    if (!previewMode) {
      final client = ApiClient(Uri.parse(target.origin), target.token);
      try {
        await client.request('DELETE', '/mobile/v1/device');
      } catch (_) {
        error = 'Removed from this phone. If offline, revoke its access in Desktop too.';
      } finally {
        client.close();
      }
      devices = devices.where((d) => d.id != target.id).toList();
      await store.save(devices);
      await store.clearDevice(target.id);
    } else {
      devices = [];
    }
    if (device?.id == target.id) {
      device = null;
      selectedID = null;
      sessions = [];
      online = false;
      _api?.close();
      _api = null;
      previewMode = false;
    }
    changed();
  }

  Future<void> suspend() async {
    ++_generation;
    await _subscription?.cancel();
    _reconnectTimer?.cancel();
    _refreshTimer?.cancel();
    if (!previewMode) {
      online = false;
      changed();
    }
  }

  Future<void> resume() async {
    if (previewMode || _api == null) return;
    if (selected != null) {
      await selectSession(selected!);
    } else {
      await refreshSessions();
    }
  }

  void _failed(Object e) {
    error = e is ApiException
        ? e.message
        : e is FormatException
        ? e.message
        : 'Could not reach your computer. Your draft is saved.';
    online = false;
    changed();
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    cancelPairing();
    _subscription?.cancel();
    _refreshTimer?.cancel();
    _reconnectTimer?.cancel();
    _api?.close();
    super.dispose();
  }
}
