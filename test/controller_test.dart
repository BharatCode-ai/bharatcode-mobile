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
  int messageReads = 0;
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
    return {'data': []};
  }

  @override
  Stream<Map<String, dynamic>> events(String session, {int after = 0}) =>
      stream.stream;
  @override
  Future<void> prompt(String session, String id, String text) async {
    sent.add('$session/$id/$text');
  }

  @override
  void close() {} // Controlled stream remains available until test teardown.
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
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
