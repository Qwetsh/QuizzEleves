import fs from "node:fs";
import { PNG } from "pngjs";
const png = PNG.sync.read(fs.readFileSync("art/board-sheets/cut-cases/socle-arrivee2-src-r1c1.png"));
const { width: w, height: h, data } = png;
const bg = [46, 84, 58];
for (let p = 0; p < w * h; p++) {
  const i = p * 4;
  const a = data[i + 3] / 255;
  for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * a + bg[c] * (1 - a));
  data[i + 3] = 255;
}
fs.writeFileSync("art/board-sheets/cut-cases/preview-arrivee.png", PNG.sync.write(png));
console.log("ok");
