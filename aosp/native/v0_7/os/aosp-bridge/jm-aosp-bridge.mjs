/*
 * JM AOSP Bridge v0.1
 *
 * Purpose:
 *   Route a real AOSP source -> build -> boot contact through recovered JM
 *   orchestration bodies without pretending that AOSP/Soong/Repo are JM-authored.
 *
 * Governing laws:
 *   RECOVER THE STACK BEFORE BUYING THE STACK.
 *   MESH != MERGE.
 *   NO DING, NO CLAIM.
 */

import {
  parseOSCoding,
  lowerOSCoding
} from '../../coding-estate/everybody/role-qualified-61/native/os-coding.mjs';
import {
  createOneBodyIR,
  verifyOneBodyIR,
  executeOneBodyIR
} from '../../coding-estate/everybody/role-qualified-61/native/onebody-ir.mjs';
import {
  parseTheoC,
  lowerTheoC,
  verifyTheoCIR
} from '../../coding-estate/everybody/role-qualified-61/native/theoc.mjs';

export const JM_AOSP_BRIDGE = Object.freeze({
  schema: 'jm.aosp-bridge/0.1',
  status: 'REAL_CONTACT_BRIDGE_PRE_HEAVY_BUILD',
  product: 'JM Android-derived OS',
  law: 'JM governs route/meaning/proof; AOSP remains declared upstream substrate.',
  claimBoundary: 'Bridge/selftests are not an AOSP compile or boot.',
  noDingNoClaim: true
});

export const AOSP_UPSTREAM = Object.freeze({
  manifestUrl: 'https://android.googlesource.com/platform/manifest',
  branch: 'android-latest-release',
  currentReleaseFamilyObserved: 'android17-release',
  baseTarget: 'aosp_cf_x86_64_only_phone-aosp_current-userdebug',
  target: 'jm_cf_x86_64_phone-aosp_current-userdebug'
});

export const AOSP_HOST_REQUIREMENTS = Object.freeze({
  os: 'linux',
  arch: 'x86_64',
  minFreeDiskGB: 400,
  minRamGB: 64,
  minGlibc: '2.17',
  minRepo: '2.4'
});

export const DEPENDENCY_LEDGER = Object.freeze([
  { id: 'os-coding', class: 'JM', role: 'OS service/permission route grammar' },
  { id: 'onebody-ir', class: 'JM', role: 'neutral body structure + proof route' },
  { id: 'theoc', class: 'JM', role: 'contract/meaning preservation before host execution' },
  { id: 'trace-receipts', class: 'JM', role: 'claim boundary + build/boot receipt evaluation' },
  { id: 'android-forge', class: 'JM', role: 'Android authoring/emission surface; separate from platform build' },
  { id: 'aosp-source', class: 'OPEN_SOURCE_UPSTREAM', role: 'Android platform source substrate' },
  { id: 'repo', class: 'OPEN_SOURCE_UPSTREAM_TOOL', role: 'AOSP multi-repository source client' },
  { id: 'soong-ninja-aosp-prebuilts', class: 'OPEN_SOURCE_UPSTREAM_TOOLCHAIN', role: 'official AOSP build machinery carried by source tree' },
  { id: 'linux-glibc', class: 'HOST_CARRIER', role: 'supported AOSP build host' },
  { id: 'cuttlefish-kvm', class: 'HOST_CARRIER', role: 'virtual boot/contact carrier' },
  { id: 'adb', class: 'AOSP_CONTACT_TOOL', role: 'boot-state observation' },
  { id: 'node', class: 'HOST_CARRIER_FOR_JM_CURRENT_BODY', role: 'executes current JS-native JM bridge bodies' }
]);

