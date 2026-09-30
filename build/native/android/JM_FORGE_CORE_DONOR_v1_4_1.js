(function mountJMForgeCore(global) {
  "use strict";

  const REQUIRED_ANDROID_BODIES = [
    "Cading",
    "Kading",
    "JMLogic",
    "FlowTalk",
    "RouteCode",
    "Quadze",
    "OneBody IR",
    "CadenVM",
    "CodeHand",
    "RouteOS",
    "TraceBox",
    "THEO",
    "Build Gates",
    "Zionfolder"
  ];

  function normalBody(value) {
    return value
      .trim()
      .replace(/\s*\/\s*/g, "/")
      .replace(/^Route-Code$/i, "RouteCode")
      .replace(/^Quadzi$/i, "Quadze")
      .replace(/^IR$/i, "OneBody IR")
      .replace(/^RouteVM$/i, "CadenVM")
      .replace(/^JMVM$/i, "CadenVM")
      .replace(/^RouteBox$/i, "TraceBox")
      .replace(/^AmaCore$/i, "RouteOS");
  }

  function scalar(value) {
    const clean = value.trim();
    if (/^".*"$/.test(clean) || /^'.*'$/.test(clean)) return clean.slice(1, -1);
    if (/^-?\d+$/.test(clean)) return Number(clean);
    if (/^(true|false)$/i.test(clean)) return clean.toLowerCase() === "true";
    return clean;
  }

  function pair(line, marker) {
    const body = line.slice(marker.length).trim();
    const arrow = body.indexOf("->");
    if (arrow === -1) return { from: body, to: "" };
    return {
      from: body.slice(0, arrow).trim(),
      to: body.slice(arrow + 2).trim()
    };
  }

  function parseCading(source, filename = "<phone-editor>") {
    const model = {
      filename,
      module: "",
      family: "",
      owner: "",
      version: "1.0.0",
      bodies: [],
      android: {},
      functions: [],
      flows: [],
      routes: [],
      maps: [],
      declarations: []
    };

    let section = null;
    let activeFlow = null;
    let activeFunction = null;
    const lines = String(source).replace(/\r\n/g, "\n").split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      const lineNumber = index + 1;
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

      const fail = (message) => {
        throw new Error(`${filename}:${lineNumber}: ${message}`);
      };

      if (trimmed === "end") {
        activeFlow = null;
        activeFunction = null;
        section = null;
        continue;
      }

      if (trimmed === "android:") {
        section = "android";
        activeFlow = null;
        activeFunction = null;
        continue;
      }

      if (section === "android" && /^\w[\w-]*\s*:/.test(trimmed)) {
        const colon = trimmed.indexOf(":");
        model.android[trimmed.slice(0, colon).trim()] = scalar(trimmed.slice(colon + 1));
        continue;
      }

      let match = trimmed.match(/^module\s+(.+)$/i);
      if (match) {
        model.module = scalar(match[1]);
        continue;
      }

      match = trimmed.match(/^(family|owner|version)\s*:\s*(.+)$/i);
      if (match) {
        model[match[1].toLowerCase()] = scalar(match[2]);
        continue;
      }

      match = trimmed.match(/^body\s*:?\s*(.+)$/i);
      if (match) {
        model.bodies.push(normalBody(match[1]));
        continue;
      }

      match = trimmed.match(/^flow\s+(.+?)(?::)?$/i);
      if (match) {
        activeFlow = { name: scalar(match[1]), steps: [] };
        model.flows.push(activeFlow);
        activeFunction = null;
        section = null;
        continue;
      }

      match = trimmed.match(/^func\s+([A-Za-z_][\w.-]*)(?:\((.*?)\))?(?::)?$/i);
      if (match) {
        activeFunction = {
          name: match[1],
          parameters: match[2]
            ? match[2].split(",").map((item) => item.trim()).filter(Boolean)
            : [],
          instructions: []
        };
        model.functions.push(activeFunction);
        activeFlow = null;
        section = null;
        continue;
      }

      if (activeFlow && /^(step|goto)\s+/.test(trimmed)) {
        const [kind, ...rest] = trimmed.split(/\s+/);
        activeFlow.steps.push({ kind, target: rest.join(" ") });
        continue;
      }

      if (activeFunction && /^(do|expect|return|emit)\s+/.test(trimmed)) {
        const [kind, ...rest] = trimmed.split(/\s+/);
        activeFunction.instructions.push({ kind, value: rest.join(" ") });
        continue;
      }

      if (/^route\s+/i.test(trimmed)) {
        model.routes.push(pair(trimmed, "route"));
        continue;
      }

      if (/^map\s+/i.test(trimmed)) {
        model.maps.push(pair(trimmed, "map"));
        continue;
      }

      match = trimmed.match(/^(entity|state|phase|ding)\s+(.+)$/i);
      if (match) {
        model.declarations.push({ kind: match[1].toLowerCase(), value: match[2] });
        continue;
      }

      fail(`unrecognized Cading line: ${trimmed}`);
    }

    model.bodies = [...new Set(model.bodies)];
    return model;
  }

  function positiveInteger(value, fallback) {
    const selected = value ?? fallback;
    if (!Number.isInteger(Number(selected)) || Number(selected) < 1) {
      throw new Error(`Android SDK value must be a positive integer: ${selected}`);
    }
    return Number(selected);
  }


  function sha256Fallback(value) {
    const bytes = global.TextEncoder
      ? new global.TextEncoder().encode(String(value))
      : Uint8Array.from(unescape(encodeURIComponent(String(value))), (ch) => ch.charCodeAt(0));
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
    const length = bytes.length;
    const paddedLength = Math.ceil((length + 9) / 64) * 64;
    const data = new Uint8Array(paddedLength);
    data.set(bytes); data[length] = 0x80;
    const bitLength = BigInt(length) * 8n;
    const view = new DataView(data.buffer);
    view.setUint32(paddedLength - 8, Number((bitLength >> 32n) & 0xffffffffn), false);
    view.setUint32(paddedLength - 4, Number(bitLength & 0xffffffffn), false);
    const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w = new Uint32Array(64);
    const rotr = (x,n) => (x >>> n) | (x << (32-n));
    for (let offset = 0; offset < data.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 64; i += 1) {
        const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
        const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
      }
      let [a,b,c,d,e,f,g,h] = H;
      for (let i = 0; i < 64; i += 1) {
        const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
      }
      H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
      H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
    }
    return H.map((part) => part.toString(16).padStart(8, "0")).join("");
  }

  async function sha256Text(value) {
    if (global.crypto?.subtle && global.TextEncoder) {
      const digest = await global.crypto.subtle.digest(
        "SHA-256",
        new global.TextEncoder().encode(String(value))
      );
      return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
    return sha256Fallback(value);
  }

  async function compileCading(source, filename = "<phone-editor>") {
    const model = parseCading(source, filename);
    const android = {
      package: String(model.android.package ?? model.module ?? ""),
      appName: String(model.android.appName ?? model.family ?? model.module ?? "JM Android App"),
      versionName: String(model.android.versionName ?? model.version ?? "1.0.0"),
      versionCode: positiveInteger(model.android.versionCode, 1),
      minSdk: positiveInteger(model.android.minSdk, 23),
      targetSdk: positiveInteger(model.android.targetSdk, 35),
      compileSdk: positiveInteger(model.android.compileSdk, 35),
      asset: String(model.android.asset ?? "app/index.html"),
      artifactName: String(
        model.android.artifactName ?? model.android.appName ?? model.family ?? "JM_ANDROID_APP"
      )
    };

    if (!model.owner) throw new Error("Source Gate HOLD: owner is required.");
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(android.package)) {
      throw new Error(`Invalid Android package identity: ${android.package}`);
    }
    if (android.minSdk > android.targetSdk || android.targetSdk > android.compileSdk) {
      throw new Error("SDK order must be minSdk <= targetSdk <= compileSdk.");
    }
    if (!model.flows.some((flow) => flow.name === "build")) {
      throw new Error("Intent Lock HOLD: a build flow is required.");
    }
    if (!model.routes.some((route) => route.from === "build")) {
      throw new Error("Intent Lock HOLD: a build route is required.");
    }

    const present = new Set(model.bodies.map(normalBody));
    const missing = REQUIRED_ANDROID_BODIES.filter((body) => !present.has(body));
    if (missing.length) {
      throw new Error(`Source Gate HOLD: missing coding bodies: ${missing.join(", ")}`);
    }

    const oneBody = {
      schema: "jm.onebody.android/v1",
      compiler: {
        name: "Cading",
        routeGraph: "JMGradle",
        generatedBy: "JM Android Forge 1.4.1 Dual-Surface Workshop (engine 1.4.1)"
      },
      identity: {
        module: model.module,
        family: model.family,
        owner: model.owner,
        version: model.version
      },
      bodies: model.bodies,
      android,
      functions: model.functions,
      flows: model.flows,
      routes: model.routes,
      maps: model.maps,
      declarations: model.declarations,
      provenance: {
        source: filename,
        sourceSha256: await sha256Text(source),
        authority: "Human-originated, human-governed, AI-assisted"
      }
    };

    return { model, oneBody };
  }

  global.JMForgeCore = Object.freeze({
    REQUIRED_ANDROID_BODIES,
    parseCading,
    compileCading,
    sha256Text
  });
})(globalThis);
