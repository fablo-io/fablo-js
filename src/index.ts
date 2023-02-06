import { execSync } from "child_process";
import * as path from "path";
import { promises as fs, existsSync } from "fs";
import { FabloConfigJson as FabloConfig } from "./FabloConfigJson";

export { FabloConfig };

const fabloScriptRaw = fs.readFile(require.resolve("../bin/fablo"));
const defaultConfigPath = require.resolve("../bin/fablo-config.json");
const defaultDirectory = path.resolve(".");

function exec(cwd: string, file: string, params: string[]): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const cmd = `"${path.resolve(cwd, file)}" ${params.map((p) => `"${p}"`).join(" ")}`;
      resolve(execSync(cmd, { stdio: "inherit", cwd }));
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
  config: string | FabloConfig,
  overrideFn?: (_: FabloConfig) => FabloConfig,
): Promise<void> {
  const targetConfigPath = path.resolve(directory, "fablo-config.json");

  if (typeof config === "string") {
    return fs
      .readFile(path.resolve(directory, config), "utf8")
      .then((raw) => JSON.parse(raw) as FabloConfig)
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
  private fabloConfig: string | FabloConfig | undefined;

  private constructor(directory: string) {
    this.directory = directory;
    this.inProgress = useDirectory(directory);
  }

  public config(config: string | FabloConfig, overrideFn?: (_: FabloConfig) => FabloConfig): Fablo {
    this.fabloConfig = config;
    this.inProgress = this.inProgress.then(() => useFabloConfig(this.directory, config, overrideFn));
    return this;
  }

  public defaultConfig(overrideFn?: (_: FabloConfig) => FabloConfig): Fablo {
    const fullFabloConfigPath = path.resolve(this.directory, "fablo-config.json");

    // File does not exist, or if we want to override some values
    if (!existsSync(fullFabloConfigPath) || overrideFn) {
      return this.config(defaultConfigPath, overrideFn);
    }

    // File exists and we don't want to override it
    else {
      if (!this.fabloConfig) {
        this.fabloConfig = fullFabloConfigPath;
      }
      return this;
    }
  }

  public then(fn: () => void | Promise<void>): Fablo {
    this.inProgress = this.inProgress.then(fn);
    return this;
  }

  public execute(...command: string[]): Promise<Buffer> {
    if (this.fabloConfig === undefined) {
      return this.defaultConfig().execute(...command);
    } else {
      return this.inProgress.then(() => executeFabloCommand(this.directory, ...command));
    }
  }

  public static directory(directory: string): Fablo {
    return new Fablo(directory);
  }

  public static config(config: string | FabloConfig, overrideFn?: (_: FabloConfig) => FabloConfig): Fablo {
    return Fablo.directory(defaultDirectory).config(config, overrideFn);
  }

  public static defaultConfig(overrideFn?: (_: FabloConfig) => FabloConfig): Fablo {
    return Fablo.directory(defaultDirectory).defaultConfig(overrideFn);
  }

  public static then(fn: () => void | Promise<void>): Fablo {
    return Fablo.directory(defaultDirectory).then(fn);
  }
}
