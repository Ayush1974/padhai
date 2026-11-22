import test from "node:test";
import assert from "node:assert/strict";
import { isOfficialUrl, outlineFromText } from "./syllabus.mjs";

test("official importer rejects private, spoofed, and non-HTTPS destinations", () => {
  assert.equal(isOfficialUrl("https://jeemain.nta.nic.in/documents/"), true);
  for (const url of [
    "http://jeemain.nta.nic.in/",
    "https://jeemain.nta.nic.in.evil.example/",
    "https://127.0.0.1/",
    "https://user:pass@jeemain.nta.nic.in/",
    "file:///etc/passwd",
    "https://jeemain.nta.nic.in:8443/",
  ])
    assert.equal(isOfficialUrl(url), false);
});

test("syllabus extraction keeps subjects and units and removes exact duplicates", () => {
  const outline = outlineFromText(
    "PHYSICS\nUNIT 1: KINEMATICS\nUNIT 1: KINEMATICS\nCHEMISTRY\nUNIT 2: ATOMIC STRUCTURE",
  );
  assert.deepEqual(outline, [
    { name: "PHYSICS", topics: ["KINEMATICS"] },
    { name: "CHEMISTRY", topics: ["ATOMIC STRUCTURE"] },
  ]);
});
