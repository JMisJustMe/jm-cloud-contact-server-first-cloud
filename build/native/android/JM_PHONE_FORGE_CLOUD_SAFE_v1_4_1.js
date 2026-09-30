(function mountJMPhoneForge(global) {
  "use strict";

  const TEMPLATE_PACKAGE = "com.jm.child.aaaaaaaaaaaa";
  const TEMPLATE_APK_B64 = "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v8c417tZj0Zn9PQ/UEsHCIuoxu+YAgAAvAYAAFBLAwQKAAAIAADrtP5c8HLiVpYDAACWAwAAEQAAAGFzc2V0cy9pbmRleC5odG1sPCFkb2N0eXBlIGh0bWw+PGh0bWwgbGFuZz0iZW4iPjxoZWFkPjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij48bWV0YSBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9ZGV2aWNlLXdpZHRoLGluaXRpYWwtc2NhbGU9MSx2aWV3cG9ydC1maXQ9Y292ZXIiPjxtZXRhIG5hbWU9InRoZW1lLWNvbG9yIiBjb250ZW50PSIjMDgwYTBmIj48dGl0bGU+Sk0gUGhvbmUtRm9yZ2VkIENoaWxkPC90aXRsZT48c3R5bGU+Kntib3gtc2l6aW5nOmJvcmRlci1ib3h9Ym9keXttYXJnaW46MDttaW4taGVpZ2h0OjEwMHZoO2Rpc3BsYXk6Z3JpZDtwbGFjZS1pdGVtczpjZW50ZXI7YmFja2dyb3VuZDojMDgwYTBmO2NvbG9yOiNmN2Y0ZWE7Zm9udDoxNnB4LzEuNTUgc3lzdGVtLXVpLHNhbnMtc2VyaWY7cGFkZGluZzoyNHB4fS5jYXJke21heC13aWR0aDo3MjBweDtib3JkZXI6MXB4IHNvbGlkICMzMDM3NDQ7Ym9yZGVyLXJhZGl1czoyMnB4O3BhZGRpbmc6MjRweDtiYWNrZ3JvdW5kOiMxMTE3MjJ9aDF7bWFyZ2luOjAgMCAxMHB4O2NvbG9yOiNmZmJkMmV9LnJvdXRle2ZvbnQtZmFtaWx5OnVpLW1vbm9zcGFjZSxtb25vc3BhY2U7Y29sb3I6IzU1ZTZiM30ubXV0ZWR7Y29sb3I6I2E1YWJiYX08L3N0eWxlPjwvaGVhZD48Ym9keT48bWFpbiBjbGFzcz0iY2FyZCI+PGRpdiBjbGFzcz0icm91dGUiPkNhZGluZyDihpIgT25lQm9keSDihpIgUGhvbmUtRm9yZ2VkIEFQSzwvZGl2PjxoMT5KTSBQaG9uZS1Gb3JnZWQgQ2hpbGQ8L2gxPjxwPlRoaXMgY2FycmllciB3YXMgZW1pdHRlZCBmcm9tIHRoZSBKTSBBbmRyb2lkIEZvcmdlIHNlbGYtaG9zdCByb3V0ZS48L3A+PHAgY2xhc3M9Im11dGVkIj5SZXBsYWNlIHRoaXMgSFRNTCBpbiB0aGUgZm9yZ2UgYmVmb3JlIHNhdmluZyB0aGUgY2hpbGQgQVBLLjwvcD48L21haW4+PC9ib2R5PjwvaHRtbD4KUEsBAhQAFAAICAgA67T+XP7c+TPKBwAADA8AAAsAAAAAAAAAAAAAAAAAAAAAAGNsYXNzZXMuZGV4UEsBAgoACgAACAAA67T+XCdPL0IkAwAAJAMAAA4AAAAAAAAAAAAAAAAAAwgAAHJlc291cmNlcy5hcnNjUEsBAhQAFAAICAgA67T+XIuoxu+YAgAAvAYAABMAAAAAAAAAAAAAAAAAUwsAAEFuZHJvaWRNYW5pZmVzdC54bWxQSwECCgAKAAAIAADrtP5c8HLiVpYDAACWAwAAEQAAAAAAAAAAAAAAAAAsDgAAYXNzZXRzL2luZGV4Lmh0bWxQSwUGAAAAAAQABAD1AAAA8REAAAAA";
  const CHILD_PRIVATE_KEY_PKCS8_B64 = String(global.JM_PHONE_FORGE_SIGNING?.CHILD_PRIVATE_KEY_PKCS8_B64 || "");
  const CHILD_CERT_DER_B64 = String(global.JM_PHONE_FORGE_SIGNING?.CHILD_CERT_DER_B64 || "");
  const CHILD_PUBLIC_KEY_SPKI_B64 = String(global.JM_PHONE_FORGE_SIGNING?.CHILD_PUBLIC_KEY_SPKI_B64 || "");
  const CHILD_CERT_SHA256 = String(global.JM_PHONE_FORGE_SIGNING?.CHILD_CERT_SHA256 || "");
  const SIGNATURE_ALGORITHM_ID = 0x0103;
  const V2_BLOCK_ID = 0x7109871a;
  const CHUNK_SIZE = 1024 * 1024;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function fromBase64(value) {
    const raw = atob(value);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  function toBase64(bytes) {
    let text = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      text += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + step)));
    }
    return btoa(text);
  }

  function concat(...parts) {
    const arrays = parts.flat().filter(Boolean).map((part) =>
      part instanceof Uint8Array ? part : new Uint8Array(part)
    );
    const total = arrays.reduce((sum, item) => sum + item.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const item of arrays) {
      out.set(item, offset);
      offset += item.length;
    }
    return out;
  }

  function uint32(value) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, Number(value) >>> 0, true);
    return out;
  }

  function uint64(value) {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setBigUint64(0, BigInt(value), true);
    return out;
  }

  function lengthPrefixed(bytes) {
    return concat(uint32(bytes.length), bytes);
  }

  function hex(bytes) {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  const RSA_MODULUS_HEX = "dd87dee6b377074701ab365317f62de3781f92d3db4cd1316467305ee7c8a28977a54fc4d08b7212ba0685214856a9351a73dcbef53bad3908914001bf90f1fcac8846abd0b4398b575d40778249de5e700cafe4bc3cc025d3c2a908a3c912481bfc3b3bd66be8c224280315eae74dad4a1d546ea9d6ecf20adff5679bcb61396cd9896e67c814def84d5d129c2eec325abaec0bd996da27479a30ceaab3c23017e521ec52b24f0a126a9a9638fca93603bb8115126a9aec218eb379987c89b6d6950ef26e063713d608b58fe432cdc19451bc2cffbdbacf0e0e5f8cb40063f8cf380a6d911a510786fe5b181857828a99788792cdde04eda2283ea21b148029";
  const RSA_PRIVATE_EXPONENT_HEX = "3055f28d3cd0364ec86eee89ffdaef9547c2ffdae8e92065da05e7d87553621f837316ee1720adf1a714401d0c7718316585ad3f1f2bf7b64f87bdc303e4e0dfe45751b03077fa6c4c5224fc4e79c6a2ad691f41d5ce9d90435da05b29bd781732bffcbea820e066e7d3b124a99df165639bf5adb5b216fe12e05ddfceeef7d5d323ebf8a16fc9461a563a155871e4deabb2a453ce0b331353b8a323d1ffcca66a97be59fd882bac103977615fe52801555be3427c6bf9a16ccc58221f392ea857660617702fcc117146eef6a6561e20d51209bd3616016ce7f6751e36cb54edb3f67773df43952cd8719f340a06c88d3997a6978c01601ec8e6e4512fbe4419";
  const RSA_MODULUS = BigInt(`0x${RSA_MODULUS_HEX}`);
  const RSA_PRIVATE_EXPONENT = BigInt(`0x${RSA_PRIVATE_EXPONENT_HEX}`);
  const RSA_PUBLIC_EXPONENT = 65537n;
  const RSA_SIGNATURE_BYTES = 256;
  const SHA256_DIGEST_INFO_PREFIX = Uint8Array.from([
    0x30,0x31,0x30,0x0d,0x06,0x09,0x60,0x86,0x48,0x01,0x65,0x03,0x04,0x02,0x01,0x05,0x00,0x04,0x20
  ]);

  function sha1Bytes(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const data = new Uint8Array(paddedLength);
    data.set(bytes);
    data[bytes.length] = 0x80;
    const bitLength = BigInt(bytes.length) * 8n;
    const view = new DataView(data.buffer);
    view.setUint32(paddedLength - 8, Number((bitLength >> 32n) & 0xffffffffn), false);
    view.setUint32(paddedLength - 4, Number(bitLength & 0xffffffffn), false);
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Uint32Array(80);
    const rol = (value, shift) => ((value << shift) | (value >>> (32 - shift))) >>> 0;
    for (let offset = 0; offset < data.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 80; i += 1) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i += 1) {
        let f, k;
        if (i < 20) { f = (b & c) | ((~b) & d); k = 0x5a827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; k = 0xca62c1d6; }
        const temp = (rol(a, 5) + f + e + k + w[i]) >>> 0;
        e = d; d = c; c = rol(b, 30); b = a; a = temp;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    const out = new Uint8Array(20);
    const outView = new DataView(out.buffer);
    [h0,h1,h2,h3,h4].forEach((value, index) => outView.setUint32(index * 4, value, false));
    return out;
  }

  function sha256Bytes(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const data = new Uint8Array(paddedLength);
    data.set(bytes);
    data[bytes.length] = 0x80;
    const bitLength = BigInt(bytes.length) * 8n;
    const view = new DataView(data.buffer);
    view.setUint32(paddedLength - 8, Number((bitLength >> 32n) & 0xffffffffn), false);
    view.setUint32(paddedLength - 4, Number(bitLength & 0xffffffffn), false);
    const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w = new Uint32Array(64);
    const rotr = (value, shift) => ((value >>> shift) | (value << (32 - shift))) >>> 0;
    for (let offset = 0; offset < data.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 64; i += 1) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a,b,c,d,e,f,g,h] = H;
      for (let i = 0; i < 64; i += 1) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ ((~e) & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
      H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
    }
    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    H.forEach((value, index) => outView.setUint32(index * 4, value, false));
    return out;
  }

  async function digest(name, bytes) {
    const algorithm = String(name).toUpperCase();
    if (global.crypto?.subtle) {
      try {
        return new Uint8Array(await global.crypto.subtle.digest(algorithm, bytes));
      } catch (_) {
        // Restricted file/content routes may expose crypto without permitting SubtleCrypto.
      }
    }
    if (algorithm === "SHA-1") return sha1Bytes(bytes);
    if (algorithm === "SHA-256") return sha256Bytes(bytes);
    throw new Error(`Unsupported local digest algorithm: ${algorithm}`);
  }

  function bytesToBigInt(bytes) {
    const value = hex(bytes);
    return value ? BigInt(`0x${value}`) : 0n;
  }

  function bigIntToBytes(value, length) {
    const out = new Uint8Array(length);
    let current = value;
    for (let index = length - 1; index >= 0; index -= 1) {
      out[index] = Number(current & 0xffn);
      current >>= 8n;
    }
    if (current !== 0n) throw new Error("RSA result exceeded the fixed signature width.");
    return out;
  }

  function modPow(base, exponent, modulus) {
    let result = 1n;
    let factor = base % modulus;
    let power = exponent;
    while (power > 0n) {
      if (power & 1n) result = (result * factor) % modulus;
      power >>= 1n;
      if (power) factor = (factor * factor) % modulus;
    }
    return result;
  }

  async function pkcs1Sha256EncodedMessage(data) {
    const messageHash = await digest("SHA-256", data);
    const digestInfo = concat(SHA256_DIGEST_INFO_PREFIX, messageHash);
    const paddingLength = RSA_SIGNATURE_BYTES - digestInfo.length - 3;
    if (paddingLength < 8) throw new Error("RSA PKCS#1 padding space is invalid.");
    const padding = new Uint8Array(paddingLength);
    padding.fill(0xff);
    return concat(Uint8Array.of(0x00, 0x01), padding, Uint8Array.of(0x00), digestInfo);
  }

  async function signPkcs1Sha256Fallback(data) {
    const encoded = await pkcs1Sha256EncodedMessage(data);
    const signatureValue = modPow(bytesToBigInt(encoded), RSA_PRIVATE_EXPONENT, RSA_MODULUS);
    return bigIntToBytes(signatureValue, RSA_SIGNATURE_BYTES);
  }

  async function verifyPkcs1Sha256Fallback(signature, data) {
    const expected = await pkcs1Sha256EncodedMessage(data);
    const recoveredValue = modPow(bytesToBigInt(signature), RSA_PUBLIC_EXPONENT, RSA_MODULUS);
    const recovered = bigIntToBytes(recoveredValue, RSA_SIGNATURE_BYTES);
    if (recovered.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < recovered.length; index += 1) difference |= recovered[index] ^ expected[index];
    return difference === 0;
  }

  function utf16le(text) {
    const out = new Uint8Array(text.length * 2);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      out[i * 2] = code & 0xff;
      out[i * 2 + 1] = code >>> 8;
    }
    return out;
  }

  function findAll(haystack, needle) {
    const matches = [];
    outer: for (let at = 0; at <= haystack.length - needle.length; at += 1) {
      for (let i = 0; i < needle.length; i += 1) {
        if (haystack[at + i] !== needle[i]) continue outer;
      }
      matches.push(at);
      at += needle.length - 1;
    }
    return matches;
  }

  function replaceSameLength(bytes, from, to) {
    if (from.length !== to.length) throw new Error("Package replacement must keep fixed length.");
    let count = 0;
    for (const [source, target] of [
      [encoder.encode(from), encoder.encode(to)],
      [utf16le(from), utf16le(to)]
    ]) {
      for (const at of findAll(bytes, source)) {
        bytes.set(target, at);
        count += 1;
      }
    }
    return count;
  }

  function adler32(bytes) {
    let a = 1;
    let b = 0;
    const modulus = 65521;
    for (const byte of bytes) {
      a = (a + byte) % modulus;
      b = (b + a) % modulus;
    }
    return ((b << 16) | a) >>> 0;
  }

  async function repairDex(bytes) {
    const signature = await digest("SHA-1", bytes.subarray(32));
    bytes.set(signature, 12);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      .setUint32(8, adler32(bytes.subarray(12)), true);
  }

  function findEocd(bytes) {
    const floor = Math.max(0, bytes.length - 65557);
    for (let at = bytes.length - 22; at >= floor; at -= 1) {
      if (
        bytes[at] === 0x50 && bytes[at + 1] === 0x4b &&
        bytes[at + 2] === 0x05 && bytes[at + 3] === 0x06
      ) {
        const commentLength = new DataView(bytes.buffer, bytes.byteOffset + at + 20, 2)
          .getUint16(0, true);
        if (at + 22 + commentLength === bytes.length) return at;
      }
    }
    throw new Error("ZIP EOCD not found.");
  }

  async function contentDigest(sections) {
    const chunkDigests = [];
    for (const section of sections) {
      for (let offset = 0; offset < section.length; offset += CHUNK_SIZE) {
        const chunk = section.subarray(offset, Math.min(section.length, offset + CHUNK_SIZE));
        chunkDigests.push(await digest("SHA-256", concat(
          Uint8Array.of(0xa5), uint32(chunk.length), chunk
        )));
      }
    }
    return digest("SHA-256", concat(
      Uint8Array.of(0x5a), uint32(chunkDigests.length), ...chunkDigests
    ));
  }

  function signedDataFor(contentHash, certificate) {
    const algorithm = uint32(SIGNATURE_ALGORITHM_ID);
    const digestRecord = concat(algorithm, lengthPrefixed(contentHash));
    const digests = lengthPrefixed(lengthPrefixed(digestRecord));
    const certificates = lengthPrefixed(lengthPrefixed(certificate));
    const attributes = lengthPrefixed(new Uint8Array());
    return concat(digests, certificates, attributes);
  }

  function signingBlock(signedData, signature, publicKey) {
    const signatureRecord = concat(
      uint32(SIGNATURE_ALGORITHM_ID),
      lengthPrefixed(signature)
    );
    const signatures = lengthPrefixed(lengthPrefixed(signatureRecord));
    const signer = concat(
      lengthPrefixed(signedData),
      signatures,
      lengthPrefixed(publicKey)
    );
    const v2Value = lengthPrefixed(lengthPrefixed(signer));
    const pair = concat(uint64(4 + v2Value.length), uint32(V2_BLOCK_ID), v2Value);
    const size = pair.length + 24;
    return concat(
      uint64(size), pair, uint64(size), encoder.encode("APK Sig Block 42")
    );
  }


  function uint16(value) {
    const out = new Uint8Array(2);
    new DataView(out.buffer).setUint16(0, value, true);
    return out;
  }

  function inspectZipAlignment(bytes, alignment = 4) {
    const eocdOffset = findEocd(bytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const entryCount = view.getUint16(eocdOffset + 10, true);
    const centralOffset = view.getUint32(eocdOffset + 16, true);
    const stored = [];
    const misaligned = [];
    let cursor = centralOffset;
    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Central directory is malformed.");
      const compression = view.getUint16(cursor + 10, true);
      const uncompressedSize = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
      if (compression === 0 && uncompressedSize > 0) {
        const item = { name, dataOffset, modulo: dataOffset % alignment, bytes: uncompressedSize };
        stored.push(item);
        if (item.modulo !== 0) misaligned.push(item);
      }
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return { alignment, pass: misaligned.length === 0, storedEntriesChecked: stored.length, stored, misaligned };
  }

  function alignZip4(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const eocdOffset = findEocd(bytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const entryCount = view.getUint16(eocdOffset + 10, true);
    const centralSize = view.getUint32(eocdOffset + 12, true);
    const centralOffset = view.getUint32(eocdOffset + 16, true);
    const entries = [];
    let cursor = centralOffset;
    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Central directory is malformed.");
      const compression = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const uncompressedSize = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const centralLength = 46 + nameLength + extraLength + commentLength;
      entries.push({ index, centralAt: cursor, centralLength, compression, compressedSize, uncompressedSize, localOffset });
      cursor += centralLength;
    }

    const sorted = [...entries].sort((a, b) => a.localOffset - b.localOffset);
    const localParts = [];
    const newOffsets = new Map();
    let outputLength = 0;
    for (let index = 0; index < sorted.length; index += 1) {
      const entry = sorted[index];
      const nextOffset = index + 1 < sorted.length ? sorted[index + 1].localOffset : centralOffset;
      if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error("Local ZIP header is malformed.");
      const localNameLength = view.getUint16(entry.localOffset + 26, true);
      const localExtraLength = view.getUint16(entry.localOffset + 28, true);
      const nameStart = entry.localOffset + 30;
      const extraStart = nameStart + localNameLength;
      const dataStart = extraStart + localExtraLength;
      const dataEnd = dataStart + entry.compressedSize;
      if (dataEnd > nextOffset) throw new Error("Compressed ZIP data overlaps the next entry.");
      const fixed = bytes.slice(entry.localOffset, entry.localOffset + 30);
      const name = bytes.slice(nameStart, extraStart);
      const originalExtra = bytes.slice(extraStart, dataStart);
      let pad = new Uint8Array();
      if (entry.compression === 0 && entry.uncompressedSize > 0) {
        const baseDataOffset = outputLength + 30 + name.length + originalExtra.length;
        const needed = (4 - (baseDataOffset % 4)) % 4;
        if (needed) pad = concat(uint16(0xd935), uint16(needed), new Uint8Array(needed));
      }
      const finalExtra = concat(originalExtra, pad);
      new DataView(fixed.buffer, fixed.byteOffset, fixed.byteLength).setUint16(28, finalExtra.length, true);
      newOffsets.set(entry.index, outputLength);
      const record = concat(fixed, name, finalExtra, bytes.slice(dataStart, nextOffset));
      localParts.push(record);
      outputLength += record.length;
    }

    const centralParts = [];
    let rebuiltCentralLength = 0;
    for (const entry of entries) {
      const central = bytes.slice(entry.centralAt, entry.centralAt + entry.centralLength);
      new DataView(central.buffer, central.byteOffset, central.byteLength).setUint32(42, newOffsets.get(entry.index), true);
      centralParts.push(central);
      rebuiltCentralLength += central.length;
    }
    const centralTrailer = bytes.slice(centralOffset + centralSize, eocdOffset);
    const eocd = bytes.slice(eocdOffset);
    new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength).setUint32(12, rebuiltCentralLength + centralTrailer.length, true);
    new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength).setUint32(16, outputLength, true);
    const aligned = concat(...localParts, ...centralParts, centralTrailer, eocd);
    const report = inspectZipAlignment(aligned, 4);
    if (!report.pass) throw new Error(`APK ZIP alignment HOLD: ${JSON.stringify(report.misaligned)}`);
    return { bytes: aligned, report };
  }

  async function signV2(unsignedApk) {
    if (!CHILD_PRIVATE_KEY_PKCS8_B64 || !CHILD_CERT_DER_B64 || !CHILD_PUBLIC_KEY_SPKI_B64 || !CHILD_CERT_SHA256) {
      throw new Error("APK signing material is required; embedded debug key was removed for cloud custody.");
    }
    const eocdOffset = findEocd(unsignedApk);
    const view = new DataView(unsignedApk.buffer, unsignedApk.byteOffset, unsignedApk.byteLength);
    const centralOffset = view.getUint32(eocdOffset + 16, true);
    const beforeCentral = unsignedApk.subarray(0, centralOffset);
    const centralDirectory = unsignedApk.subarray(centralOffset, eocdOffset);
    const digestEocd = unsignedApk.slice(eocdOffset);
    new DataView(digestEocd.buffer, digestEocd.byteOffset, digestEocd.byteLength)
      .setUint32(16, centralOffset, true);

    const certificate = fromBase64(CHILD_CERT_DER_B64);
    const publicKeyBytes = fromBase64(CHILD_PUBLIC_KEY_SPKI_B64);
    const protectedDigest = await contentDigest([beforeCentral, centralDirectory, digestEocd]);
    const signedData = signedDataFor(protectedDigest, certificate);
    let signature;
    let signatureVerified = false;
    let signingBackend = "pure-js-rsa";
    if (global.crypto?.subtle) {
      try {
        const privateKey = await global.crypto.subtle.importKey(
          "pkcs8",
          fromBase64(CHILD_PRIVATE_KEY_PKCS8_B64),
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["sign"]
        );
        signature = new Uint8Array(await global.crypto.subtle.sign(
          { name: "RSASSA-PKCS1-v1_5" },
          privateKey,
          signedData
        ));
        const publicKey = await global.crypto.subtle.importKey(
          "spki",
          publicKeyBytes,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["verify"]
        );
        signatureVerified = await global.crypto.subtle.verify(
          { name: "RSASSA-PKCS1-v1_5" }, publicKey, signature, signedData
        );
        signingBackend = "webcrypto-rsa";
      } catch (_) {
        signature = null;
      }
    }
    if (!signature || !signatureVerified) {
      signature = await signPkcs1Sha256Fallback(signedData);
      signatureVerified = await verifyPkcs1Sha256Fallback(signature, signedData);
      signingBackend = "pure-js-rsa";
    }
    if (!signatureVerified) throw new Error("Local APK signature self-check failed.");

    const block = signingBlock(signedData, signature, publicKeyBytes);
    const finalEocd = digestEocd.slice();
    new DataView(finalEocd.buffer, finalEocd.byteOffset, finalEocd.byteLength)
      .setUint32(16, centralOffset + block.length, true);
    return {
      apk: concat(beforeCentral, block, centralDirectory, finalEocd),
      signatureVerified,
      signingBackend,
      certificateSha256: CHILD_CERT_SHA256
    };
  }

  function safeJson(value) {
    return JSON.stringify(value, null, 2);
  }

  async function mutateTemplate({ source, html, oneBody, packageName, receipt }) {
    if (!global.JSZip) throw new Error("JSZip carrier is unavailable.");
    const zip = await global.JSZip.loadAsync(fromBase64(TEMPLATE_APK_B64));
    for (const name of Object.keys(zip.files)) {
      if (/^META-INF\//i.test(name)) zip.remove(name);
    }

    const patchTargets = ["AndroidManifest.xml", "classes.dex", "resources.arsc"];
    const patchCounts = {};
    for (const name of patchTargets) {
      const file = zip.file(name);
      if (!file) continue;
      const bytes = await file.async("uint8array");
      let count = replaceSameLength(bytes, TEMPLATE_PACKAGE, packageName);
      count += replaceSameLength(
        bytes,
        TEMPLATE_PACKAGE.replaceAll(".", "/"),
        packageName.replaceAll(".", "/")
      );
      if (name === "classes.dex") await repairDex(bytes);
      patchCounts[name] = count;
      zip.file(name, bytes, {
        binary: true,
        compression: name === "resources.arsc" ? "STORE" : "DEFLATE"
      });
    }
    if (!patchCounts["AndroidManifest.xml"] || !patchCounts["classes.dex"]) {
      throw new Error("Carrier mutation HOLD: package identity did not reach manifest and DEX.");
    }

    zip.file("assets/index.html", html, { compression: "DEFLATE" });
    zip.file("assets/JM_SOURCE.jm.cading", source, { compression: "DEFLATE" });
    zip.file("assets/JM_ONEBODY.json", safeJson(oneBody), { compression: "DEFLATE" });
    zip.file("assets/JM_CHILD_RECEIPT.json", safeJson(receipt), { compression: "DEFLATE" });

    const unsignedApk = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      platform: "UNIX"
    });
    const aligned = alignZip4(unsignedApk);
    return { unsignedApk: aligned.bytes, patchCounts, alignment: aligned.report };
  }

  async function forge({ source, html, oneBody }) {
    if (!source || !html || !oneBody) throw new Error("Cading, HTML and OneBody are required.");
    if (html.length > 2_000_000) throw new Error("HTML body exceeds the 2 MB phone-forge safety ceiling.");
    const sourceHash = oneBody.provenance?.sourceSha256 || hex(await digest("SHA-256", encoder.encode(source)));
    const suffix = sourceHash.slice(0, 12).toLowerCase();
    const packageName = `com.jm.child.${suffix}`;
    if (packageName.length !== TEMPLATE_PACKAGE.length) {
      throw new Error("Derived package identity broke the fixed carrier length.");
    }
    const emittedOneBody = JSON.parse(JSON.stringify(oneBody));
    emittedOneBody.android = {
      ...emittedOneBody.android,
      package: packageName,
      appName: "JM Phone-Forged Child",
      artifactName: `JM_PHONE_FORGED_CHILD_${suffix}`
    };
    emittedOneBody.provenance = {
      ...(emittedOneBody.provenance || {}),
      sourceAndroidPackage: oneBody.android?.package || null,
      emittedAndroidPackage: packageName,
      packageHandoff: "source preserved / emitted carrier identity recorded"
    };
    const receipt = {
      schema: "jm.android.phone-child-receipt/v1",
      issuedAt: new Date().toISOString(),
      status: "PHONE_FORGE_BUILDING",
      authority: "Human-originated, human-governed, AI-assisted",
      owner: oneBody.identity?.owner,
      package: packageName,
      sourcePackage: oneBody.android?.package || null,
      emittedPackage: packageName,
      sourceSha256: sourceHash,
      bodies: emittedOneBody.bodies,
      route: "Cading → OneBody IR → fixed carrier mutation → DEX repair → ZIP alignment → APK v2 signing → Android Save picker",
      boundary: "Debug proof signer embedded for local child emission; not a production release identity."
    };
    const { unsignedApk, patchCounts, alignment } = await mutateTemplate({
      source, html, oneBody: emittedOneBody, packageName, receipt
    });
    const signed = await signV2(unsignedApk);
    const apkSha256 = hex(await digest("SHA-256", signed.apk));
    const finalReceipt = {
      ...receipt,
      status: "PASS_STATIC_PHONE_EMISSION",
      apkBytes: signed.apk.length,
      apkSha256,
      signatureScheme: "APK Signature Scheme v2 / RSA PKCS#1 SHA-256",
      signatureVerifiedInForge: signed.signatureVerified,
      signerCertificateSha256: signed.certificateSha256,
      patchCounts,
      zipAlignment: alignment,
      phoneInstall: "OPEN — owner device contact required",
      ding: "JM holds the final Ding"
    };
    return {
      ...signed,
      packageName,
      filename: `JM_PHONE_FORGED_CHILD_${suffix}.apk`,
      apkSha256,
      receipt: finalReceipt,
      emittedOneBody,
      toBase64: () => toBase64(signed.apk)
    };
  }

  global.JMPhoneForge = Object.freeze({
    forge,
    toBase64,
    fromBase64,
    TEMPLATE_PACKAGE,
    CHILD_CERT_SHA256
  });
})(globalThis);
