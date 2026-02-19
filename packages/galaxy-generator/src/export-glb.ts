import { mkdir } from "node:fs/promises";
import path from "node:path";

import { Document, NodeIO } from "@gltf-transform/core";

import type { GeneratedGalaxyModel } from "./types";

export async function exportGalaxyAsGlb(args: {
  model: GeneratedGalaxyModel;
  outDir: string;
  fileName: string;
}) {
  const { model, outDir, fileName } = args;
  await mkdir(outDir, { recursive: true });

  const document = new Document();
  const buffer = document.createBuffer("default");

  const material = document
    .createMaterial("galaxy")
    .setDoubleSided(true)
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0.05)
    .setRoughnessFactor(0.82)
    .setEmissiveFactor([0.08, 0.08, 0.08]);

  const mesh = document.createMesh(model.id);

  for (let primitiveIndex = 0; primitiveIndex < model.mesh.primitives.length; primitiveIndex += 1) {
    const source = model.mesh.primitives[primitiveIndex]!;

    const positions = new Float32Array(source.positions);
    const normals = new Float32Array(source.normals);
    const colors = new Float32Array(source.colors);
    const indices = new Uint32Array(source.indices);

    const positionAccessor = document
      .createAccessor(`${source.name}-positions`)
      .setBuffer(buffer)
      .setType("VEC3")
      .setArray(positions);

    const normalAccessor = document
      .createAccessor(`${source.name}-normals`)
      .setBuffer(buffer)
      .setType("VEC3")
      .setArray(normals);

    const colorAccessor = document
      .createAccessor(`${source.name}-colors`)
      .setBuffer(buffer)
      .setType("VEC3")
      .setArray(colors);

    const indexAccessor = document
      .createAccessor(`${source.name}-indices`)
      .setBuffer(buffer)
      .setType("SCALAR")
      .setArray(indices);

    mesh.addPrimitive(
      document
        .createPrimitive()
        .setAttribute("POSITION", positionAccessor)
        .setAttribute("NORMAL", normalAccessor)
        .setAttribute("COLOR_0", colorAccessor)
        .setIndices(indexAccessor)
        .setMaterial(material)
    );
  }

  const node = document.createNode(model.id).setMesh(mesh);
  const scene = document.createScene("scene").addChild(node);
  document.getRoot().setDefaultScene(scene);

  const io = new NodeIO();
  const outPath = path.join(outDir, fileName);
  await io.write(outPath, document);

  return outPath;
}
