import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

abstract final class BC {
  static const canvas = Color(0xFF181817),
      surface = Color(0xFF242422),
      raised = Color(0xFF2D2D29);
  static const text = Color(0xFFF2F0E9),
      muted = Color(0xFFB9B9B0),
      faint = Color(0xFF85857D);
  static const orange = Color(0xFFFF6933),
      green = Color(0xFF6DDC91),
      border = Color(0xFF393936);
  static ThemeData theme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme =
        ColorScheme.fromSeed(
          seedColor: orange,
          brightness: brightness,
        ).copyWith(
          primary: orange,
          onPrimary: const Color(0xFF26160E),
          surface: dark ? canvas : const Color(0xFFFAFAF7),
          onSurface: dark ? text : const Color(0xFF232322),
          outline: dark ? border : const Color(0xFFDDDDD6),
        );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: brightness,
      fontFamily: 'Inter',
      scaffoldBackgroundColor: scheme.surface,
      textTheme: Typography.material2021(platform: TargetPlatform.android).black
          .apply(
            fontFamily: 'Inter',
            bodyColor: scheme.onSurface,
            displayColor: scheme.onSurface,
          )
          .copyWith(
            bodyMedium: TextStyle(
              fontFamily: 'Inter',
              fontSize: 15,
              height: 1.6,
              color: scheme.onSurface,
            ),
            bodyLarge: TextStyle(
              fontFamily: 'Inter',
              fontSize: 16,
              height: 1.55,
              color: scheme.onSurface,
            ),
          ),
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
      ),
      dividerTheme: DividerThemeData(
        color: scheme.outline.withValues(alpha: .7),
        thickness: .7,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? surface : Colors.white,
        hintStyle: const TextStyle(color: faint),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: scheme.onSurface,
          minimumSize: const Size(48, 48),
          side: BorderSide(color: scheme.outline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(13),
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 76,
        backgroundColor: scheme.surface,
        indicatorColor: orange.withValues(alpha: .12),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => TextStyle(
            fontFamily: 'Inter',
            fontSize: 11,
            color: s.contains(WidgetState.selected)
                ? orange
                : (dark ? muted : Colors.grey.shade700),
          ),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: dark ? surface : Colors.white,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
    );
  }
}

class BrandMark extends StatelessWidget {
  final double size;
  const BrandMark({super.key, this.size = 36});
  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/brand/mark.svg',
    width: size,
    height: size,
    semanticsLabel: 'BharatCode',
  );
}

class StatusDot extends StatelessWidget {
  final bool online;
  const StatusDot({super.key, required this.online});
  @override
  Widget build(BuildContext context) => Container(
    width: 7,
    height: 7,
    decoration: BoxDecoration(
      color: online ? BC.green : BC.faint,
      shape: BoxShape.circle,
    ),
  );
}

class PreviewNotice extends StatelessWidget {
  const PreviewNotice({super.key});
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 7),
    color: BC.orange.withValues(alpha: .08),
    child: const Row(
      children: [
        Icon(Icons.science_outlined, size: 14, color: BC.orange),
        SizedBox(width: 8),
        Expanded(
          child: Text(
            'Preview workspace',
            style: TextStyle(
              color: BC.orange,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Text('Sample data', style: TextStyle(color: BC.muted, fontSize: 11)),
      ],
    ),
  );
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title, message;
  final Widget? action;
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: BC.muted, size: 36),
          const SizedBox(height: 20),
          Text(
            title,
            style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: BC.muted),
          ),
          if (action != null) ...[const SizedBox(height: 24), action!],
        ],
      ),
    ),
  );
}
