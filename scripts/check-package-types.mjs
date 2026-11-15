import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { log } from "node:console";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";

// Check the published artifact, without the source tree or tsconfig path aliases.
const temporaryDirectory = mkdtempSync(join(tmpdir(), "usgs-lidar-types-"));
try {
  const packResult = JSON.parse(
    execFileSync(
      "npm",
      [
        "pack",
        "--json",
        "--ignore-scripts",
        "--pack-destination",
        temporaryDirectory,
      ],
      {
        encoding: "utf8",
      },
    ),
  );
  const [archive] = Object.values(packResult);
  const packageDirectory = join(
    temporaryDirectory,
    "node_modules",
    "maplibre-gl-usgs-lidar",
  );
  mkdirSync(packageDirectory, { recursive: true });
  execFileSync("tar", [
    "-xzf",
    join(temporaryDirectory, archive.filename),
    "--strip-components=1",
    "-C",
    packageDirectory,
  ]);
  // Supply installed peer dependencies without exposing this repo's source files.
  symlinkSync(
    resolve("node_modules"),
    join(packageDirectory, "node_modules"),
    "dir",
  );

  for (const [extension, module, moduleResolution] of [
    ["ts", ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
    ["mts", ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
    ["cts", ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
  ]) {
    const fixture = join(temporaryDirectory, `consumer.${extension}`);
    writeFileSync(
      fixture,
      `
import { UsgsLidarControl } from 'maplibre-gl-usgs-lidar';
import { UsgsLidarControlReact } from 'maplibre-gl-usgs-lidar/react';
console.log(UsgsLidarControl, UsgsLidarControlReact);
type IsAny<T> = 0 extends 1 & T ? true : false;
const controlIsTyped: IsAny<typeof UsgsLidarControl> = false;
const reactIsTyped: IsAny<typeof UsgsLidarControlReact> = false;
`,
    );
    const program = ts.createProgram([fixture], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2020,
      module,
      moduleResolution,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => temporaryDirectory,
        getNewLine: () => "\n",
      }),
    );
    log(
      `Package declarations resolve for ${ts.ModuleResolutionKind[moduleResolution]} (.${extension})`,
    );
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
