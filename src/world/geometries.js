/**
 * Geometries shared by many cells. Built lazily; never modified (cells clone them).
 */
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, RD, PK } from '../config.js';

let cache = null;
export function getGeoms() {
  return cache || (cache = buildGeoms());
}

function footpathSlab() {
  // Rounded-corner slab with edges subdivided every ~4 units so it bends with the road.
  const h = (C - 2 * RD) / 2 - PK, r = 7, q = h - r, pts = [];
  const V = (x, y) => pts.push(new THREE.Vector2(x, y));
  const edge = (ax, ay, bx, by) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
    for (let k = 0; k < n; k++) V(ax + (bx - ax) * k / n, ay + (by - ay) * k / n);
  };
  const arc = (cx, cy, a0) => {
    for (let k = 0; k < 10; k++) { const a = a0 + k / 10 * Math.PI / 2; V(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  };
  edge(-q, -h, q, -h); arc(q, -q, -Math.PI / 2);
  edge(h, -q, h, q); arc(q, q, 0);
  edge(q, h, -q, h); arc(-q, q, Math.PI / 2);
  edge(-h, q, -h, -q); arc(-q, -q, Math.PI);
  return BufferGeometryUtils.mergeVertices(
    new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.3, bevelEnabled: false }).rotateX(-Math.PI / 2));
}

function tunnelPortal() {
  // Concrete face at each tunnel mouth: a wall with an arch-shaped opening matching the tube.
  const o = new THREE.Shape();
  o.moveTo(-19, -1); o.lineTo(19, -1); o.lineTo(19, 16); o.lineTo(-19, 16); o.lineTo(-19, -1);
  const hole = new THREE.Path();
  hole.moveTo(11.3, -0.5); hole.lineTo(11.3, 0);
  hole.absellipse(0, 0, 11.3, 12.3, 0, Math.PI, false);
  hole.lineTo(-11.3, -0.5); hole.lineTo(11.3, -0.5);
  o.holes.push(hole);
  return BufferGeometryUtils.mergeVertices(
    new THREE.ExtrudeGeometry(o, { depth: 1.2, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, -0.6));
}

function interchangeRamp() {
  const a = RD, rr = 32, s = new THREE.Shape();
  s.moveTo(a, a); s.lineTo(a + rr, a);
  s.absarc(a + rr, a + rr, rr, -Math.PI / 2, -Math.PI, true);
  s.lineTo(a, a);
  return new THREE.ShapeGeometry(s, 16).rotateX(-Math.PI / 2);
}

function buildGeoms() {
  const flat = (w, d, ws = 1, ds = 1) => new THREE.PlaneGeometry(w, d, ws, ds).rotateX(-Math.PI / 2);
  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
    sph: new THREE.SphereGeometry(1, 16, 10),
    lampSphere: new THREE.SphereGeometry(1, 8, 6),
    leaf: new THREE.IcosahedronGeometry(1, 1),
    // long road pieces are subdivided so they follow the curve instead of cutting a chord
    dashLine: flat(C - 2 * RD, 0.35, 21, 1),
    roadOverlay: flat(C - 2 * RD, 2 * RD, 21, 1),
    solidLine: flat(C - 2 * RD, 0.2, 21, 1),
    water: flat(C, C - 2 * RD, 12, 12),
    crosswalk: flat(3, 14),
    parkingBay: flat(0.15, 4.2),
    parkingEdge: flat(1, 0.15, 16, 1),
    junction: flat(2 * RD, 2 * RD),
    footpath: footpathSlab(),
    portal: tunnelPortal(),
    tunnel: new THREE.CylinderGeometry(1, 1, 5.4, 16, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(11, 12, 1),
    interchangeRamp: interchangeRamp(),
  };
}
