import 'dart:convert';
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:bharatcode_mobile/connection/api_client.dart';
import 'package:bharatcode_mobile/connection/pairing_payload.dart';
import 'package:bharatcode_mobile/connection/event_stream.dart';
import 'package:bharatcode_mobile/models/models.dart';
import 'package:bharatcode_mobile/connection/device_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('unconfirmed prompt identity persists across store instances and is isolated by computer', () async {
    SharedPreferences.setMockInitialValues({});
    const first = DeviceStore();
    await first.savePending('pc_one', 'ses_one', {
      'id': 'msg_same',
      'text': 'Run tests',
      'session': 'ses_one',
    });
    const reopened = DeviceStore();
    expect((await reopened.pending('pc_one', 'ses_one'))?['id'], 'msg_same');
    expect(await reopened.pending('pc_two', 'ses_one'), isNull);
    await reopened.clearDevice('pc_one');
    expect(await reopened.pending('pc_one', 'ses_one'), isNull);
  });
  test(
    'admission atomically clears only its draft and survives reopening',
    () async {
      SharedPreferences.setMockInitialValues({});
      const store = DeviceStore();
      await store.saveDraft('pc_one', 'ses_one', 'Run tests');
      await store.savePending('pc_one', 'ses_one', {
        'id': 'msg_one',
        'text': 'Run tests',
      });
      await store.admit('pc_one', 'ses_one', 'msg_one', 'Run tests');
      const reopened = DeviceStore();
      expect(await reopened.draft('pc_one', 'ses_one'), '');
      expect(await reopened.pending('pc_one', 'ses_one'), isNull);
      await reopened.saveDraft('pc_one', 'ses_one', 'Run tests');
      expect(await reopened.draft('pc_one', 'ses_one'), 'Run tests');
      await reopened.saveDraft('pc_one', 'ses_one', 'A new draft');
      await reopened.savePending('pc_one', 'ses_one', {
        'id': 'msg_two',
        'text': 'Run tests',
      });
      await reopened.admit('pc_one', 'ses_one', 'msg_two', 'Run tests');
      expect(await reopened.draft('pc_one', 'ses_one'), 'A new draft');
    },
  );
  final now = DateTime.utc(2026, 10, 20);
  String payload(String origin) => jsonEncode({
    'v': 1,
    'desktopID': 'pc_one',
    'origin': origin,
    'code': 'a' * 43,
    'expiresAt': now.add(const Duration(minutes: 5)).millisecondsSinceEpoch,
  });
  test(
    'pairing accepts only unexpired secret-free HTTPS OpenTunnel origins',
    () {
      expect(
        PairingPayload.parse(
          payload('https://api.one.opentunnel.xyz'),
          now: now,
        ).desktopID,
        'pc_one',
      );
      for (final origin in [
        'http://one.opentunnel.xyz',
        'https://evil.example',
        'https://one.opentunnel.xyz.evil.com',
        'https://user:pass@one.opentunnel.xyz',
        'https://one.opentunnel.xyz/path',
        'https://one.opentunnel.xyz?token=secret',
      ]) {
        expect(
          () => PairingPayload.parse(payload(origin), now: now),
          throwsFormatException,
        );
      }
      expect(
        () => PairingPayload.parse(
          payload('https://one.opentunnel.xyz'),
          now: now.add(const Duration(minutes: 6)),
        ),
        throwsFormatException,
      );
    },
  );
  test(
    'SSE decoder joins split frames, comments, CRLF and multiline data',
    () async {
      final bytes = Stream.fromIterable(
        [
          ': hi\r\nda',
          'ta: {"type":\r\n',
          'data: "updated"}\r\n\r\n',
          'data: {"type":"next"}\n\n',
        ].map(utf8.encode),
      );
      final events = await decodeEvents(bytes).toList();
      expect(events.map((e) => e['type']), ['updated', 'next']);
    },
  );
  test(
    'SSE bounds an unterminated line while the peer keeps streaming',
    () async {
      final source = StreamController<List<int>>();
      final result = decodeEvents(source.stream)
          .toList()
          .timeout(const Duration(milliseconds: 200));
      final assertion = expectLater(result, throwsFormatException);
      source.add(utf8.encode('data: ${'x' * 1048577}'));
      await assertion;
      await source.close();
    },
  );
  test('v2 session and assistant content use real wire fields', () {
    final session = SessionSummary.fromJson({
      'id': 'ses_one',
      'title': 'Fix validation',
      'projectID': 'prj_one',
      'location': {'directory': '/work/storefront'},
      'time': {'updated': 1234},
    });
    expect(session.directory, '/work/storefront');
    final message = ChatMessage.fromJson({
      'id': 'msg_one',
      'type': 'assistant',
      'content': [
        {'type': 'text', 'id': 'txt_one', 'text': 'Done'},
        {
          'type': 'tool',
          'id': 'tool_one',
          'name': 'read',
          'state': {
            'status': 'completed',
            'input': {'file': 'app.ts'},
            'content': [],
          },
        },
      ],
    });
    expect(message.text, 'Done');
    expect(message.tools.single.name, 'read');
  });
  test('API never follows redirects with device credentials', () async {
    final client = ApiClient(
      Uri.parse('https://one.opentunnel.xyz'),
      'device-token',
      client: MockClient((request) async {
        expect(request.followRedirects, isFalse);
        return http.Response(
          '',
          302,
          headers: {'location': 'https://evil.example'},
        );
      }),
    );
    expect(client.sessions(), throwsA(isA<ApiException>()));
  });
  test(
    'prompt admission preserves explicit message ID and exact payload on retry',
    () async {
      final bodies = <String>[];
      final client = ApiClient(
        Uri.parse('https://one.opentunnel.xyz'),
        'token',
        client: MockClient((request) async {
          bodies.add(request.body);
          if (bodies.length == 1) {
            throw http.ClientException('acknowledgement lost');
          }
          return http.Response('{"data":{"id":"input_one"}}', 200);
        }),
      );
      await expectLater(
        client.prompt('ses_one', 'msg_stable', 'Run tests'),
        throwsA(isA<Exception>()),
      );
      await client.prompt('ses_one', 'msg_stable', 'Run tests');
      expect(bodies[0], bodies[1]);
      expect(jsonDecode(bodies[0]), {
        'id': 'msg_stable',
        'prompt': {'text': 'Run tests'},
      });
    },
  );
}
