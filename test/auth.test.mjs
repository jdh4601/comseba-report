import assert from "node:assert/strict";
import { test } from "node:test";

import { checkBasicAuth } from "../lib/auth.mjs";

const header = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
const config = { user: "comseba", password: "1234" };

test("checkBasicAuth_noPasswordConfigured_allowsEveryone", () => {
  assert.equal(checkBasicAuth(undefined, { user: "comseba", password: "" }), true);
});

test("checkBasicAuth_correctCredentials_allows", () => {
  assert.equal(checkBasicAuth(header("comseba", "1234"), config), true);
});

test("checkBasicAuth_wrongOrMissingCredentials_rejects", () => {
  assert.equal(checkBasicAuth(header("comseba", "12345"), config), false);
  assert.equal(checkBasicAuth(header("other", "1234"), config), false);
  assert.equal(checkBasicAuth(undefined, config), false);
  assert.equal(checkBasicAuth("Bearer x", config), false);
});

test("checkBasicAuth_passwordContainingColon_isParsedWhole", () => {
  assert.equal(checkBasicAuth(header("comseba", "a:b"), { user: "comseba", password: "a:b" }), true);
});