function versionTuple(value) {
  const parts = String(value ?? '').match(/\d+/g)?.map(Number) ?? [];
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function versionAtLeast(actual, minimum) {
  const a = versionTuple(actual);
  const b = versionTuple(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return true;
}

function check(id, passed, actual, required) {
  return { id, passed: Boolean(passed), actual, required };
}

export function assessAospHost(host = {}) {
  const osName = String(host.os ?? '').toLowerCase();
  const arch = String(host.arch ?? '').toLowerCase();
  const checks = [
    check('host.os', osName === 'linux', osName || null, 'linux'),
    check('host.arch', ['x86_64', 'amd64', 'x64'].includes(arch), arch || null, 'x86_64'),
    check('host.disk', Number(host.freeDiskGB) >= AOSP_HOST_REQUIREMENTS.minFreeDiskGB, Number(host.freeDiskGB ?? 0), '>=400 GB free'),
    check('host.ram', Number(host.ramGB) >= AOSP_HOST_REQUIREMENTS.minRamGB, Number(host.ramGB ?? 0), '>=64 GB'),
    check('host.glibc', versionAtLeast(host.glibcVersion, AOSP_HOST_REQUIREMENTS.minGlibc), host.glibcVersion ?? null, '>=2.17'),
    check('host.repo', Boolean(host.repoAvailable) && versionAtLeast(host.repoVersion, AOSP_HOST_REQUIREMENTS.minRepo), host.repoVersion ?? null, 'Repo >=2.4'),
    check('host.node', Boolean(host.nodeAvailable), host.nodeVersion ?? null, 'Node available for current JM JS-native bodies')
  ];
  const failed = checks.filter(item => !item.passed);
  return {
    schema: 'jm.aosp-host-assessment/0.1',
    ready: failed.length === 0,
    status: failed.length === 0 ? 'READY_FOR_REAL_AOSP_CONTACT' : 'HOLD_HOST_REQUIREMENTS',
    checks,
    failed: failed.map(item => item.id),
    requirements: AOSP_HOST_REQUIREMENTS
  };
}

export const OS_CODING_SOURCE = `
oscoding JMAOSP {
  permission real_aosp_contact allow
  service source_sync requires real_aosp_contact route aosp.source.sync
  service platform_build requires real_aosp_contact route aosp.platform.build
  service boot_verify requires real_aosp_contact route aosp.boot.verify
}
`;

export const THEOC_SOURCE = `
theoc JMAOSPContract {
  source os-coding
  require identity
  require source-authority
  require trace
  require ding
  require lossless
  target javascript
}
`;

function oneBodySpec(assessment) {
  return {
    bodyId: 'jm-aosp-bridge',
    bodyName: 'JM AOSP Bridge',
    sourceAuthority: 'os-coding',
    nodes: [
      { id: 'source', type: 'upstream', authority: 'AOSP' },
      { id: 'jm-route', type: 'control', authority: 'JM' },
      { id: 'build', type: 'contact', authority: 'AOSP build machinery' },
      { id: 'boot', type: 'contact', authority: 'Cuttlefish host' },
      { id: 'receipt', type: 'proof', authority: 'JM' }
    ],
    links: [
      { from: 'source', to: 'jm-route', kind: 'declared-upstream' },
      { from: 'jm-route', to: 'build', kind: 'authorised-route' },
      { from: 'build', to: 'boot', kind: 'artifact-contact' },
      { from: 'boot', to: 'receipt', kind: 'observed-return' }
    ],
    operations: [
      { op: 'SET', name: 'branch', value: AOSP_UPSTREAM.branch },
      { op: 'ASSERT', name: 'branch', value: 'android-latest-release' },
      { op: 'SET', name: 'target', value: AOSP_UPSTREAM.target },
      { op: 'ASSERT', name: 'target', value: AOSP_UPSTREAM.target },
      { op: 'SET', name: 'hostReady', value: assessment.ready },
      { op: 'ASSERT', name: 'hostReady', value: true },
      { op: 'ROUTE', route: 'aosp.real-contact' },
      { op: 'TRACE', value: { boundary: 'JM bridge ready != AOSP built', upstream: 'AOSP' } },
      { op: 'DING', value: { stage: 'jm-control-plane', claim: 'READY_TO_ATTEMPT_REAL_AOSP_CONTACT_ONLY' } }
    ]
  };
}

export function buildJMControlPlane(host = {}) {
  const assessment = assessAospHost(host);

  const osAst = parseOSCoding(OS_CODING_SOURCE);
  const osIr = lowerOSCoding(osAst);

  const spec = oneBodySpec(assessment);
  const oneBodyIR = createOneBodyIR(spec);
  const oneBodyProof = verifyOneBodyIR(oneBodyIR);

  const theoContract = parseTheoC(THEOC_SOURCE);
  const theoIR = lowerTheoC(theoContract, spec);
  const theoProof = verifyTheoCIR(theoIR, 'javascript');

  const execution = assessment.ready ? executeOneBodyIR(oneBodyIR) : null;

  return {
    schema: 'jm.aosp-control-plane/0.1',
    bridge: JM_AOSP_BRIDGE,
    assessment,
    osCoding: { ast: osAst, ir: osIr },
    oneBody: { ir: oneBodyIR, proof: oneBodyProof, execution },
    theoC: { contract: theoContract, ir: theoIR, proof: theoProof },
    realContactAuthorised: assessment.ready && execution?.receipt?.ok === true,
    claim: assessment.ready && execution?.receipt?.ok === true
      ? 'JM_CONTROL_PLANE_READY_FOR_REAL_AOSP_CONTACT'
      : 'HOLD_BEFORE_REAL_AOSP_CONTACT'
  };
}

export function createAospExecutionPlan(host = {}, options = {}) {
  const control = buildJMControlPlane(host);
  if (!control.realContactAuthorised) {
    return {
      schema: 'jm.aosp-execution-plan/0.1',
      status: 'HOLD',
      commands: [],
      control,
      reason: control.assessment.failed
    };
  }

  const syncJobs = Math.max(1, Number(options.syncJobs ?? 8));
  const buildJobs = options.buildJobs ?? '${JM_AOSP_BUILD_JOBS:-$(nproc)}';
  const root = options.root ?? '${JM_AOSP_ROOT:-$HOME/jm-aosp/android-latest-release}';

  const commands = [
    `mkdir -p "${root}"`,
    `cd "${root}"`,
    `repo init --partial-clone --clone-filter=blob:limit=10M --no-use-superproject -b ${AOSP_UPSTREAM.branch} -u ${AOSP_UPSTREAM.manifestUrl}`,
    `repo sync -c -j${syncJobs}`,
    'repo manifest -r -o jm-aosp-manifest.xml',
    'test -n "${JM_AOSP_CONTROL_ROOT:-}"',
    'node "$JM_AOSP_CONTROL_ROOT/os/aosp-bridge/install-jm-aosp-product.mjs" "$PWD"',
    'source build/envsetup.sh',
    `lunch ${AOSP_UPSTREAM.target}`,
    `m -j"${buildJobs}"`,
    'test -n "${OUT_DIR:-}"',
    'find "$OUT_DIR" -maxdepth 4 -type f \\( -name "system.img" -o -name "super.img" \\) -print | tee jm-aosp-built-images.txt',
    'test -f "$OUT_DIR/product/etc/jm-os-release.txt"',
    'cat "$OUT_DIR/product/etc/jm-os-release.txt" | tee jm-aosp-product-marker.txt'
  ];

  return {
    schema: 'jm.aosp-execution-plan/0.1',
    status: 'READY',
    control,
    upstream: AOSP_UPSTREAM,
    commands,
    bootCommands: [
      `cd "${root}"`,
      'source build/envsetup.sh',
      `lunch ${AOSP_UPSTREAM.target}`,
      'command -v launch_cvd >/dev/null',
      'launch_cvd --daemon',
      'adb wait-for-device',
      'until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d "\\r")" = "1" ]; do sleep 5; done',
      'adb shell getprop ro.build.fingerprint | tee jm-aosp-build-fingerprint.txt',
      'adb shell getprop sys.boot_completed | tee jm-aosp-boot-completed.txt',
      'adb shell test -f /product/etc/jm-os-release.txt',
      'adb shell cat /product/etc/jm-os-release.txt | tee jm-aosp-boot-product-marker.txt'
    ],
    claimBoundary: 'Executing this plan is still not a Ding. A build/boot receipt must be evaluated.'
  };
}

export function renderAospCompileScript(plan) {
  if (plan?.status !== 'READY') {
    throw new Error('AOSP plan is not READY; no compile script may be emitted.');
  }
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'echo "[JM AOSP] compile contact route started"',
    ...plan.commands,
    '',
    'echo "[JM AOSP] compile route returned; evaluate build evidence before claiming a build Ding"',
    ''
  ].join('\n');
}

export function renderAospBootScript(plan) {
  if (plan?.status !== 'READY') {
    throw new Error('AOSP plan is not READY; no boot script may be emitted.');
  }
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'echo "[JM AOSP] boot contact route started"',
    ...plan.bootCommands,
    '',
    'echo "[JM AOSP] boot route returned; evaluate runtime evidence before claiming a boot Ding"',
    ''
  ].join('\n');
}

