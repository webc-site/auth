export default {
  entry: [
    "gen.js",
    "tran.js",
    "src/srv.js",
    "src/*/init.js",
    "src/*/url.js",
    "src/*/url/*.js",
    "src/lib/**/*.js",
    "src/*/test/*.test.js",
    "docker/**/*.js",
    "demo/**/*.js",
    "api/js/**/*.js",
    "api/js/**/*.d.ts",
    "src/*/i18n/**/*.js"
  ],
  ignore: ["conf.example/**"],

  rules: {
    unresolved: "off"
  }
};
