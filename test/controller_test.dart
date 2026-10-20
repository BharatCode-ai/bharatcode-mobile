import 'dart:async';

import 'package:bharatcode_mobile/controller.dart';
import 'package:bharatcode_mobile/connection/api_client.dart';
import 'package:bharatcode_mobile/connection/device_store.dart';
import 'package:bharatcode_mobile/models/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const computer = DesktopDevice(
  id: 'pc_one',
  name: 'Work',
  origin: 'https://one.opentunnel.xyz',
  token: 'one',
);
const otherComputer = DesktopDevice(
  id: 'pc_two',
  name: 'Home',
  origin: 'https://two.opentunnel.xyz',
  token: 'two',
);
final conversation = SessionSummary(
  id: 'ses_one',
  title: 'Tests',
  project: 'app',
  updated: DateTime(2026),
);

class ControlledStore extends DeviceStore {
  Completer<void>? saving;
  bool failAdmission = false;
  @override
  Future<void> savePending(
    String device,
    String session,
    Map<String, dynamic>? value,
  ) async {
    await saving?.future;
    await super.savePending(device, session, value);
  }

  @override
  Future<void> admit(
    String device,
    String session,
    String id,
    String text,
  ) async {
    if (failAdmission) throw StateError('Storage unavailable');
    await super.admit(device, session, id, text);
  }
}

class FakeApi extends ApiClient {
  FakeApi(String id) : super(Uri.parse('https://one.opentunnel.xyz'), id);
  @override
  Future<Map<String, dynamic>> sessionPage({
    String? cursor,
    String? search,
  }) async => {
    'data': [
      {'id': 'ses_one', 'title': 'Tests'},
    ],
  };
  @override
  Stream<Map<String, dynamic>> liveEvents(String session) => stream.stream;
  String? wireCursor;
  int messageReads = 0;
  bool failMessageReads = false, replayAvailable = true;
  int replaySubscriptions = 0;
  List<Map<String, dynamic>> wireMessages = [];
  List<Map<String, dynamic>> pendingPermissions = [];
  final sent = <String>[];
  final stream = StreamController<Map<String, dynamic>>.broadcast();
  @override
  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async => path.endsWith('health')
      ? {
          'protocol': 1,
          'desktop': {'id': token},
          'capabilities': {'replay': replayAvailable},
        }
      : {
          'data': path.endsWith('active')
              ? {}
              : path.contains('permission')
              ? pendingPermissions
              : [],
        };
  @override
  Future<List<SessionSummary>> sessions({
    String? cursor,
    String? search,
  }) async => [conversation];
  @override
  Future<Map<String, dynamic>> messagePage(
    String session, {
    String? cursor,
  }) async {
    messageReads++;
    if (failMessageReads) throw StateError('History unavailable');
    return {
      'data': wireMessages,
      'cursor': {'next': wireCursor},
    };
  }

  @override
  Stream<Map<String, dynamic>> events(String session, {int after = 0}) {
    replaySubscriptions++;
    return stream.stream;
  }

  @override
  Future<void> prompt(String session, String id, String text) async {
    sent.add('$session/$id/$text');
  }

