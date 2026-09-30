import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  AOSP_UPSTREAM,
  DEPENDENCY_LEDGER,
  assessAospHost,
  buildJMControlPlane,
  createAospExecutionPlan,
  evaluateAospContactReceipt,
  renderAospBuildScript,
  renderAospCompileScript,
  renderAospBootScript
} from './jm-aosp-bridge.mjs';
import { stageJMProduct } from './install-jm-aosp-product.mjs';

let pass = 0;
const test = (name, fn) => {
  fn();
  pass += 1;
  console.log('PASS', String(pass).padStart(2, '0'), name);
};

const readyHost = {
  os: 'linux',
  arch: 'x86_64',
  freeDiskGB: 500,
  ramGB: 64,
  glibcVersion: '2.39',
  repoAvailable: true,
  repoVersion: '2.45',
  nodeAvailable: true,
  nodeVersion: process.version
};

const blockedHost = {
  ...readyHost,
  freeDiskGB: 54,
  ramGB: 32
};

function buildEvidence(extra = {}) {
  return {
    buildExitCode: 0,
    systemImageObserved: true,
    branch: AOSP_UPSTREAM.branch,
    target: AOSP_UPSTREAM.target,
    manifestRevision: 'platform/build@deadbeef',
    jmProductMarkerObserved: true,
    ...extra
  };
}

test('AOSP route uses current android-latest-release alias', () => {
  assert.equal(AOSP_UPSTREAM.branch, 'android-latest-release');
});

test('declared upstream base target remains current Cuttlefish x86_64-only phone', () => {
  assert.equal(AOSP_UPSTREAM.baseTarget, 'aosp_cf_x86_64_only_phone-aosp_current-userdebug');
});

test('heavy route now targets the JM-derived Cuttlefish product', () => {
  assert.equal(AOSP_UPSTREAM.target, 'jm_cf_x86_64_phone-aosp_current-userdebug');
});

test('dependency ledger keeps AOSP as declared upstream, not JM authorship', () => {
  assert.equal(DEPENDENCY_LEDGER.find(x => x.id === 'aosp-source')?.class, 'OPEN_SOURCE_UPSTREAM');
});

test('dependency ledger marks OS_CODING as JM', () => {
  assert.equal(DEPENDENCY_LEDGER.find(x => x.id === 'os-coding')?.class, 'JM');
});

test('ready Linux host passes hard preflight', () => {
  const assessment = assessAospHost(readyHost);
  assert.equal(assessment.ready, true);
  assert.deepEqual(assessment.failed, []);
});

test('undersized host is held rather than pretending build readiness', () => {
  const assessment = assessAospHost(blockedHost);
  assert.equal(assessment.ready, false);
  assert.ok(assessment.failed.includes('host.disk'));
  assert.ok(assessment.failed.includes('host.ram'));
});

test('OS_CODING -> OneBody IR -> TheoC control plane verifies', () => {
  const control = buildJMControlPlane(readyHost);
  assert.equal(control.osCoding.ast.type, 'OSCodingProgram');
  assert.equal(control.osCoding.ir.type, 'OSCodingIR');
  assert.equal(control.oneBody.proof.ok, true);
  assert.equal(control.theoC.proof.ok, true);
  assert.equal(control.realContactAuthorised, true);
});

test('held host does not execute the OneBody preflight Ding', () => {
  const control = buildJMControlPlane(blockedHost);
  assert.equal(control.realContactAuthorised, false);
  assert.equal(control.oneBody.execution, null);
});

test('held host emits no real AOSP commands', () => {
  const plan = createAospExecutionPlan(blockedHost);
  assert.equal(plan.status, 'HOLD');
  assert.deepEqual(plan.commands, []);
});

test('ready plan stages JM product then lunches JM target before m', () => {
  const plan = createAospExecutionPlan(readyHost);
  const joined = plan.commands.join('\n');
  assert.equal(plan.status, 'READY');
  assert.match(joined, /repo init .*--clone-filter=blob:limit=10M .*android-latest-release/);
  assert.match(joined, /repo sync -c -j8/);
  assert.match(joined, /install-jm-aosp-product\.mjs/);
  assert.match(joined, /source build\/envsetup\.sh/);
  assert.match(joined, /lunch jm_cf_x86_64_phone-aosp_current-userdebug/);
  assert.match(joined, /m -j/);
  assert.match(joined, /product\/etc\/jm-os-release\.txt/);
});

