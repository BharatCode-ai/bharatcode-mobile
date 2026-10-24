const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  {
    ignores: [
      "desktop-connector/**",
      "vendor/**",
      "desktop-integration/**",
      ".superpowers/**",
      ".local/**",
      ".dart_tool/**",
      "build/**",
      "coverage/**",
      ".expo/**",
      "dist/**",
      "android/**",
      "ios/**",
    ],
  },
]);
