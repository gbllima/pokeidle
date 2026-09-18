import { readFileSync } from 'node:fs';
import { walkTree } from './node-tree.ts';

/** items.otb attribute ids (servidor/src/itemloader.h, ITEM_ATTR_FIRST = 0x10). */
export const ITEM_ATTR = {
  SERVERID: 0x10,
  CLIENTID: 0x11,
  NAME: 0x12,
  DESCR: 0x13,
  SPEED: 0x14,
  SLOT: 0x15,
  MAXITEMS: 0x16,
  WEIGHT: 0x17,
  WEAPON: 0x18,
  AMU: 0x19,
  ARMOR: 0x1a,
  MAGLEVEL: 0x1b,
  MAGFIELDTYPE: 0x1c,
  WRITEABLE: 0x1d,
  ROTATETO: 0x1e,
  DECAY: 0x1f,
  SPRITEHASH: 0x20,
  MINIMAPCOLOR: 0x21,
  ATTR_07: 0x22,
  ATTR_08: 0x23,
  LIGHT: 0x24,
  DECAY2: 0x25,
  WEAPON2: 0x26,
  AMU2: 0x27,
  ARMOR2: 0x28,
  WRITEABLE2: 0x29,
  LIGHT2: 0x2a,
  TOPORDER: 0x2b,
  WRITEABLE3: 0x2c,
  WAREID: 0x2d,
} as const;

/**
 * items.otb stores the client version as a `clientVersion_t` ORDINAL, not as
 * the literal version number (servidor/src/itemloader.h). 57 means 10.98.
 */
export const OTB_CLIENT_VERSION: Record<number, number> = {
  50: 1010, 51: 1020, 52: 1021, 53: 1030, 54: 1031,
  55: 1035, 56: 1076, 57: 1098,
};

export const ITEM_GROUP = [
  'none', 'ground', 'container', 'weapon', 'ammunition', 'armor', 'charges',
  'teleport', 'magicfield', 'writeable', 'key', 'splash', 'fluid', 'door', 'deprecated',
] as const;

export type OtbItem = {
  group: number;
  groupName: string;
  flags: number;
  serverId: number;
  clientId: number;
  speed?: number;
  lightLevel?: number;
  lightColor?: number;
  topOrder?: number;
  wareId?: number;
  name?: string;
};

export type OtbFile = {
  majorVersion: number; // otb format version
  minorVersion: number; // clientVersion_t ordinal, NOT the literal version
  /** Resolved literal client version, e.g. 1098. Null when the ordinal is unknown. */
  clientVersion: number | null;
  buildNumber: number;
  items: OtbItem[];
  /** serverId -> clientId. The bridge OTBM needs to reach a sprite. */
  serverToClient: Map<number, number>;
  /** clientId -> serverId. Ambiguous by nature; keeps the lowest serverId. */
  clientToServer: Map<number, number>;
};

export function loadOtb(path: string): OtbFile {
  const buf = readFileSync(path);

  let majorVersion = 0;
  let minorVersion = 0;
  let buildNumber = 0;
  const items: OtbItem[] = [];

  walkTree(buf, {
    enter({ type, depth, props }) {
      const r = props();

      if (depth === 0) {
        r.u32(); // root flags
        const attr = r.u8();
        if (attr === 0x01) {
          const len = r.u16();
          if (len !== 140) {
            throw new Error(`items.otb: unexpected version block length ${len}, expected 140`);
          }
          majorVersion = r.u32();
          minorVersion = r.u32();
          buildNumber = r.u32();
        }
        return;
      }

      const flags = r.u32();
      const item: OtbItem = {
        group: type,
        groupName: ITEM_GROUP[type] ?? `unknown(${type})`,
        flags,
        serverId: 0,
        clientId: 0,
      };

      while (!r.eof) {
        const attr = r.u8();
        if (r.eof) break;
        const len = r.u16();
        const next = r.pos + len;

        switch (attr) {
          case ITEM_ATTR.SERVERID:
            item.serverId = r.u16();
            break;
          case ITEM_ATTR.CLIENTID:
            item.clientId = r.u16();
            break;
          case ITEM_ATTR.SPEED:
            item.speed = r.u16();
            break;
          case ITEM_ATTR.LIGHT2:
            item.lightLevel = r.u16();
            item.lightColor = r.u16();
            break;
          case ITEM_ATTR.TOPORDER:
            item.topOrder = r.u8();
            break;
          case ITEM_ATTR.WAREID:
            item.wareId = r.u16();
            break;
          case ITEM_ATTR.NAME:
            item.name = r.bytes(len).toString('latin1');
            break;
          default:
            break;
        }

        r.seek(next);
      }

      items.push(item);
    },
  });

  const serverToClient = new Map<number, number>();
  const clientToServer = new Map<number, number>();
  for (const it of items) {
    if (it.serverId === 0) continue;
    serverToClient.set(it.serverId, it.clientId);
    if (it.clientId !== 0 && !clientToServer.has(it.clientId)) {
      clientToServer.set(it.clientId, it.serverId);
    }
  }

  return {
    majorVersion,
    minorVersion,
    clientVersion: OTB_CLIENT_VERSION[minorVersion] ?? null,
    buildNumber,
    items,
    serverToClient,
    clientToServer,
  };
}
