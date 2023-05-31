import libvcdenc from "./wasm/libvcdenc.bin";
import libvcddec from "./wasm/libvcddec.bin";

const onError = (err: string): any => {
  throw new Error(err);
};

const encoder = (await createModule("__Z6encodePhiS_i", libvcdenc))!;
const decoder = (await createModule("__Z6decodePhiS_i", libvcddec))!;

export function decode(from: Uint8Array, delta: Uint8Array): Uint8Array {
  const dictPtr = decoder.createBuffer(from.length);
  decoder.HEAP8.set(from, dictPtr);

  const deltaPtr = decoder.createBuffer(delta.length);
  decoder.HEAP8.set(delta, deltaPtr);

  decoder.main(dictPtr, from.length, deltaPtr, delta.length);

  const resultPointer = decoder.getResultPointer();
  const resultSize = decoder.getResultSize();
  const resultView = new Uint8Array(decoder.HEAP8.buffer, resultPointer, resultSize);
  const result = new Uint8Array(resultView);

  decoder.destroyBuffer(dictPtr);
  decoder.destroyBuffer(deltaPtr);
  decoder.free();

  return result;
}

export function encode(from: Uint8Array, to: Uint8Array): Uint8Array {
  const dictPtr = encoder.createBuffer(from.length);
  encoder.HEAP8.set(from, dictPtr);

  const targetPtr = encoder.createBuffer(to.length);
  encoder.HEAP8.set(to, targetPtr);

  encoder.main(dictPtr, from.length, targetPtr, to.length);

  const resultPointer = encoder.getResultPointer();
  const resultSize = encoder.getResultSize();
  const resultView = new Uint8Array(encoder.HEAP8.buffer, resultPointer, resultSize);
  const result = new Uint8Array(resultView);

  encoder.destroyBuffer(dictPtr);
  encoder.destroyBuffer(targetPtr);
  encoder.free();

  return result;
}

