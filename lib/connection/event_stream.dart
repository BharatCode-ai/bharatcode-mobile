import 'dart:convert';

Stream<Map<String, dynamic>> decodeEvents(Stream<List<int>> bytes) async* {
  final data = <String>[];
  var size = 0;
  await for (final line
      in bytes
          .cast<List<int>>()
          .transform(utf8.decoder)
          .transform(const LineSplitter())) {
    if (line.isEmpty) {
      if (data.isNotEmpty) {
        final value = jsonDecode(data.join('\n'));
        if (value is Map<String, dynamic>) yield value;
      }
      data.clear();
      size = 0;
    } else if (line.startsWith('data:')) {
      final value = line.substring(5).replaceFirst(RegExp(r'^ '), '');
      size += value.length;
      if (size > 1048576) {
        throw const FormatException('Event exceeds supported size');
      }
      data.add(value);
    }
  }
}
