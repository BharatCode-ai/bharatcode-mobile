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
  Future<void> saveDraft(String device, String session, String draft) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('draft.$device.$session', draft);
  }

  Future<String> draft(String device, String session) async =>
      (await SharedPreferences.getInstance()).getString(
        'draft.$device.$session',
      ) ??
      '';
  Future<void> clearDevice(String device) async {
    final prefs = await SharedPreferences.getInstance();
    for (final key in prefs.getKeys().where(
      (k) =>
          k.startsWith('draft.$device.') ||
          k.startsWith('cache.$device.') ||
          k.startsWith('pending.$device.'),
    )) {
      await prefs.remove(key);
    }
  }

  Future<Map<String, dynamic>?> pending(String device, String session) async {
    final value = (await SharedPreferences.getInstance()).getString(
      'pending.$device.$session',
    );
    return value == null ? null : Map<String, dynamic>.from(jsonDecode(value));
  }

  Future<void> savePending(
    String device,
    String session,
    Map<String, dynamic>? value,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    if (value == null) {
      await prefs.remove('pending.$device.$session');
    } else {
      await prefs.setString('pending.$device.$session', jsonEncode(value));
    }
  }
}
