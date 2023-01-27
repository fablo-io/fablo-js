import { execSync } from "child_process";
import * as path from "path";
import { promises as fs } from "fs";
import { FabloConfigJson as Config } from "./FabloConfigJson";

const fabloScriptRaw = fs.readFile(require.resolve("../bin/fablo"));
const defaultConfigPath = require.resolve("../bin/fablo-config.json");
const defaultDirectory = path.resolve(".");

function exec(cwd: string, file: string, params: string[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      resolve(
        execFileSync(path.resolve(cwd, file), params, {
          stdio: "inherit",
          shell: true,
          cwd,
        }),
      );
    } catch (e) {
      reject(e);
    }
  });
}

export function useDirectory(directory: string): Promise<void> {
  const target = path.resolve(directory, "fablo");
  return fabloScriptRaw.then((buffer) => fs.writeFile(target, buffer, { mode: 0o755 }));
}

export function useFabloConfig(
  directory: string,
  config: string | Config,
  overrideFn?: (_: Config) => Config,
): Promise<void> {
  const targetConfigPath = path.resolve(directory, "fablo-config.json");

  if (typeof config === "string") {
    return fs
      .readFile(path.resolve(config), "utf8")
      .then((raw) => JSON.parse(raw) as Config)
      .then((obj) => useFabloConfig(directory, obj, overrideFn));
  } else {
    const updated = typeof overrideFn === "function" ? overrideFn(config) : config;
    return fs.writeFile(targetConfigPath, JSON.stringify(updated, undefined, 2));
  }
}

export function executeFabloCommand(directory: string, ...fabloCommand: string[]): Promise<Buffer> {
  const dir = path.resolve(directory);
  return exec(dir, "fablo", fabloCommand);
}

export class Fablo {
  private inProgress: Promise<unknown>;
  private directory: string;
  private fabloConfig: string | Config | undefined;

  private constructor(directory: string) {
    this.directory = directory;
    this.inProgress = useDirectory(directory);
  }

  public config(config: string | Config, overrideFn?: (_: Config) => Config): Fablo {
    this.fabloConfig = config;
    this.inProgress = this.inProgress.then(() => useFabloConfig(this.directory, config, overrideFn));
    return this;
  }

  public execute(...command: string[]): Promise<Buffer> {
    if (this.fabloConfig === undefined) {
      return this.config(defaultConfigPath).execute(...command);
    } else {
      return this.inProgress.then(() => executeFabloCommand(this.directory, ...command));
    }
  }

  public static directory(directory: string): Fablo {
    return new Fablo(directory);
  }

  public static config(config: string | Config, overrideFn?: (_: Config) => Config): Fablo {
    return Fablo.directory(defaultDirectory).config(config, overrideFn);
  }
}
