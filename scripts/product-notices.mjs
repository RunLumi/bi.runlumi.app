// Product terms accompany built copies; third-party notice generation stays separate.
import {readFile, writeFile} from 'node:fs/promises';
const sourceRoot = new URL('../', import.meta.url);
export async function writeProductNotices(outputDirectory) {
  for (const [source, target] of [['LICENSE', 'LICENSE.txt'], ['NOTICE', 'NOTICE.txt']]) {
    await writeFile(new URL(target, outputDirectory), await readFile(new URL(source, sourceRoot)));
  }
}
