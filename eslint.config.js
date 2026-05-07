module.exports = [
  ...require("eslint-config-next/core-web-vitals"),
  {
    name: "project-overrides",
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
