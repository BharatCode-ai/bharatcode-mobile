import 'dart:convert';

Uri openTunnelOrigin(String value) {
  final uri = Uri.tryParse(value);
  if (uri == null ||
      uri.scheme != 'https' ||
      !uri.host.endsWith('.opentunnel.xyz') ||
      uri.host == 'opentunnel.xyz' ||
      uri.userInfo.isNotEmpty ||
      (uri.hasPort && uri.port != 443) ||
      (uri.path.isNotEmpty && uri.path != '/') ||
      uri.hasQuery ||
      uri.hasFragment) {
    throw const FormatException('Scan a valid BharatCode Desktop pairing QR.');
  }
  return Uri.parse('https://${uri.host}');
}

class PairingPayload {
  final Uri origin;
  final String desktopID;
  final String code;
  final DateTime expiresAt;
  const PairingPayload(this.origin, this.desktopID, this.code, this.expiresAt);

  factory PairingPayload.parse(String text, {DateTime? now}) {
    try {
      final data = jsonDecode(text) as Map<String, dynamic>;
      final origin = openTunnelOrigin(data['origin'] as String);
      final desktop = data['desktopID'] as String;
      final code = data['code'] as String;
      final expires = DateTime.fromMillisecondsSinceEpoch(
        data['expiresAt'] as int,
      );
      final current = now ?? DateTime.now();
      if (data['v'] != 1 ||
          !RegExp(r'^pc_[A-Za-z0-9_-]+$').hasMatch(desktop) ||
          !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(code) ||
          !expires.isAfter(current) ||
          expires.difference(current) > const Duration(minutes: 6)) {
        throw const FormatException(
          'Pairing code has expired. Refresh it on Desktop.',
        );
      }
      return PairingPayload(origin, desktop, code, expires);
    } on FormatException {
      rethrow;
    } catch (_) {
      throw const FormatException('This QR is not a BharatCode pairing code.');
    }
  }
}
