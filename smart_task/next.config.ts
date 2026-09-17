import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up the directory tree
  // and can latch onto an unrelated package-lock.json outside the repository.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // firebase-admin pulls in @google-cloud/firestore, which is a Node library
  // with optional native/telemetry requires. Bundling it breaks those requires,
  // so leave it external and let Node load it at runtime.
  serverExternalPackages: ["firebase-admin", "@google-cloud/firestore"],
};

export default nextConfig;
