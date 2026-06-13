import fs from "node:fs";
import { PNG } from "pngjs";
for (const s of ["francais", "histoire", "svt", "anglais", "maths", "geographie"]) {
  const png = PNG.sync.read(fs.readFileSync(`src/assets/board/disc-${s}.png`));
  const { width: w, height: h, data } = png;
  // moyenne d'un carre 14x14 au centre du disque
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = (h >> 1) - 7; y < (h >> 1) + 7; y++) {
    for (let x = (w >> 1) - 7; x < (w >> 1) + 7; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 200) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    }
  }
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, "0");
  console.log(`${s}: #${hex(r)}${hex(g)}${hex(b)}`);
}