  @override
  void close() {} // Controlled stream remains available until test teardown.
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets(
    'a transient initial health failure reconnects without tapping Retry',
    (tester) async {
      final api = RecoveringApi();
      final controller = AppController(apiFactory: (_, _) => api);
      try {
        await controller.connectDevice(computer);
        expect(controller.online, isFalse);
        expect(controller.sessions, isEmpty);
        api.unavailable = false;
        await tester.pump(const Duration(seconds: 5));
        await tester.pump();
        expect(controller.online, isTrue);
        expect(controller.error, isNull);
        expect(controller.sessions.single.id, 'ses_one');
      } finally {
        controller.dispose();
        await api.stream.close();
      }
    },
  );
  for (final status in [401, 409]) {
    testWidgets('pairing rejection $status does not retry in the background', (
      tester,
    ) async {
      final api = RecoveringApi()..failureStatus = status;
      final controller = AppController(apiFactory: (_, _) => api);
      try {
        await controller.connectDevice(computer);
        await tester.pump(const Duration(seconds: 10));
        expect(controller.online, isFalse);
        expect(api.healthRequests, 1);
      } finally {
        controller.dispose();
        await api.stream.close();
      }
    });
  }
  test(
    'switching computer during outbox save cannot send to either computer',
    () async {
      final store = ControlledStore(), apis = <FakeApi>[];
      final controller = AppController(
        store: store,
        apiFactory: (_, token) {
          final api = FakeApi(token == 'one' ? 'pc_one' : 'pc_two');
          apis.add(api);
          return api;
        },
      );
      await controller.connectDevice(computer);
      await controller.selectSession(conversation);
      controller.setDraft('Run tests');
      store.saving = Completer<void>();
      final sending = controller.send();
      await controller.connectDevice(otherComputer);
      store.saving!.complete();
      await sending;
      expect(apis.expand((a) => a.sent), isEmpty);
      expect((await store.pending('pc_one', 'ses_one'))?['text'], 'Run tests');
      expect(await store.pending('pc_two', 'ses_one'), isNull);
      controller.dispose();
      for (final api in apis) {
        await api.stream.close();
      }
    },
  );
  test(
    'Desktop without replay uses live updates and confirmed history',
    () async {
      final api = FakeApi('pc_one')..replayAvailable = false;
      final controller = AppController(apiFactory: (_, _) => api);
      await controller.connectDevice(computer);
      await controller.selectSession(conversation);
      expect(api.replaySubscriptions, 0);
      api.stream.add({
        'id': 'evt_live_only',
        'type': 'session.next.text.delta',
        'data': {
          'sessionID': conversation.id,
          'assistantMessageID': 'msg_live',
          'textID': 'txt_live',
          'delta': 'Live reply',
        },
      });
      await Future<void>.delayed(Duration.zero);
      expect(controller.messages.single.text, 'Live reply');
      controller.setDraft('Continue');
      await controller.send();
      expect(api.sent, hasLength(1));
      controller.dispose();
      await api.stream.close();
    },
  );
  test('reopening a chat exposes its durable unconfirmed message', () async {
    final store = const DeviceStore();
    await store.savePending(computer.id, conversation.id, {
      'session': conversation.id,
      'id': 'msg_pending',
      'text': 'Original message',
    });
    final api = FakeApi('pc_one');
    final controller = AppController(store: store, apiFactory: (_, _) => api);
    await controller.connectDevice(computer);
    await controller.selectSession(conversation);
    expect(controller.error, contains('unconfirmed'));
    expect(controller.unconfirmedText, 'Original message');
    controller.restoreUnconfirmedDraft();
    await controller.send();
    expect(api.sent.single, contains('msg_pending/Original message'));
    expect(controller.unconfirmedText, isNull);
    controller.dispose();
    await api.stream.close();
  });
  test('revoked event credentials disable sending immediately', () async {
    final api = FakeApi('pc_one');
    final controller = AppController(apiFactory: (_, _) => api);
    await controller.connectDevice(computer);
    await controller.selectSession(conversation);
    api.stream.addError(const ApiException(401, 'Pair again'));
    await Future<void>.delayed(Duration.zero);
    expect(controller.online, false);
    expect(controller.error, 'Pair again');
    controller.setDraft('Must not be sent');
    await controller.send();
    expect(api.sent, isEmpty);
    controller.dispose();
    await api.stream.close();
  });
  test(
    'event stream failure does not disable a healthy prompt connection',
    () async {
      final api = FakeApi('pc_one');
      final controller = AppController(apiFactory: (_, _) => api);
      await controller.connectDevice(computer);
      await controller.selectSession(conversation);
      api.stream.addError(const ApiException(502, 'Replay unavailable'));
      await Future<void>.delayed(Duration.zero);
      expect(controller.online, true);
      controller.setDraft('A message while updates reconnect');
      await controller.send();
      expect(api.sent, hasLength(1));
      controller.dispose();
      await api.stream.close();
    },
  );
  test('a history refresh failure does not undo confirmed delivery', () async {
    final api = FakeApi('pc_one');
    final controller = AppController(apiFactory: (_, _) => api);
    await controller.connectDevice(computer);
    await controller.selectSession(conversation);
    controller.setDraft('Hello');
    api.failMessageReads = true;
    await controller.send();
    expect(api.sent, hasLength(1));
    expect(controller.draft, isEmpty);
    expect(controller.error, contains('Message sent'));
    expect(controller.error, isNot(contains('Delivery is unconfirmed')));
    expect(
      await controller.store.pending(computer.id, conversation.id),
      isNull,
    );
    controller.dispose();
    await api.stream.close();
  });
  test(
    'storage failure after admission retries the same message identity',
    () async {
      final store = ControlledStore()..failAdmission = true;
      final api = FakeApi('pc_one');
      final controller = AppController(store: store, apiFactory: (_, _) => api);
      await controller.connectDevice(computer);
      await controller.selectSession(conversation);
      controller.setDraft('Run tests');
      await controller.send();
      expect(controller.draft, 'Run tests');
      store.failAdmission = false;
      await controller.send();
      expect(api.sent.length, 2);
      expect(api.sent.first, api.sent.last);
      expect(controller.draft, '');
      expect(await store.pending('pc_one', 'ses_one'), isNull);
      expect(await store.draft('pc_one', 'ses_one'), '');
      controller.dispose();
      await api.stream.close();
    },
  );
  test(
    'transient text renders immediately and a late approval wakes discovery',
    () async {
      final api = FakeApi('pc_one');
      final controller = AppController(apiFactory: (_, _) => api);
      await controller.connectDevice(computer);
      await controller.selectSession(conversation);
      api.stream.add({
        'id': 'evt_text',
        'type': 'session.next.text.delta',
        'data': {
          'sessionID': 'ses_one',
          'assistantMessageID': 'msg_one',
          'textID': 'txt_one',
          'delta': 'Streaming now',
        },
      });
      await Future<void>.delayed(Duration.zero);
      expect(controller.messages.single.text, 'Streaming now');
      api.pendingPermissions = [
        {
          'id': 'per_late',
          'sessionID': 'ses_one',
          'action': 'shell',
          'resources': ['npm test'],
        },
      ];
      api.stream.add({
        'id': 'evt_permission',
        'type': 'permission.v2.asked',
        'data': {'sessionID': 'ses_one', 'id': 'per_late'},
      });
      await Future<void>.delayed(const Duration(milliseconds: 250));
      expect(controller.pendingRequests.single.id, 'per_late');
      controller.dispose();
      await api.stream.close();
    },
  );
  test('mid-response deltas retain projected prefix and authoritative recovery wins', () async {
    final api = FakeApi('pc_one');
    Map<String, dynamic> message(String text) => {
      'id': 'msg_one',
      'type': 'assistant',
      'content': [
        {'id': 'txt_one', 'type': 'text', 'text': text},
      ],
    };
    api.wireMessages = [message('Hello')];
    final controller = AppController(apiFactory: (_, _) => api);
    await controller.connectDevice(computer);
    await controller.selectSession(conversation);
    api.stream.add({
      'id': 'evt_text',
      'type': 'session.next.text.delta',
      'data': {
        'sessionID': 'ses_one',
        'assistantMessageID': 'msg_one',
        'textID': 'txt_one',
        'delta': ' world',
      },
    });
    await Future<void>.delayed(Duration.zero);
    expect(controller.messages.single.text, 'Hello world');
    api.wireMessages = [message('Hello world, recovered')];
    api.stream.add({
      'id': 'evt_end',
      'type': 'session.next.step.ended',
      'durable': {'seq': 2},
      'data': {'sessionID': 'ses_one'},
    });
    await Future<void>.delayed(const Duration(milliseconds: 250));
    expect(controller.messages.single.text, 'Hello world, recovered');
    controller.dispose();
    await api.stream.close();
  });
  test('continuous events refresh before the stream goes quiet', () async {
    final api = FakeApi('pc_one');
    final controller = AppController(apiFactory: (_, _) => api);
    await controller.connectDevice(computer);
    await controller.selectSession(conversation);
    final initial = api.messageReads;
    for (var i = 1; i <= 8; i++) {
      api.stream.add({
        'id': 'evt_$i',
        'type': 'session.next.tool.progress',
        'durable': {'seq': i},
        'data': {'sessionID': 'ses_one'},
      });
      await Future<void>.delayed(const Duration(milliseconds: 60));
    }
    expect(api.messageReads, greaterThan(initial + 1));
    controller.dispose();
    await api.stream.close();
  });
  test('model and agent labels belong to their conversation', () async {
    final controller = AppController.preview();
    final first = controller.sessions.first;
    final second = controller.sessions.last;
    await controller.selectSession(first);
    await controller.switchConfiguration('model', {
      'id': 'model_a',
      'name': 'Model A',
    });
    await controller.switchConfiguration('agent', {
      'id': 'plan',
      'name': 'Plan',
    });
    await controller.selectSession(second);
    expect(controller.modelName, 'Desktop model');
    expect(controller.agentName, 'Build');
    await controller.selectSession(first);
    expect(controller.modelName, 'Model A');
    expect(controller.agentName, 'Plan');
    controller.dispose();
  });
  test('chat navigation does not wait for an old stream to close', () async {
    final api = DelayedCancelApi();
    final controller = AppController(apiFactory: (_, _) => api);
    await controller.connectDevice(computer);
    await controller.selectSession(conversation);
    api.cancellation = Completer<void>();
    var opened = false;
    final opening = controller.selectSession(conversation).then((_) {
      opened = true;
    });
    try {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(opened, true);
    } finally {
      api.cancellation!.complete();
      await opening;
      controller.dispose();
      await api.durable.close();
      await api.stream.close();
    }
  });
  test(
    'preview supersedes a connection awaiting subscription cancellation',
    () async {
      final api = DelayedCancelApi();
      final controller = AppController(apiFactory: (_, _) => api);
      await controller.connectDevice(computer);
      await controller.selectSession(conversation);
      api.cancellation = Completer<void>();
      final connecting = controller.connectDevice(otherComputer);
      await Future<void>.delayed(Duration.zero);
      controller.enterPreview();
      api.cancellation!.complete();
      await connecting;
      expect(controller.previewMode, true);
      expect(controller.device!.id, 'preview');
      expect(controller.sessions, isNotEmpty);
      controller.dispose();
      await api.durable.close();
      await api.stream.close();
    },
  );
  test(
    'new computer can load while an old computer page is unfinished',
    () async {
      final first = DelayedPageApi(), second = FakeApi('pc_two');
      final controller = AppController(
        apiFactory: (_, token) => token == 'one' ? first : second,
      );
      await controller.connectDevice(computer);
      first.page = Completer<Map<String, dynamic>>();
      final loading = controller.refreshSessions();
      await Future<void>.delayed(Duration.zero);
      await controller.connectDevice(otherComputer);
      expect(controller.sessions.single.id, 'ses_one');
      first.page!.complete({
        'data': [
          {'id': 'ses_stale', 'title': 'Wrong computer'},
        ],
      });
      await loading;
      expect(controller.device!.id, 'pc_two');
      expect(controller.sessions.single.id, 'ses_one');
      controller.dispose();
      await first.stream.close();
      await second.stream.close();
    },
  );
  test('obsolete failure cannot mark a replacement API for the same computer offline', () async {
    final first = DelayedPageApi(), second = FakeApi('pc_one');
    var call = 0;
    final controller = AppController(
      apiFactory: (_, _) => call++ == 0 ? first : second,
    );
    await controller.connectDevice(computer);
    first.page = Completer<Map<String, dynamic>>();
    final loading = controller.refreshSessions();
    await Future<void>.delayed(Duration.zero);
    await controller.connectDevice(computer);
    first.page!.completeError(const ApiException(0, 'Old connection failed'));
    await loading;
    expect(controller.online, true);
    expect(controller.error, isNull);
    controller.dispose();
    await first.stream.close();
    await second.stream.close();
  });
  test(
    'recovery after many new messages resets to a contiguous window and cursor',
    () async {
      final api = FakeApi('pc_one')..wireCursor = 'before_51';
      Map<String, dynamic> message(int index) => {
        'id': 'msg_$index',
        'type': 'user',
        'text': 'Message $index',
      };
      api.wireMessages = List.generate(50, (i) => message(100 - i));
      final controller = AppController(apiFactory: (_, _) => api);
      await controller.connectDevice(computer);
      await controller.selectSession(conversation);
      expect(controller.messages.first.id, 'msg_51');
      api.wireMessages = List.generate(50, (i) => message(200 - i));
      api.wireCursor = 'before_151';
      api.stream.add({
        'id': 'evt_recovered',
        'type': 'session.next.step.ended',
        'durable': {'seq': 3},
        'data': {'sessionID': 'ses_one'},
      });
      await Future<void>.delayed(const Duration(milliseconds: 250));
      expect(controller.messages.length, 50);
      expect(controller.messages.first.id, 'msg_151');
      expect(controller.messageCursor, 'before_151');
      controller.dispose();
      await api.stream.close();
    },
  );
  test(
    'server search and cursor expose a conversation beyond the first page',
    () async {
      final api = PagedApi();
      final controller = AppController(apiFactory: (_, _) => api);
      await controller.connectDevice(computer);
      expect(controller.sessions.length, 40);
      expect(controller.sessionCursor, 'page_two');
      await controller.refreshSessions(more: true);
      expect(controller.sessions.last.id, 'ses_41');
      controller.setSearch('Older unique chat');
      await Future<void>.delayed(const Duration(milliseconds: 350));
      expect(api.lastSearch, 'Older unique chat');
      expect(controller.visibleSessions.single.id, 'ses_41');
      controller.dispose();
      await api.stream.close();
    },
  );
}

