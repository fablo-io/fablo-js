import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { FabloConfigJson as Config } from "./FabloConfigJson";

const defaultFabloScriptPath = path.resolve("../bin/fablo");
const defaultConfigPath = path.resolve("../bin/fablo-config.json");
const defaultDirectory = path.resolve(".");

function exec(cmd: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      resolve(execSync(cmd, { stdio: "inherit" }));
    } catch (e) {
      reject(e);
    }
  });
}

export async function useDirectory(directory: string): Promise<void> {
  const dir = path.resolve(directory);
  const cmd = `cp "${defaultFabloScriptPath}" "${dir}"`;
  await exec(cmd);
}

export async function useFabloConfig(
  directory: string,
  config: string | Config,
  overrideFn?: (_: Config) => Config,
): Promise<void> {
  const targetConfigPath = path.resolve(directory, "fablo-config.json");

  if (typeof config === "string") {
    const raw = fs.readFileSync(path.resolve(config), "utf8");
    const obj = JSON.parse(raw) as Config;
    const updated = typeof overrideFn === "function" ? overrideFn(obj) : obj;
    fs.writeFileSync(targetConfigPath, JSON.stringify(updated, undefined, 2));
  } else {
    const updated = typeof overrideFn === "function" ? overrideFn(config) : config;
    fs.writeFileSync(targetConfigPath, JSON.stringify(updated, undefined, 2));
  }
}

export function executeFabloCommand(directory: string, fabloCommand: string): Promise<Buffer> {
  const dir = path.resolve(directory);
  const fabloScript = path.resolve(dir, "fablo");
  const cmd = `(cd "${dir}" && "${fabloScript}" ${fabloCommand})`;
  return exec(cmd);
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

  public execute(command: string): Promise<Buffer> {
    if (this.fabloConfig === undefined) {
      return this.config(defaultConfigPath).execute(command);
    } else {
      return executeFabloCommand(this.directory, command);
    }
  }

  public static directory(directory: string): Fablo {
    return new Fablo(directory);
  }

  public static config(config: string | Config, overrideFn?: (_: Config) => Config): Fablo {
    return Fablo.directory(defaultDirectory).config(config, overrideFn);
  }
}
