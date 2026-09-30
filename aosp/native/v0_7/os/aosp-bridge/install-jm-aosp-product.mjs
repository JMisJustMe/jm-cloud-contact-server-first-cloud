#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, 'product-layer', 'device', 'jm', 'cuttlefish');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function stageJMProduct(aospRoot) {
  const root = path.resolve(aospRoot);
  const baseProduct = path.join(root, 'device', 'google', 'cuttlefish', 'vsoc_x86_64_only', 'phone', 'aosp_cf.mk');
  if (!fs.existsSync(baseProduct)) {
    throw new Error(`JM_AOSP_BASE_PRODUCT_MISSING: ${baseProduct}`);
  }

  const destination = path.join(root, 'device', 'jm', 'cuttlefish');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(SOURCE, destination, { recursive: true });

  const required = [
    'AndroidProducts.mk',
    'jm_cf_x86_64_phone.mk',
    'jm-os-release.txt'
  ];

  const files = Object.fromEntries(required.map(name => {
    const file = path.join(destination, name);
    if (!fs.existsSync(file)) throw new Error(`JM_AOSP_PRODUCT_FILE_MISSING: ${file}`);
    return [name, {
      path: path.relative(root, file).split(path.sep).join('/'),
      bytes: fs.statSync(file).size,
      sha256: sha256File(file)
    }];
  }));

  const productText = fs.readFileSync(path.join(destination, 'jm_cf_x86_64_phone.mk'), 'utf8');
  const registryText = fs.readFileSync(path.join(destination, 'AndroidProducts.mk'), 'utf8');
  const markerText = fs.readFileSync(path.join(destination, 'jm-os-release.txt'), 'utf8');

  const checks = [
    {
      id: 'inherit.verified-base',
      passed: productText.includes('device/google/cuttlefish/vsoc_x86_64_only/phone/aosp_cf.mk')
    },
    {
      id: 'product.name',
      passed: productText.includes('PRODUCT_NAME := jm_cf_x86_64_phone')
    },
    {
      id: 'registry.product',
      passed: registryText.includes('jm_cf_x86_64_phone')
    },
    {
      id: 'marker.copy',
      passed: productText.includes('$(TARGET_COPY_OUT_PRODUCT)/etc/jm-os-release.txt')
    },
    {
      id: 'marker.identity',
      passed: markerText.includes('product=jm_cf_x86_64_phone')
    }
  ];

  const passed = checks.every(item => item.passed);
  const receipt = {
    schema: 'jm.aosp-product-stage-receipt/0.7',
    root,
    source: SOURCE,
    destination,
    baseProduct: path.relative(root, baseProduct).split(path.sep).join('/'),
    product: 'jm_cf_x86_64_phone',
    target: 'jm_cf_x86_64_phone-aosp_current-userdebug',
    files,
    checks,
    passed,
    ding: passed ? {
      type: 'DING',
      scope: 'JM_AOSP_PRODUCT_LAYER_STAGED',
      claim: 'JM product definition is staged into a contacted AOSP tree and inherits the verified Android 17 Cuttlefish x86_64-only phone product.'
    } : null,
    boundary: 'Staging proves source-tree integration only. It does not prove Soong product discovery, compilation, image inclusion or boot.'
  };

  const receiptDir = path.join(root, 'jm-aosp-receipts');
  fs.mkdirSync(receiptDir, { recursive: true });
  fs.writeFileSync(
    path.join(receiptDir, 'JM_AOSP_PRODUCT_STAGE_RECEIPT_v0_7.json'),
    JSON.stringify(receipt, null, 2) + '\n'
  );

  if (!passed) throw new Error('JM_AOSP_PRODUCT_STAGE_CHECK_FAILED');
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  if (!root) {
    console.error('Usage: node install-jm-aosp-product.mjs <AOSP_ROOT>');
    process.exit(64);
  }
  const receipt = stageJMProduct(root);
  console.log(JSON.stringify(receipt, null, 2));
}