test('JM product layer stages independently without mutating upstream product file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jm-aosp-product-test-'));
  try {
    const baseDir = path.join(root, 'device', 'google', 'cuttlefish', 'vsoc_x86_64_only', 'phone');
    fs.mkdirSync(baseDir, { recursive: true });
    const baseFile = path.join(baseDir, 'aosp_cf.mk');
    fs.writeFileSync(baseFile, '# fake contacted upstream base for staging test\n');
    const before = fs.readFileSync(baseFile, 'utf8');

    const receipt = stageJMProduct(root);
    assert.equal(receipt.passed, true);
    assert.ok(receipt.ding);
    assert.equal(fs.readFileSync(baseFile, 'utf8'), before);
    assert.ok(fs.existsSync(path.join(root, 'device', 'jm', 'cuttlefish', 'AndroidProducts.mk')));
    assert.ok(fs.existsSync(path.join(root, 'device', 'jm', 'cuttlefish', 'jm_cf_x86_64_phone.mk')));
    assert.match(
      fs.readFileSync(path.join(root, 'device', 'jm', 'cuttlefish', 'jm-os-release.txt'), 'utf8'),
      /product=jm_cf_x86_64_phone/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('full build script observes boot return and live JM marker', () => {
  const script = renderAospBuildScript(createAospExecutionPlan(readyHost));
  assert.match(script, /launch_cvd --daemon/);
  assert.match(script, /sys\.boot_completed/);
  assert.match(script, /ro\.build\.fingerprint/);
  assert.match(script, /\/product\/etc\/jm-os-release\.txt/);
});

test('compile-only script stages and builds JM product without attempting Cuttlefish boot', () => {
  const script = renderAospCompileScript(createAospExecutionPlan(readyHost));
  assert.match(script, /repo sync -c -j8/);
  assert.match(script, /install-jm-aosp-product\.mjs/);
  assert.match(script, /lunch jm_cf_x86_64_phone-aosp_current-userdebug/);
  assert.match(script, /m -j/);
  assert.doesNotMatch(script, /launch_cvd/);
  assert.doesNotMatch(script, /sys\.boot_completed/);
});

test('boot-only script re-enters JM target and observes marker without resyncing/rebuilding', () => {
  const script = renderAospBootScript(createAospExecutionPlan(readyHost));
  assert.match(script, /lunch jm_cf_x86_64_phone-aosp_current-userdebug/);
  assert.match(script, /launch_cvd --daemon/);
  assert.match(script, /sys\.boot_completed/);
  assert.match(script, /jm-aosp-boot-product-marker/);
  assert.doesNotMatch(script, /repo sync/);
  assert.doesNotMatch(script, /m -j/);
});

test('empty receipt earns no build Ding and no boot Ding', () => {
  const verdict = evaluateAospContactReceipt({});
  assert.equal(verdict.build.ding, null);
  assert.equal(verdict.boot.ding, null);
  assert.equal(verdict.crown, 'NO_JM_AOSP_PRODUCT_BUILD_BOOT_CROWN');
});

test('generic AOSP build evidence without JM marker cannot earn JM build Ding', () => {
  const verdict = evaluateAospContactReceipt({
    ...buildEvidence(),
    jmProductMarkerObserved: false
  });
  assert.equal(verdict.build.ding, null);
});

test('JM image evidence can earn bounded JM build Ding without boot Ding', () => {
  const verdict = evaluateAospContactReceipt(buildEvidence());
  assert.equal(verdict.build.ding?.scope, 'JM_AOSP_PRODUCT_BUILD');
  assert.equal(verdict.boot.ding, null);
});

test('boot return cannot earn boot Ding without build evidence first', () => {
  const verdict = evaluateAospContactReceipt({
    bootCompleted: '1',
    buildFingerprint: 'JM/jm_cf_x86_64_phone/vsoc_x86_64_only:test',
    jmProductMarkerBootObserved: true
  });
  assert.equal(verdict.boot.ding, null);
});

test('running JM product must return its live marker before boot Ding', () => {
  const verdict = evaluateAospContactReceipt(buildEvidence({
    bootCompleted: '1',
    buildFingerprint: 'JM/jm_cf_x86_64_phone/vsoc_x86_64_only:test',
    jmProductMarkerBootObserved: false
  }));
  assert.equal(verdict.build.ding?.scope, 'JM_AOSP_PRODUCT_BUILD');
  assert.equal(verdict.boot.ding, null);
});

test('full returned JM product contact earns bounded build + boot Dings', () => {
  const verdict = evaluateAospContactReceipt(buildEvidence({
    bootCompleted: '1',
    buildFingerprint: 'JM/jm_cf_x86_64_phone/vsoc_x86_64_only:test',
    jmProductMarkerBootObserved: true
  }));
  assert.equal(verdict.build.ding?.scope, 'JM_AOSP_PRODUCT_BUILD');
  assert.equal(verdict.boot.ding?.scope, 'JM_AOSP_PRODUCT_BOOT');
  assert.equal(verdict.crown, 'BOUNDED_JM_AOSP_PRODUCT_BUILD_BOOT_CONTACT');
});

test('final crown stays bounded beyond real-phone/production claims', () => {
  const verdict = evaluateAospContactReceipt(buildEvidence({
    bootCompleted: '1',
    buildFingerprint: 'JM/jm_cf_x86_64_phone/vsoc_x86_64_only:test',
    jmProductMarkerBootObserved: true
  }));
  assert.match(verdict.boundary, /real-phone hardware support/);
  assert.match(verdict.boundary, /CTS compatibility/);
});

console.log(JSON.stringify({
  schema: 'jm.aosp-bridge-selftest/0.2',
  pass,
  total: 22,
  state: pass === 22 ? 'PASS' : 'FAIL',
  claim: 'JM AOSP product integration logic proven only; no full AOSP compile/boot claimed.'
}, null, 2));
