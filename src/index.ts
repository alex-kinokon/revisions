import lru from "./lru";
import { decode, encode } from "./workers/worker-main";

interface RevisionEntry {
  readonly id: string;
  readonly data: Uint8Array;
  readonly parentId?: string;
}
interface SerializedRevisionEntry {
  readonly id: string;
  readonly data: string;
  readonly parentId?: string;
}

/**
 * In the FSFS back end, each revision of a file is represented as a
 * delta against an older revision of the file.  The first revision is
 * represented as a delta against the empty stream (i.e. it is
 * self-compressed).  To reconstruct a revision of a file, the filesystem
 * code determines the chain of deltas leading back to revision 0,
 * composes them all together using the delta combiner, and applies the
 * resulting super-delta to the empty stream in order to reconstruct the
 * file contents.
 *
 * To choose the delta base for revision _N_, we write out _N_ in binary and
 * flip the rightmost bit whose value is 1. For instance, if we are storing `54`,
 * we write it out in binary as `110110`, flip the last `1` bit to get
 * `110100`, and thus pick revision `52` of the file as the delta base.  A file
 * with ten versions (numbered `0`-`9`) would have those versions represented as
 * follows:
 *
 * ```
 *   0 <- 1    2 <- 3    4 <- 5    6 <- 7
 *   0 <------ 2         4 <------ 6
 *   0 <---------------- 4
 *   0 <------------------------------------ 8 <- 9
 * ```
 *
 * where `0 <- 1` means that the delta base for revision 1 is revision 0.
 *
 * Because we flip the rightmost `1` bit each time we pick a delta base,
 * at most _log_(N) deltas are necessary to reconstruct revision _N_ of a
 * file.
 */
export class Revisions implements AsyncIterable<Uint8Array> {
  readonly #cacheSize: number;
  readonly #revisions: RevisionEntry[] = [];
  #uuidCounter = 0;
  #revisionIdMap = new Map<string, RevisionEntry>();

  constructor(options?: {
    /** Size of cache for decoder. */
    cacheSize?: number;
  }) {
    this.#cacheSize = options?.cacheSize ?? 20;
  }

  get length() {
    return this.#revisions.length;
  }

  #nextID() {
    return String(this.#uuidCounter++);
  }

  #pushRevision(revision: RevisionEntry) {
    this.#revisions.push(revision);
    this.#revisionIdMap.set(String(revision.id), revision);
    return revision;
  }

  #decodeDeltaEntry = lru(
    () => this.#cacheSize,
    async (entry: RevisionEntry): Promise<Uint8Array> => {
      const parent = this.#revisionIdMap.get(entry.parentId!)!;
      const parentDecoded = await this.#decodeEntry(parent);
      return await decode(parentDecoded, entry.data);
    }
  );

  async #decodeEntry(entry: RevisionEntry): Promise<Uint8Array> {
    if (entry.parentId == null) {
      return entry.data;
    }
    return await this.#decodeDeltaEntry(entry);
  }

  async push(data: Uint8Array): Promise<void> {
    if (!this.#revisionIdMap.size) {
      this.#pushRevision({ id: this.#nextID(), data });
      return;
    }

    const N = this.#revisions.length;
    const base = N & (N - 1);
    const parent = this.#revisions[base];
    const delta = await encode(await this.#decodeEntry(parent), data);
    const rev = this.#pushRevision({
      id: this.#nextID(),
      data: delta,
      parentId: parent.id,
    });
    this.#decodeDeltaEntry.writeCache([rev], Promise.resolve(data));
  }

  async get(index: number): Promise<Uint8Array> {
    return this.#decodeEntry(this.#revisions[index]);
  }

  toJSON() {
    const decoder = new TextDecoder();
    return {
      revisions: this.#revisions.map(
        (r): SerializedRevisionEntry => ({
          id: r.id,
          data: decoder.decode(r.data),
          parentId: r.parentId,
        })
      ),
      uuidCounter: this.#uuidCounter,
    };
  }

  static fromJSON(json: any) {
    const encoder = new TextEncoder();
    const copy = new Revisions();
    copy.#uuidCounter = json.uuidCounter;
    const revisions = (json.revisions as SerializedRevisionEntry[]).map(
      (r): RevisionEntry => ({
        id: r.id,
        data: encoder.encode(r.data),
        parentId: r.parentId,
      })
    );
    // @ts-expect-error readonly
    copy.#revisions = revisions;
    copy.#revisionIdMap = new Map(revisions.map(r => [r.id, r]));
    return copy;
  }

  async *[Symbol.asyncIterator]() {
    for (let i = 0; i < this.length; i++) {
      yield await this.get(i);
    }
  }
}
