import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
const directory = join(import.meta.dir, '../public/guess-who');
for (const filename of await readdir(directory)) {
    if (!filename.endsWith('.source')) continue;
    const path = join(directory, filename);
    await writeFile(path.replace(/\.source$/, '.webp'), await sharp(await readFile(path)).rotate().resize(320, 320, { fit: 'cover', position: 'north' }).webp({ quality: 82 }).toBuffer());
    await unlink(path);
}
