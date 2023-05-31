// The MIT License (MIT)
//
// Copyright (c) 2016 Baz
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

interface LRUPath {
  cacheItem: Map<any, any>;
  arg: any;
}

export default function lru<R, T extends (...args: any[]) => R>(
  getLimit: () => number,
  fn: T
) {
  const cache = new Map();
  const lru: LRUPath[][] = [];

  let numArgs: number;
  let stub: (() => R) | undefined;

  const result: T & {
    writeCache(args: Parameters<T>, value: ReturnType<T>): void;
    getCache(): Map<any, any>;
  } = function (this: any, ...args: any[]): R {
    let currentCache = cache;
    let newMap: Map<any, any>;
    let fnResult;
    const argsLengthMinusOne = arguments.length - 1;
    const lruPath = Array<LRUPath>(argsLengthMinusOne + 1);
    let isMemoized = true;

    if ((numArgs || numArgs === 0) && numArgs !== argsLengthMinusOne + 1) {
      throw new Error(
        "LRU functions should always be called with the same number of arguments"
      );
    }

    // loop through each argument to traverse the map tree
    for (let i = 0; i < argsLengthMinusOne; i++) {
      lruPath[i] = {
        cacheItem: currentCache,
        arg: args[i],
      };

      // climb through the hierarchical map tree until the second-last argument has been found, or an argument is missing.
      // if all arguments up to the second-last have been found, this will potentially be a cache hit (determined later)
      if (currentCache.has(args[i])) {
        currentCache = currentCache.get(args[i]);
        continue;
      }

      isMemoized = false;

      // make maps until last value
      newMap = new Map();
      currentCache.set(args[i], newMap);
      currentCache = newMap;
    }

    // we are at the last arg, check if it is really memoized
    if (isMemoized) {
      if (currentCache.has(args[argsLengthMinusOne])) {
        fnResult = currentCache.get(args[argsLengthMinusOne]);
      } else {
        isMemoized = false;
      }
    }

    // Writing to cache manually
    if (stub != null) {
      fnResult = stub();
      currentCache.set(args[argsLengthMinusOne], fnResult);
    }

    // if the result wasn't memoized, compute it and cache it
    else if (!isMemoized) {
      fnResult = fn.apply(this, args);
      currentCache.set(args[argsLengthMinusOne], fnResult);
    }

    // if there is a cache limit, purge any extra results
    const limit = getLimit();
    if (limit > 0) {
      lruPath[argsLengthMinusOne] = {
        cacheItem: currentCache,
        arg: args[argsLengthMinusOne],
      };

      if (isMemoized) {
        moveToMostRecentLru(lru, lruPath);
      } else {
        lru.push(lruPath);
      }

      if (lru.length > limit) {
        removeCachedResult(lru.shift()!);
      }
    }

    numArgs = argsLengthMinusOne + 1;

    return fnResult;
  } as any;

  result.writeCache = function (args: any[], value: any) {
    stub = () => value;
    result(...args);
    stub = undefined;
  };

  result.getCache = () => cache;

  return result;
}

// move current args to most recent position
function moveToMostRecentLru(lru: LRUPath[][], lruPath: LRUPath[]) {
  const lruLen = lru.length;
  const lruPathLen = lruPath.length;
  let isMatch: boolean;
  let i: number;

  for (i = 0; i < lruLen; i++) {
    isMatch = true;
    for (let j = 0; j < lruPathLen; j++) {
      if (!Object.is(lru[i][j].arg, lruPath[j].arg)) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) {
      break;
    }
  }

  lru.push(lru.splice(i, 1)[0]);
}

// remove least recently used cache item and all dead branches
function removeCachedResult(removedLru: LRUPath[]) {
  const removedLruLen = removedLru.length;
  let currentLru = removedLru[removedLruLen - 1];
  currentLru.cacheItem.delete(currentLru.arg);

  // walk down the tree removing dead branches (size 0) along the way
  for (let i = removedLruLen - 2; i >= 0; i--) {
    currentLru = removedLru[i];
    const tmp = currentLru.cacheItem.get(currentLru.arg);

    if (!tmp || !tmp.size) {
      currentLru.cacheItem.delete(currentLru.arg);
    } else {
      break;
    }
  }
}