export function renderAospBuildScript(plan) {
  if (plan?.status !== 'READY') {
    throw new Error('AOSP plan is not READY; no build script may be emitted.');
  }
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'echo "[JM AOSP] real-contact route started"',
    ...plan.commands,
    '',
    'echo "[JM AOSP] platform build returned; boot carrier must still return contact"',
    ...plan.bootCommands,
    '',
    'echo "[JM AOSP] raw contact artifacts captured; evaluate receipt before claiming Ding"',
    ''
  ].join('\n');
}

export function evaluateAospContactReceipt(receipt = {}) {
  const buildChecks = [
    check('build.exit', Number(receipt.buildExitCode) === 0, receipt.buildExitCode ?? null, 0),
    check('build.image', Boolean(receipt.systemImageObserved), receipt.systemImageObserved ?? false, true),
    check('build.branch', receipt.branch === AOSP_UPSTREAM.branch, receipt.branch ?? null, AOSP_UPSTREAM.branch),
    check('build.target', receipt.target === AOSP_UPSTREAM.target, receipt.target ?? null, AOSP_UPSTREAM.target),
    check('build.manifest', Boolean(String(receipt.manifestRevision ?? '').trim()), receipt.manifestRevision ?? null, 'non-empty pinned manifest revision'),
    check('build.jm-marker', Boolean(receipt.jmProductMarkerObserved), receipt.jmProductMarkerObserved ?? false, true)
  ];
  const buildPassed = buildChecks.every(item => item.passed);

  const bootChecks = [
    check('boot.completed', String(receipt.bootCompleted ?? '').trim() === '1', receipt.bootCompleted ?? null, '1'),
    check('boot.fingerprint', Boolean(String(receipt.buildFingerprint ?? '').trim()), receipt.buildFingerprint ?? null, 'non-empty build fingerprint'),
    check('boot.jm-marker', Boolean(receipt.jmProductMarkerBootObserved), receipt.jmProductMarkerBootObserved ?? false, true)
  ];
  const bootPassed = buildPassed && bootChecks.every(item => item.passed);

  return {
    schema: 'jm.aosp-contact-verdict/0.1',
    build: {
      passed: buildPassed,
      checks: buildChecks,
      ding: buildPassed ? {
        type: 'DING',
        scope: 'JM_AOSP_PRODUCT_BUILD',
        claim: 'The JM Android-derived AOSP product compiled to an observed platform image and its JM product marker returned from the built product image.'
      } : null
    },
    boot: {
      passed: bootPassed,
      checks: bootChecks,
      ding: bootPassed ? {
        type: 'DING',
        scope: 'JM_AOSP_PRODUCT_BOOT',
        claim: 'The built JM Android-derived image returned sys.boot_completed=1, a build fingerprint and the JM product marker from the running /product partition.'
      } : null
    },
    crown: bootPassed ? 'BOUNDED_JM_AOSP_PRODUCT_BUILD_BOOT_CONTACT' : 'NO_JM_AOSP_PRODUCT_BUILD_BOOT_CROWN',
    boundary: 'Does not prove real-phone hardware support, production release readiness, CTS compatibility, or independence from AOSP/host carriers.'
  };
}
