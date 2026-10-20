import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';

class DeviceStore {
  final FlutterSecureStorage secure;
  const DeviceStore({this.secure = const FlutterSecureStorage()});
  Future<List<DesktopDevice>> load() async {
    final value = await secure.read(key: 'bharatcode.paired-devices.v1');
    if (value == null) return [];
    return (jsonDecode(value) as List)
        .map((e) => DesktopDevice.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> save(List<DesktopDevice> devices) => secure.write(
    key: 'bharatcode.paired-devices.v1',
    value: jsonEncode(devices.map((d) => d.toJson()).toList()),
  );
  // Serialize updates to one conversation so an in-flight draft write cannot
  // overwrite an admitted outbox. Draft and admission share one atomic value.
  static final Map<String, Future<void>> _writes = {};
  String _key(String device, String session) => 'conversation.$device.$session';
  Map<String, dynamic> _read(
    SharedPreferences prefs,
    String device,
    String session,
  ) {
    final value = prefs.getString(_key(device, session));
    if (value != null) return Map<String, dynamic>.from(jsonDecode(value));
    final pending = prefs.getString('pending.$device.$session');
    return {
      'draft': prefs.getString('draft.$device.$session') ?? '',
      if (pending != null) 'outbox': jsonDecode(pending),
    };
  }

  Future<void> _update(
    String device,
    String session,
    void Function(Map<String, dynamic>) update,
  ) {
    final key = _key(device, session);
    final previous = _writes[key] ?? Future<void>.value();
    final next = previous.catchError((Object _) {}).then((_) async {
      final prefs = await SharedPreferences.getInstance();
      final value = _read(prefs, device, session);
      update(value);
      if (!await prefs.setString(key, jsonEncode(value))) {
        throw StateError('Conversation could not be saved');
      }
    });
    _writes[key] = next;
    next.then(
      (_) {
        if (identical(_writes[key], next)) _writes.remove(key);
      },
      onError: (Object _, StackTrace _) {
        if (identical(_writes[key], next)) _writes.remove(key);
      },
    );
    return next;
  }

  Future<void> saveDraft(String device, String session, String draft) =>
      _update(device, session, (value) => value['draft'] = draft);

  Future<String> draft(String device, String session) async {
    await _writes[_key(device, session)];
    return _read(
              await SharedPreferences.getInstance(),
              device,
              session,
            )['draft']
            as String? ??
        '';
  }

  Future<Map<String, dynamic>?> pending(String device, String session) async {
    await _writes[_key(device, session)];
    final value = _read(
      await SharedPreferences.getInstance(),
      device,
      session,
    )['outbox'];
    if (value == null || value['state'] == 'admitted') return null;
    return Map<String, dynamic>.from(value);
  }

  Future<void> savePending(
    String device,
    String session,
    Map<String, dynamic>? pending,
  ) => _update(device, session, (value) => value['outbox'] = pending);

  Future<void> admit(String device, String session, String id, String text) =>
      _update(device, session, (value) {
        if (value['outbox']?['id'] != id) {
          throw StateError('Outbox identity changed');
        }
        value['outbox'] = {'id': id, 'state': 'admitted'};
        if ((value['draft'] as String? ?? '').trim() == text) {
          value['draft'] = '';
        }
      });

  Future<Map<String, dynamic>?> cache(String device, String session) async {
    final value = (await SharedPreferences.getInstance()).getString(
      'cache.$device.$session',
    );
    return value == null ? null : Map<String, dynamic>.from(jsonDecode(value));
  }

  Future<void> saveCache(
    String device,
    String session,
    Map<String, dynamic> value,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    if (!await prefs.setString('cache.$device.$session', jsonEncode(value))) {
      throw StateError('Cache could not be saved');
    }
  }

  Future<void> clearDevice(String device) async {
    await Future.wait(
      _writes.entries
          .where((e) => e.key.startsWith('conversation.$device.'))
          .map((e) => e.value),
    );
    final prefs = await SharedPreferences.getInstance();
    for (final key in prefs.getKeys().where(
      (k) =>
          k.startsWith('conversation.$device.') ||
          k.startsWith('draft.$device.') ||
          k.startsWith('cache.$device.') ||
          k.startsWith('pending.$device.'),
    )) {
      await prefs.remove(key);
    }
  }
}
