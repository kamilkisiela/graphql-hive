import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';

export const graphqlEndpoint = 'https://app.graphql-hive.com/graphql';

export class Config<TValue = any> {
  private cache?: Record<string, TValue>;
  private filepath: string;

  constructor({ filepath, rootDir }: { filepath?: string; rootDir: string }) {
    if (filepath) {
      this.filepath = filepath;
    } else {
      this.filepath = path.join(rootDir, 'hive.json');
    }
  }

  has(key: string) {
    const map = this.read();

    return typeof map[key] !== 'undefined' && map[key] !== null;
  }

  get(key: string) {
    const map = this.read();

    return map[key];
  }

  set(key: string, value: TValue) {
    const map = this.read();

    map[key] = value;

    this.write(map);
  }

  delete(key: string) {
    if (this.has(key)) {
      const map = this.read();
      delete map[key];
      this.write(map);
    }
  }

  clear(): void {
    try {
      mkdirp.sync(path.dirname(this.filepath));
    } catch (e) {}
    fs.writeFileSync(this.filepath, JSON.stringify({}));
  }

  private readSpace(content: Record<string, any>) {
    // eslint-disable-next-line no-process-env
    const space = process.env.HIVE_SPACE;

    if (space) {
      return content[space];
    }

    if ('default' in content) {
      return content['default'];
    }

    return content;
  }

  private read() {
    try {
      if (!this.cache) {
        this.cache = this.readSpace(JSON.parse(fs.readFileSync(this.filepath, 'utf-8')));
      }
    } catch (error) {
      this.cache = {};
    }

    return this.cache!;
  }

  private write(map: Record<string, TValue>) {
    this.cache = map;
    try {
      mkdirp.sync(path.dirname(this.filepath));
    } catch (e) {}
    fs.writeFileSync(this.filepath, JSON.stringify(this.cache));
  }
}
