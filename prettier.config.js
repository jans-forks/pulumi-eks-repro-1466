module.exports = {
  singleQuote: false,
  trailingComma: "es5",
  arrowParens: "always",
  useTabs: false,
  tabWidth: 2,
  semi: true,
  printWidth: 120,
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  importOrder: ["^[a-zA-Z](.*)$", "^@[a-zA-Z](.*)$$", "^[./]"],
  importOrderSeparation: true,
};
