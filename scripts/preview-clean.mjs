import fs from "node:fs";
import { PNG } from "pngjs";
for (const n of [1, 3, 6]) {
  const png = PNG.sync.read(fs.readFileSync(`art/board-sheets/clean/sheet${n}.png`));
  const { width: w, height: h, data } = png;
  const bg = [46, 84, 58];
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const a = data[i + 3] / 255;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * a + bg[c] * (1 - a));
    data[i + 3] = 255;
  }
  fs.writeFileSync(`art/board-sheets/clean/preview${n}.png`, PNG.sync.write(png));
}
console.log("ok");