async function createModule(name: string, binary: Uint8Array) {
  function Module() {}
  Module.asm = undefined! as WebAssembly.Exports;
  Module.HEAP8 = undefined! as Int8Array;
  Module.HEAP16 = undefined! as Int16Array;
  Module.HEAP32 = undefined! as Int32Array;
  Module.HEAPU8 = undefined! as Uint8Array;
  Module.HEAPU16 = undefined! as Uint16Array;
  Module.HEAPU32 = undefined! as Uint32Array;
  Module.HEAPF32 = undefined! as Float32Array;
  Module.HEAPF64 = undefined! as Float64Array;

  let out = (...text: any[]) => console.log(name, ...text);
  let err = onError; // ((...text: any[]) => console.error(name, ...text));

  const warnOnce_shown = new Set<string>();

  function warnOnce(text: string) {
    if (!warnOnce_shown.has(text)) {
      warnOnce_shown.add(text);
      err(text);
    }
  }

  let ABORT = false;

  function assert(condition: any, text?: string): asserts condition {
    if (!condition) {
      abort("Assertion failed" + (text ? ": " + text : ""));
    }
  }

  function UTF8ArrayToString(heapOrArray: number[], idx: number) {
    let endPtr = idx;
    while (heapOrArray[endPtr]) {
      ++endPtr;
    }
    let str = "";

    while (idx < endPtr) {
      let u0 = heapOrArray[idx++];
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      const u1 = heapOrArray[idx++] & 63;
      if ((u0 & 224) === 192) {
        str += String.fromCharCode(((u0 & 31) << 6) | u1);
        continue;
      }
      const u2 = heapOrArray[idx++] & 63;
      if ((u0 & 240) === 224) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 248) !== 240) {
          warnOnce(
            "Invalid UTF-8 leading byte 0x" +
              u0.toString(16) +
              " encountered when deserializing a UTF-8 string in wasm memory to a JavaScript string."
          );
        }
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        const ch = u0 - 65536;
        str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
      }
    }

    return str;
  }

  function writeAsciiToMemory(str: string, buffer: number, dontAddNull?: boolean) {
    for (let i = 0; i < str.length; ++i) {
      assert(str.charCodeAt(i) === (str.charCodeAt(i) & 255));
      HEAP8[buffer++ >> 0] = str.charCodeAt(i);
    }
    if (!dontAddNull) {
      HEAP8[buffer >> 0] = 0;
    }
  }

  let buffer: ArrayBuffer;
  let HEAP8: Int8Array;
  let HEAPU8: Uint8Array;
  let HEAP32: Int32Array;
  let HEAPU32: Uint32Array;

  function updateGlobalBufferAndViews(buf: ArrayBuffer) {
    buffer = buf;
    Module.HEAP8 = HEAP8 = new Int8Array(buf);
    Module.HEAP16 = new Int16Array(buf);
    Module.HEAP32 = HEAP32 = new Int32Array(buf);
    Module.HEAPU8 = HEAPU8 = new Uint8Array(buf);
    Module.HEAPU16 = new Uint16Array(buf);
    Module.HEAPU32 = HEAPU32 = new Uint32Array(buf);
    Module.HEAPF32 = new Float32Array(buf);
    Module.HEAPF64 = new Float64Array(buf);
  }

  function writeStackCookie() {
    const max = _emscripten_stack_get_end();
    assert((max & 3) === 0);
    HEAP32[max >> 2] = 34821223;
    HEAP32[(max + 4) >> 2] = 2310721022;
    HEAP32[0] = 1668509029;
  }

  function checkStackCookie() {
    if (ABORT) {
      return;
    }
    const max = _emscripten_stack_get_end();
    const cookie1 = HEAPU32[max >> 2];
    const cookie2 = HEAPU32[(max + 4) >> 2];
    if (cookie1 !== 34821223 || cookie2 !== 2310721022) {
      abort(
        "Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x" +
          cookie2.toString(16) +
          " 0x" +
          cookie1.toString(16)
      );
    }
    if (HEAP32[0] !== 1668509029) {
      abort(
        "Runtime error: The application has corrupted its heap memory area (address zero)."
      );
    }
  }

  function abort(msg = "Error"): never {
    msg = `Aborted(${msg})`;
    err(msg);
    ABORT = true;
    throw new WebAssembly.RuntimeError(msg);
  }

  function exportASM<T extends any[], R>(name: string) {
    return Module.asm[name] as (...args: T) => R;
  }

  function emscriptenReallocBuffer(size: number) {
    try {
      wasmMemory.grow((size - buffer.byteLength + 65535) >>> 16);
      updateGlobalBufferAndViews(wasmMemory.buffer);
      return 1;
    } catch (e) {
      err(
        `emscripten_realloc_buffer: Attempted to grow heap from ${buffer.byteLength} bytes to ${size} bytes, but got error: ${e}`
      );
    }
  }

  const maxHeapSize = 2147483648;

  const envStrings = Object.entries({
    USER: "user",
    LOGNAME: "user",
    PATH: "/",
    PWD: "/",
    HOME: "/home/user",
    LANG: "C.UTF-8",
    _: "./main.c",
  }).map(([key, value]) => `${key}=${value}`);

  const buffers = [null, [], []] as number[][];

  function printChar(stream: number, curr: number) {
    const buffer: number[] = buffers[stream];
    assert(buffer);
    if (curr === 0 || curr === 10) {
      (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
      buffer.length = 0;
    } else {
      buffer.push(curr);
    }
  }

  const asmLibraryArg: WebAssembly.ModuleImports = {
    __cxa_allocate_exception(size: number) {
      return (_malloc(size + 16) as number) + 16;
    },
    __cxa_throw(excPtr: number, type: number, destructor: number) {
      const ptr = excPtr - 16;
      HEAP32[(ptr + 4) >> 2] = type;
      HEAP32[(ptr + 8) >> 2] = destructor;
      HEAP32[ptr >> 2] = 0;
      HEAP8[(ptr + 12) >> 0] = 0;
      HEAP8[(ptr + 13) >> 0] = 0;

      throw new Error(
        `${excPtr} - Exception catching is disabled, this exception cannot be caught. Compile with -s NO_DISABLE_EXCEPTION_CATCHING or -s EXCEPTION_CATCHING_ALLOWED=[..] to catch.`
      );
    },
    abort() {
      abort("native code called abort()");
    },
    emscripten_memcpy_big(dest: number, src: number, num: number) {
      HEAPU8.copyWithin(dest, src, src + num);
    },
    emscripten_resize_heap(requestedSize: number) {
      const oldSize = HEAPU8.length;
      requestedSize = requestedSize >>> 0;
      assert(requestedSize > oldSize);
      if (requestedSize > maxHeapSize) {
        err(
          `Cannot enlarge memory, asked to go up to ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes.`
        );
        return false;
      }
      const alignUp = (x: number, multiple: number) =>
        x + ((multiple - (x % multiple)) % multiple);
      let newSize: number;
      for (let cutDown = 1; cutDown <= 4; cutDown *= 2) {
        let overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
        newSize = Math.min(
          maxHeapSize,
          alignUp(Math.max(requestedSize, overGrownHeapSize), 65536)
        );
        const replacement = emscriptenReallocBuffer(newSize);
        if (replacement) {
          return true;
        }
      }
      err(
        `Failed to grow the heap from ${oldSize} bytes to ${newSize!} bytes, not enough memory!`
      );
      return false;
    },
    environ_get(__environ: number, environ_buf: number) {
      let bufSize = 0;
      envStrings.forEach((string, i) => {
        const ptr = environ_buf + bufSize;
        HEAP32[(__environ + i * 4) >> 2] = ptr;
        writeAsciiToMemory(string, ptr);
        bufSize += string.length + 1;
      });
      return 0;
    },
    environ_sizes_get(penviron_count: number, penviron_buf_size: number) {
      HEAP32[penviron_count >> 2] = envStrings.length;
      HEAP32[penviron_buf_size >> 2] = envStrings
        .map(string => string.length + 1)
        .reduce((a, b) => a + b);
      return 0;
    },
    exit(status: number, implicit: boolean) {
      checkUnflushedContent();
      if (!implicit) {
        throw new Error(
          `program exited (with status: ${status}), but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)`
        );
      }
      throw new ExitStatus(status);
    },
    fd_close() {
      abort();
    },
    fd_read: () => 0,
    fd_seek() {
      abort();
    },
    fd_write(fd: number, iov: number, iovcnt: number, pnum: number) {
      let num = 0;
      for (let i = 0; i < iovcnt; i++) {
        const ptr = HEAP32[iov >> 2];
        const len = HEAP32[(iov + 4) >> 2];
        iov += 8;
        for (let j = 0; j < len; j++) {
          printChar(fd, HEAPU8[ptr + j]);
        }
        num += len;
      }
      HEAP32[pnum >> 2] = num;
      return 0;
    },
    setTempRet0() {},
    strftime_l: () => 0,
  };

  let wasmTable: WebAssembly.Table;
  let wasmMemory: WebAssembly.Memory;

  try {
    const { instance } = await WebAssembly.instantiate(binary, {
      env: asmLibraryArg,
      wasi_snapshot_preview1: asmLibraryArg,
    });
    Module.asm = instance.exports;
    wasmMemory = Module.asm.memory as WebAssembly.Memory;
    updateGlobalBufferAndViews(wasmMemory.buffer);
    wasmTable = Module.asm.__indirect_function_table as WebAssembly.Table;
    assert(wasmTable, "table not found in wasm exports");
  } catch (e) {
    err("failed to asynchronously prepare wasm: " + e);
    abort(e);
  }

  Module.___wasm_call_ctors = exportASM("__wasm_call_ctors");
  Module.createBuffer = exportASM<[number], number>("_Z13create_bufferi");
  const _malloc = (Module._malloc = exportASM("malloc"));
  Module.destroyBuffer = exportASM<[number], void>("_Z14destroy_bufferPh");
  Module.main = exportASM<[number, number, number, number], void>(name.slice(1));
  Module.free = Module.asm._Z4freev as () => void;
  Module.getResultPointer = Module.asm._Z18get_result_pointerv as () => number;
  Module.getResultSize = Module.asm._Z15get_result_sizev as () => number;
  Module.___errno_location = exportASM("__errno_location");
  const ___stdio_exit = exportASM("__stdio_exit");
  Module._emscripten_stack_init = function (...args: any[]) {
    return (Module._emscripten_stack_init = (Module.asm as any).emscripten_stack_init)(
      ...args
    );
  };
  Module._emscripten_stack_get_free = function (...args: any[]) {
    return (Module._emscripten_stack_get_free = (
      Module.asm as any
    ).emscripten_stack_get_free)(...args);
  };
  Module._emscripten_stack_get_base = function (...args: any[]) {
    return (Module._emscripten_stack_get_base = (
      Module.asm as any
    ).emscripten_stack_get_base)(...args);
  };
  let _emscripten_stack_get_end = (Module._emscripten_stack_get_end = function (
    ...args: any[]
  ) {
    return (_emscripten_stack_get_end = Module._emscripten_stack_get_end =
      (Module.asm as any).emscripten_stack_get_end)(...args);
  });

  Module.stackSave = Module.asm.stackSave;
  Module.stackRestore = Module.asm.stackRestore;
  Module.stackAlloc = Module.asm.stackAlloc;
  Module.dynCall_viijii = Module.asm.dynCall_viijii;
  Module.dynCall_jiji = Module.asm.dynCall_jiji;
  Module.dynCall_iiiiij = Module.asm.dynCall_iiiiij;
  Module.dynCall_iiiiijj = Module.asm.dynCall_iiiiijj;
  Module.dynCall_iiiiiijj = Module.asm.dynCall_iiiiiijj;

  class ExitStatus extends Error {
    constructor(readonly status: number) {
      super(`Program terminated with exit(${status})`);
    }
  }

  function checkUnflushedContent() {
    const oldOut = out;
    const oldErr = err;
    let has = false;
    out = err = () => {
      has = true;
    };
    try {
      ___stdio_exit();
      if (buffers[1].length) {
        printChar(1, 10);
      }
      if (buffers[2].length) {
        printChar(2, 10);
      }
    } catch {}
    out = oldOut;
    err = oldErr;
    if (has) {
      warnOnce(
        "stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc."
      );
    }
  }

  (Module.asm as any).emscripten_stack_init();
  writeStackCookie();

  if (ABORT) {
    return;
  }

  checkStackCookie();
  (Module.asm as any).__wasm_call_ctors(Module);
  checkStackCookie();

  return Module;
}
