import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { FACES } from '@/features/faces/config';
import { faceDistance, matchPhotos, normalizeFaces, type Face } from '@/features/faces/model';

/**
 * The real face model, offline: the same @vladmandic/face-api build and weights the browsers load
 * (from node_modules — nothing is downloaded), run on TensorFlow.js's CPU backend over the sample
 * photos the package ships. It finds the faces, a face still matches itself in a changed copy of
 * the photo (mirrored and smaller) under the search threshold, and different people (the photo's
 * others) stay apart. Slower than the other unit tests: the model runs twice, on the CPU backend (tens
 * of seconds; more on a busy machine, hence the long timeout).
 */

type FaceApi = typeof import('@vladmandic/face-api');
const ROOT = resolve('node_modules/@vladmandic/face-api');
let faceapi: FaceApi;

async function loadNet(net: { loadFromWeightMap(map: unknown): Promise<void> | void }, name: string) {
  const manifest = JSON.parse(readFileSync(`${ROOT}/model/${name}-weights_manifest.json`, 'utf8')) as {
    paths: string[];
    weights: unknown[];
  }[];
  const bin = readFileSync(`${ROOT}/model/${manifest[0]!.paths[0]}`);
  const map = faceapi.tf.io.decodeWeights(new Uint8Array(bin).buffer, manifest[0]!.weights as never);
  await net.loadFromWeightMap(map);
}

/** A photo as the detector takes it (RGB), optionally mirrored and scaled. */
async function photo(file: string, width: number, mirror = false) {
  let img = sharp(`${ROOT}/demo/${file}`).resize({ width }).removeAlpha();
  if (mirror) img = img.flop();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return {
    tensor: faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32'),
    width: info.width,
    height: info.height,
  };
}

async function detect(file: string, width: number, mirror = false): Promise<Face[]> {
  const p = await photo(file, width, mirror);
  try {
    const found = await faceapi
      .detectAllFaces(
        p.tensor as never,
        new faceapi.SsdMobilenetv1Options({
          minConfidence: FACES.detect.minConfidence,
          maxResults: FACES.detect.maxFaces,
        }),
      )
      .withFaceLandmarks()
      .withFaceDescriptors();
    return normalizeFaces(
      found.map((f) => ({
        x: f.detection.box.x,
        y: f.detection.box.y,
        width: f.detection.box.width,
        height: f.detection.box.height,
        score: f.detection.score,
        descriptor: f.descriptor,
      })),
      p.width,
      p.height,
    );
  } finally {
    p.tensor.dispose();
  }
}

beforeAll(async () => {
  // the library's browser build expects a worker or a window; in Node it runs as if in a worker
  (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope ??= function WorkerGlobalScope() {};
  faceapi = (await import(pathToFileURL(`${ROOT}/dist/face-api.esm.js`).href)) as FaceApi;
  // (the library's own typings leave out TensorFlow.js's backend calls)
  const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
  await tf.setBackend('cpu');
  await tf.ready();
  await loadNet(faceapi.nets.ssdMobilenetv1, 'ssd_mobilenetv1_model');
  await loadNet(faceapi.nets.faceLandmark68Net, 'face_landmark_68_model');
  await loadNet(faceapi.nets.faceRecognitionNet, 'face_recognition_model');
}, 120_000);

describe('the real face model', () => {
  it('finds faces, matches a face to itself in a changed copy, and keeps different people apart', async () => {
    const faces = await detect('sample1.jpg', 720);
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) {
      expect(f.descriptor).toHaveLength(128);
      expect(f.score).toBeGreaterThanOrEqual(FACES.detect.minConfidence);
    }

    // the same photo mirrored and smaller: every face finds itself under the search threshold
    const copy = await detect('sample1.jpg', 560, true);
    expect(copy.length).toBe(faces.length);
    for (const f of faces) {
      const nearest = Math.min(...copy.map((c) => faceDistance(f.descriptor, c.descriptor)));
      expect(nearest).toBeLessThan(FACES.match.search);
    }
    const album = matchPhotos(
      faces[0]!.descriptor,
      copy.map((c) => ({ itemId: 'copy', descriptor: c.descriptor })),
    );
    expect(album.map((a) => a.itemId)).toEqual(['copy']);

    // the photo's other people: none is taken for another
    expect(faces.length).toBeGreaterThan(1);
    faces.forEach((f, i) =>
      faces
        .slice(i + 1)
        .forEach((o) => expect(faceDistance(f.descriptor, o.descriptor)).toBeGreaterThan(FACES.match.search)),
    );
  }, 600_000);
});
