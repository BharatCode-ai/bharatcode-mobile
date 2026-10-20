import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/models.dart';
import 'event_stream.dart';
import 'pairing_payload.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  const ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class ApiClient {
  final Uri origin;
  final String token;
  final http.Client _client;
  ApiClient(Uri origin, this.token, {http.Client? client})
    : origin = openTunnelOrigin(origin.toString()),
      _client = client ?? http.Client();

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    final response = await _send(
      method,
      path,
      body: body,
      query: query,
    ).timeout(const Duration(seconds: 20));
    final chunks = <int>[];
    await for (final chunk in response.stream.timeout(
      const Duration(seconds: 20),
    )) {
      chunks.addAll(chunk);
      if (chunks.length > 16777216) {
        throw const ApiException(
          413,
          'Response is too large. Try a smaller page.',
        );
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        response.statusCode,
        response.statusCode == 401
            ? 'This phone is no longer authorized. Pair again.'
            : response.statusCode == 404
            ? 'This feature is unavailable on your Desktop version.'
            : 'The computer could not complete that request (${response.statusCode}).',
      );
    }
    if (chunks.isEmpty) return {};
    final value = jsonDecode(utf8.decode(chunks));
    if (value is! Map<String, dynamic>) {
      throw const FormatException('Unexpected server response');
    }
    return value;
  }

  Future<http.StreamedResponse> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) {
    if (!path.startsWith('/') ||
        path.startsWith('//') ||
        path.contains('://')) {
      throw const FormatException('Invalid API path');
    }
    final uri = origin.replace(path: path, queryParameters: query);
    final request = http.Request(method, uri)..followRedirects = false;
    request.headers['accept'] = 'application/json';
    if (token.isNotEmpty) request.headers['authorization'] = 'Bearer $token';
    if (body != null) {
      request.headers['content-type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    return _client.send(request);
  }

  Future<List<SessionSummary>> sessions({
    String? cursor,
    String? search,
  }) async {
    final value = await request(
      'GET',
      '/api/session',
      query: {
        'limit': '40',
        'cursor': ?cursor,
        if (search?.isNotEmpty ?? false) 'search': search!,
      },
    );
    return (value['data'] as List)
        .map((e) => SessionSummary.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Map<String, dynamic>> messagePage(String session, {String? cursor}) =>
      request(
        'GET',
        '/api/session/${Uri.encodeComponent(session)}/message',
        query: {
          'limit': '50',
          if (cursor == null) 'order': 'desc',
          'cursor': ?cursor,
        },
      );
  Future<void> prompt(String session, String id, String text) async {
    await request(
      'POST',
      '/api/session/${Uri.encodeComponent(session)}/prompt',
      body: {
        'id': id,
        'prompt': {'text': text},
      },
    );
  }

  Future<void> interrupt(String session) async {
    await request(
      'POST',
      '/api/session/${Uri.encodeComponent(session)}/interrupt',
    );
  }

  Stream<Map<String, dynamic>> events(String session, {int after = 0}) async* {
    final response = await _send(
      'GET',
      '/api/session/${Uri.encodeComponent(session)}/event',
      query: {'after': '$after'},
    ).timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      await response.stream.drain();
      throw ApiException(
        response.statusCode,
        'Could not reconnect to this conversation.',
      );
    }
    yield* decodeEvents(response.stream.timeout(const Duration(seconds: 45)));
  }

  void close() => _client.close();
}
