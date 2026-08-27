// Точний експорт канонічного SVG: геометрія та кольори не змінюються.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [require.resolve("next")] }));
const publicDirectory = new URL("../../public/", import.meta.url);
const svg = await readFile(new URL("icon.svg", publicDirectory));
const checkOnly = process.argv.includes("--check");
const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map((size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()),
);

// ICO-контейнер містить PNG-зображення для кожного стандартного розміру.
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let imageOffset = directory.length;
sizes.forEach((size, index) => {
  const entryOffset = 6 + index * 16;
  directory.writeUInt8(size, entryOffset);
  directory.writeUInt8(size, entryOffset + 1);
  directory.writeUInt16LE(1, entryOffset + 4);
  directory.writeUInt16LE(32, entryOffset + 6);
  directory.writeUInt32LE(images[index].length, entryOffset + 8);
  directory.writeUInt32LE(imageOffset, entryOffset + 12);
  imageOffset += images[index].length;
});

const apple = await sharp(svg, { density: 384 })
  .resize(180, 180)
  .flatten({ background: "#F5F2EB" })
  .png()
  .toBuffer();
const outputs = [
  ["favicon.ico", Buffer.concat([directory, ...images])],
  ["icon-light-32x32.png", images[1]],
  ["icon-dark-32x32.png", images[1]],
  ["apple-icon.png", apple],
];

for (const [name, bytes] of outputs) {
  const target = new URL(name, publicDirectory);
  if (checkOnly) {
    const current = await readFile(target);
    if (!current.equals(bytes)) {
      throw new Error(`${name} не відповідає public/icon.svg. Запустіть pnpm icons:generate.`);
    }
  } else {
    await writeFile(target, bytes);
  }
  console.log(`${checkOnly ? "Verified" : "Generated"}: ${fileURLToPath(target)}`);
}
