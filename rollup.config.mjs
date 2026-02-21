import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

const external = [];

export default [
  {
    input: "src/index.ts",
    external,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
      }),
    ],
    output: [
      {
        file: "dist/index.js",
        format: "esm",
        sourcemap: true,
      },
      {
        file: "dist/index.cjs",
        format: "cjs",
        exports: "named",
        sourcemap: true,
      },
    ],
  },
  {
    input: "src/index.ts",
    plugins: [dts()],
    output: {
      file: "dist/index.d.ts",
      format: "es",
    },
  },
];
