import * as fs from "fs";
import * as path from "path";
import { Fablo } from "./";

let workdir: string;
let fablo: Fablo;

beforeAll(() => {
  workdir = process.env.FABLO_TEST_DIR ?? "/tmp";
  fablo = Fablo.directory(workdir);
});

afterAll(async () => {
  await fablo.execute("prune");
});

it("should start default network", async () => {
  // Given
  const snapshotName = `snap-${new Date().getTime()}`;

  // When
  await fablo.execute("up");
  await fablo.execute("snapshot", snapshotName);

  // Then
  const snapshotExists = fs.existsSync(path.resolve(workdir, `${snapshotName}.fablo.tar.gz`));
  expect(snapshotExists).toEqual(true);
});
