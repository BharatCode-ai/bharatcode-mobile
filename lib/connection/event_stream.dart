import 'dart:convert';

Stream<Map<String, dynamic>> decodeEvents(Stream<List<int>> bytes) async* {
  final data = <String>[];
  var size = 0, buffer = '';
  await for (final chunk in bytes.cast<List<int>>().transform(utf8.decoder)) {
    buffer += chunk;
    var end = buffer.indexOf('\n');
    while (end >= 0) {
      var line = buffer.substring(0, end);
      buffer = buffer.substring(end + 1);
      if (line.endsWith('\r')) line = line.substring(0, line.length - 1);
      size += line.length;
      if (size > 1048576) {
        throw const FormatException('Event exceeds supported size');
      }
      if (line.isEmpty) {
        if (data.isNotEmpty) {
          final value = jsonDecode(data.join('\n'));
          if (value is Map<String, dynamic>) yield value;
        }
        data.clear();
        size = 0;
      } else if (line.startsWith('data:')) {
        data.add(line.substring(5).replaceFirst(RegExp(r'^ '), ''));
      }
      end = buffer.indexOf('\n');
    }
    if (size + buffer.length > 1048576) {
      throw const FormatException('Event exceeds supported size');
    }
  }
}
