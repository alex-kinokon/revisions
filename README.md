# @proteria/revisions

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-username/revisions-library)
[![CI Status](https://github.com/your-username/revisions-library/workflows/CI/badge.svg)](https://github.com/your-username/revisions-library/actions)
[![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](https://github.com/your-username/revisions-library/blob/main/LICENSE)

A library for storing and retrieving revisions of a file. This library allows you to efficiently manage and access different versions of a file. You can push new revisions, retrieve specific revisions by index, iterate over all revisions, and more. The history is fully serializable.

## Algorithm

This library implements a version of SVN’s [skip deltas](https://svn.apache.org/repos/asf/subversion/trunk/notes/skip-deltas) and uses [open-cvdiff](https://github.com/google/open-vcdiff) behind the scene to efficiently stores deltas. This means `get` and `push` operations are O(_log_ N). However, common operations (like reverse sequential `get` and consecutive `push`) are heavily cached so the actual performance is better.

## Installation

Install the library using your package manager of choice:

```bash
npm install @proteria/revisions
```

or

```bash
yarn add @proteria/revisions
```

## Usage

```ts
import { Revisions } from "@proteria/revisions";

// Create a new revisions instance
const revisions = new Revisions();

// Push new revisions
const revision1 = new Uint8Array([1, 2, 3]);
await revisions.push(revision1);

const revision2 = new Uint8Array([4, 5, 6]);
await revisions.push(revision2);

// Retrieve a revision by index
const retrievedRevision = await revisions.get(1);
console.log(retrievedRevision); // Uint8Array [4, 5, 6]

// Operate with texts
const textArray = new TextEncoder().encode("Hello World!");
await revisions.push(textArray);

// Iterate over all revisions
for await (const revision of revisions) {
  console.log(revision);
}

// Get the total number of revisions
console.log(revisions.length); // 2

// Serialize the revisions object
const serialized = JSON.stringify(revisions);

// Create a new revisions instance from serialized data
const newRevisions = Revisions.fromJSON(JSON.parse(serialized));
```

## API

### Revisions

The `Revisions` class represents an ordered list of file revisions.

#### Constructor

```javascript
new Revisions(options?: { cacheSize?: number });
```

- `options` (optional): An object specifying the options for the revisions instance.
  - `cacheSize` (optional): The size of the cache for the decoder.

#### Properties

##### length

```ts
readonly length: number
```

The number of revisions in the collection.

#### Methods

##### push

```ts
push(data: Uint8Array): Promise<void>
```

Pushes a new revision to the collection.

- `data`: The data of the new revision as a `Uint8Array`.

##### get

```ts
get(index: number): Promise<Uint8Array>
```

Retrieves a specific revision from the collection by index.

- `index`: The index of the revision to retrieve.

##### toJSON

```ts
toJSON(): JSONObject
```

Serializes the revisions object to a JSON-compatible object.

##### fromJSON

```ts
Revisions.fromJSON(json: JSONObject): Revisions
```

Creates a new revisions instance from a serialized JSON object.

- `json`: The serialized JSON object.

##### [Symbol.asyncIterator]

```javascript
[Symbol.asyncIterator](): AsyncGenerator<Uint8Array, void, unknown>
```

Allows iterating over the revisions using the `for await...of` loop.

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](LICENSE) file for details.
