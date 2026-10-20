class DesktopDevice {
  final String id, name, platform, origin, token, credentialID;
  final bool connected;
  const DesktopDevice({
    required this.id,
    required this.name,
    this.platform = 'Computer',
    required this.origin,
    required this.token,
    this.credentialID = '',
    this.connected = false,
  });
  factory DesktopDevice.fromJson(Map<String, dynamic> json) => DesktopDevice(
    id: json['id'] as String,
    name: json['name'] as String,
    platform: json['platform'] as String? ?? 'Computer',
    origin: json['origin'] as String,
    token: json['token'] as String,
    credentialID: json['credentialID'] as String? ?? '',
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'platform': platform,
    'origin': origin,
    'token': token,
    'credentialID': credentialID,
  };
}

class SessionSummary {
  final String id, title, project, directory, status;
  final DateTime updated;
  const SessionSummary({
    required this.id,
    required this.title,
    required this.project,
    this.directory = '',
    this.status = 'idle',
    required this.updated,
  });
  factory SessionSummary.fromJson(Map<String, dynamic> json) {
    final directory = (json['location'] as Map?)?['directory'] as String? ?? '';
    final raw = (json['time'] as Map?)?['updated'];
    return SessionSummary(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'New chat',
      project:
          directory.split('/').where((e) => e.isNotEmpty).lastOrNull ??
          json['projectID'] as String? ??
          'Project',
      directory: directory,
      updated: raw is num
          ? DateTime.fromMillisecondsSinceEpoch(raw.toInt())
          : DateTime.tryParse('$raw') ?? DateTime.now(),
    );
  }
}

class ToolActivity {
  final String name, status, input, output;
  const ToolActivity(this.name, this.status, this.input, this.output);
  factory ToolActivity.fromJson(Map<String, dynamic> json) {
    final state = json['state'] as Map? ?? {};
    return ToolActivity(
      json['name'] as String? ?? 'Tool',
      state['status'] as String? ?? 'pending',
      '${state['input'] ?? ''}',
      '${state['content'] ?? ''}',
    );
  }
}

class ChatMessage {
  final String id, role, text;
  final List<ToolActivity> tools;
  const ChatMessage({
    required this.id,
    required this.role,
    required this.text,
    this.tools = const [],
  });
  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final content = (json['content'] as List? ?? []).whereType<Map>().toList();
    return ChatMessage(
      id: json['id'] as String,
      role: json['type'] as String? ?? 'assistant',
      text:
          json['text'] as String? ??
          content
              .where((c) => c['type'] == 'text')
              .map((c) => c['text'] as String? ?? '')
              .join('\n\n'),
      tools: content
          .where((c) => c['type'] == 'tool')
          .map((c) => ToolActivity.fromJson(Map<String, dynamic>.from(c)))
          .toList(),
    );
  }
}

class AgentRequest {
  final String id, sessionID, title, command, directory;
  final bool question;
  final Map<String, dynamic> raw;
  const AgentRequest({
    required this.id,
    required this.sessionID,
    required this.title,
    this.command = '',
    this.directory = '',
    this.question = false,
    this.raw = const {},
  });
}
