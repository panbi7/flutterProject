var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/package-query.js
var package_query_exports = {};
__export(package_query_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(package_query_exports);

// netlify/functions/utils/package-search.js
var import_node_fs = __toESM(require("fs"), 1);
var import_node_path = __toESM(require("path"), 1);
var import_node_url = require("url");
var import_meta = {};
var __filename = (0, import_node_url.fileURLToPath)(import_meta.url);
var __dirname = import_node_path.default.dirname(__filename);
var GENERATED_GUIDES_DIR = import_node_path.default.join(__dirname, "..", "..", "..", "generated-guides");
async function searchPackage(packageName) {
  if (!packageName || typeof packageName !== "string") {
    return null;
  }
  const normalizedName = packageName.trim().toLowerCase();
  const guideResult = await searchInGeneratedGuides(normalizedName);
  if (guideResult) {
    return {
      packageName: normalizedName,
      source: "pregenerated",
      guide: guideResult,
      packageInfo: {
        name: normalizedName,
        pubDevUrl: `https://pub.dev/packages/${normalizedName}`
      }
    };
  }
  return null;
}
async function searchInGeneratedGuides(packageName) {
  try {
    const fileName = `${packageName.replace(/-/g, "_")}.txt`;
    const filePath = import_node_path.default.join(GENERATED_GUIDES_DIR, fileName);
    if (!import_node_fs.default.existsSync(filePath)) {
      const dashFileName = `${packageName.replace(/_/g, "-")}.txt`;
      const dashFilePath = import_node_path.default.join(GENERATED_GUIDES_DIR, dashFileName);
      if (!import_node_fs.default.existsSync(dashFilePath)) {
        console.log(`[PACKAGE-SEARCH] \uAC00\uC774\uB4DC \uD30C\uC77C \uC5C6\uC74C: ${fileName}`);
        return null;
      }
      const content2 = import_node_fs.default.readFileSync(dashFilePath, "utf8");
      console.log(`[PACKAGE-SEARCH] \uAC00\uC774\uB4DC \uBC1C\uACAC: ${dashFileName}`);
      return content2;
    }
    const content = import_node_fs.default.readFileSync(filePath, "utf8");
    console.log(`[PACKAGE-SEARCH] \uAC00\uC774\uB4DC \uBC1C\uACAC: ${fileName}`);
    return content;
  } catch (error) {
    console.error(`[PACKAGE-SEARCH] \uAC00\uC774\uB4DC \uAC80\uC0C9 \uC624\uB958:`, error.message);
    return null;
  }
}

// netlify/functions/package-query.js
async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }
  try {
    const { packageName } = JSON.parse(event.body || "{}");
    if (!packageName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "packageName is required" })
      };
    }
    console.log(`[PACKAGE-QUERY] \u{1F4E6} "${packageName}" \uC870\uD68C \uC694\uCCAD`);
    const result = await searchPackage(packageName);
    if (!result) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: "Package not found",
          message: `"${packageName}" \uD328\uD0A4\uC9C0\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. pub.dev\uC5D0\uC11C \uD328\uD0A4\uC9C0 \uC774\uB984\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.`
        })
      };
    }
    console.log(`[PACKAGE-QUERY] \u2705 "${packageName}" \uC870\uD68C \uC131\uACF5 (source: ${result.source})`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        packageName: result.packageName,
        source: result.source,
        // 'pregenerated' 또는 'realtime'
        guide: result.guide,
        packageInfo: result.packageInfo || null
      })
    };
  } catch (error) {
    console.error("[PACKAGE-QUERY] \u274C \uC624\uB958 \uBC1C\uC0DD:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error.message
      })
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=package-query.js.map