class PagedApi extends FakeApi {
  PagedApi() : super('pc_one');
  String? lastSearch;
  @override
  Future<Map<String, dynamic>> sessionPage({
    String? cursor,
    String? search,
  }) async {
    lastSearch = search;
    return {
      'data': cursor != null || search == 'Older unique chat'
          ? [
              {'id': 'ses_41', 'title': 'Older unique chat'},
            ]
          : List.generate(40, (i) => {'id': 'ses_$i', 'title': 'Chat $i'}),
      'cursor': {
        'next': cursor == null && (search?.isEmpty ?? true) ? 'page_two' : null,
      },
    };
  }
}

class DelayedCancelApi extends FakeApi {
  DelayedCancelApi() : super('pc_one');
  Completer<void>? cancellation;
  late final durable = StreamController<Map<String, dynamic>>(
    onCancel: () => cancellation?.future,
  );
  int listens = 0;
  @override
  Stream<Map<String, dynamic>> events(String session, {int after = 0}) =>
      listens++ == 0 ? durable.stream : stream.stream;
}

class DelayedPageApi extends FakeApi {
  DelayedPageApi() : super('pc_one');
  Completer<Map<String, dynamic>>? page;
  @override
  Future<Map<String, dynamic>> sessionPage({String? cursor, String? search}) =>
      page?.future ?? super.sessionPage(cursor: cursor, search: search);
}

class RecoveringApi extends FakeApi {
  RecoveringApi() : super('pc_one');
  bool unavailable = true;
  int failureStatus = 0, healthRequests = 0;
  @override
  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    if (path.endsWith('health')) {
      healthRequests++;
      if (unavailable) {
        throw ApiException(failureStatus, 'Computer temporarily unavailable');
      }
    }
    return super.request(method, path, body: body, query: query);
  }
}
