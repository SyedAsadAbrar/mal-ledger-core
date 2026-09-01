import assert from "node:assert/strict";
import test from "node:test";

import { projectName } from "../src/scaffold.js";

test("the TypeScript test setup is operational", () => {
  assert.equal(projectName, "mal-ledger-core");
});
